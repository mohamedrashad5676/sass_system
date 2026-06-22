import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth/middleware";
import prisma from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongoose";
import { Entitlement } from "@/lib/db/models/entitlement.model";
import Decimal from "decimal.js";
import { z } from "zod";

const PurchaseSchema = z.object({
  accountId: z.string(),
  planAddonId: z.string(),
  runtimeConfig: z.record(z.unknown()),
  couponCode: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const { accountId, planAddonId, runtimeConfig, couponCode } = PurchaseSchema.parse(body);

  const mgmt = await prisma.userAccountManagement.findFirst({ where: { userId: auth.userId, userAccountId: accountId, role: { in: ["owner", "admin"] } } });
  if (!mgmt) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sub = await prisma.subscription.findUnique({ where: { userAccountId: accountId }, include: { plan: true } });
  if (!sub || sub.status !== "active") return badRequest("No active subscription");

  const planAddon = await prisma.planAddon.findUnique({ where: { id: planAddonId }, include: { addon: true } });
  if (!planAddon) return badRequest("Addon not found");
  if (planAddon.planId !== sub.planId) return badRequest("Addon not available for your plan");

  const manifest = planAddon.addon.manifest as any;

  // Check max_per_org constraint
  if (manifest.constraints?.max_per_org) {
    const existing = await prisma.subscriptionAddonItem.count({
      where: { subscriptionId: sub.id, planAddonId: { in: (await prisma.planAddon.findMany({ where: { addonId: planAddon.addonId } })).map(pa => pa.id) }, status: "active" },
    });
    if (existing >= manifest.constraints.max_per_org) return badRequest(`Max ${manifest.constraints.max_per_org} of this addon allowed`);
  }

  // Pro-rate price to subscription cycle end
  const now = new Date();
  const totalDays = (sub.renewDate.getTime() - sub.startDate.getTime()) / 86400000;
  const daysRemaining = Math.max(0, (sub.renewDate.getTime() - now.getTime()) / 86400000);
  let price = new Decimal(planAddon.price.toString()).dividedBy(totalDays).times(daysRemaining).toDecimalPlaces(2);

  // Annual plan: addon renews monthly — end_time = now + 30 days (not full year)
  const isAnnual = sub.billingCycle === "annual";
  const addonEndTime = isAnnual ? new Date(now.getTime() + 30 * 86400000) : sub.renewDate;
  if (isAnnual) {
    const monthDays = 30;
    price = new Decimal(planAddon.price.toString()).dividedBy(totalDays).times(daysRemaining).toDecimalPlaces(2);
  }

  // Coupon check
  let couponId: string | undefined;
  if (couponCode) {
    const coupon = await prisma.coupon.findFirst({
      where: { code: couponCode, isActive: true },
      include: { addonCoupons: true },
    });
    if (coupon) {
      const linked = coupon.addonCoupons.some((ac) => ac.planAddonId === planAddonId);
      const notExpired = !coupon.expiresAt || coupon.expiresAt > new Date();
      const globalOk = !coupon.maxGlobalUses || coupon.currentUses < coupon.maxGlobalUses;
      if (linked && notExpired && globalOk) {
        couponId = coupon.id;
        if (coupon.discountType === "percentage") price = price.minus(price.times(coupon.discountValue.toString()).dividedBy(100));
        else price = price.minus(coupon.discountValue.toString());
        if (price.lt(0)) price = new Decimal(0);
      }
    }
  }

  const addonItem = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userAccountId: accountId } });
    if (!wallet) throw new Error("Wallet not found");
    if (new Decimal(wallet.balance.toString()).lt(price)) throw new Error("INSUFFICIENT_BALANCE");

    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: price.toNumber() } } });

    const idKey = `addon-${sub.id}-${planAddonId}-${now.getTime()}`;
    await tx.walletTransaction.create({ data: { walletId: wallet.id, type: "debit", amount: price.toNumber(), description: `Addon: ${planAddon.addon.name} (prorated)`, idempotencyKey: idKey } });

    const item = await tx.subscriptionAddonItem.create({
      data: { subscriptionId: sub.id, planAddonId, count: 1, status: "active", autoRenew: true, startTime: now, endTime: addonEndTime, runtimeConfig: runtimeConfig as any },
    });

    await tx.invoice.create({
      data: {
        subscriptionId: sub.id, userAccountId: accountId, couponId: couponId || null,
        totalPrice: price.toNumber(), status: "issued", paymentStatus: "paid", type: "addon", idempotencyKey: `inv-${idKey}`,
        items: { create: [{ name: planAddon.addon.name, description: `Prorated for ${daysRemaining.toFixed(1)} days`, price: price.toNumber(), quantity: 1 }] },
      },
    });

    if (couponId) await tx.coupon.update({ where: { id: couponId }, data: { currentUses: { increment: 1 } } });
    return item;
  });

  // Update MongoDB entitlements based on manifest.entitlement_keys
  await connectMongo();
  const entUpdate: Record<string, any> = { updated_at: new Date() };
  const entInc: Record<string, number> = {};

  if (manifest.type === "resource") {
    if (manifest.entitlement_keys?.includes("large_meeting_count")) {
      entInc["limits.large_meeting.count"] = 1;
      const capacity = (runtimeConfig as any).capacity;
      if (capacity) entUpdate["limits.large_meeting.capacity"] = capacity;
    }
    if (manifest.entitlement_keys?.includes("storage_gb")) {
      const sizeGb = (runtimeConfig as any).size_gb || 100;
      entInc["limits.storage.gb"] = sizeGb;
    }
    if (manifest.entitlement_keys?.includes("extra_users")) {
      const extraCount = (runtimeConfig as any).extra_count || 30;
      entInc["limits.users.extra_count"] = extraCount;
    }
  } else if (manifest.type === "module") {
    if (manifest.module?.id === "crm") {
      entUpdate["limits.crm.enabled"] = true;
      entUpdate["limits.crm.max_contacts"] = (runtimeConfig as any).max_contacts;
      entUpdate["limits.crm.max_seats"] = (runtimeConfig as any).seats;
    }
  }

  await Entitlement.updateOne(
    { user_account_id: accountId },
    { $inc: entInc, $set: entUpdate },
    { upsert: true }
  );

  return NextResponse.json({ addonItem, message: "Addon purchased successfully" }, { status: 201 });
}
