import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth/middleware";
import prisma from "@/lib/db/prisma";
import { renewalQueue } from "@/lib/queue";
import { z } from "zod";
import Decimal from "decimal.js";
import { addDays } from "date-fns";
import { connectMongo } from "@/lib/db/mongoose";
import { Entitlement } from "@/lib/db/models/entitlement.model";

const SubscribeSchema = z.object({
  planId: z.string(),
  billingCycle: z.enum(["monthly", "annual"]),
  couponCode: z.string().optional(),
  accountId: z.string(), // which user_account to subscribe
});

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();

  const body = await req.json().catch(() => ({}));
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { planId, billingCycle, couponCode, accountId } = parsed.data;

  // Verify user owns/manages this account
  const management = await prisma.userAccountManagement.findFirst({
    where: { userId: auth.userId, userAccountId: accountId, role: { in: ["owner", "admin"] } },
  });
  if (!management) return NextResponse.json({ error: "No permission on this account" }, { status: 403 });

  const existingSub = await prisma.subscription.findUnique({ where: { userAccountId: accountId } });
  if (existingSub && existingSub.status !== "cancelled") return badRequest("Account already has an active subscription");

  const plan = await prisma.plan.findUnique({ where: { id: planId, isActive: true } });
  if (!plan) return badRequest("Plan not found");

  let price = new Decimal(billingCycle === "annual" ? plan.priceAnnual.toString() : plan.priceMonthly.toString());

  // Apply coupon if any
  let couponId: string | undefined;
  if (couponCode) {
    const coupon = await prisma.coupon.findFirst({
      where: { code: couponCode, isActive: true },
      include: { planCoupons: true },
    });
    if (coupon) {
      const planLinked = coupon.planCoupons.some((pc) => pc.planId === planId);
      const notExpired = !coupon.expiresAt || coupon.expiresAt > new Date();
      const globalOk = !coupon.maxGlobalUses || coupon.currentUses < coupon.maxGlobalUses;
      if (planLinked && notExpired && globalOk) {
        couponId = coupon.id;
        if (coupon.discountType === "percentage") {
          price = price.minus(price.times(coupon.discountValue.toString()).dividedBy(100));
        } else {
          price = price.minus(coupon.discountValue.toString());
        }
        if (price.lessThan(0)) price = new Decimal(0);
      }
    }
  }

  const now = new Date();
  const cycleMs = billingCycle === "annual" ? 365 * 86400000 : 30 * 86400000;
  const renewDate = new Date(now.getTime() + cycleMs);

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userAccountId: accountId } });
    if (!wallet) throw new Error("Wallet not found");
    if (new Decimal(wallet.balance.toString()).lessThan(price)) throw new Error("INSUFFICIENT_BALANCE");

    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: price.toNumber() } } });

    const idKey = `sub-${accountId}-${planId}-${now.getTime()}`;
    await tx.walletTransaction.create({
      data: { walletId: wallet.id, type: "debit", amount: price.toNumber(), description: `Subscription: ${plan.name}`, idempotencyKey: idKey },
    });

    const sub = await tx.subscription.upsert({
      where: { userAccountId: accountId },
      create: { userAccountId: accountId, planId, status: "active", billingCycle, startDate: now, endDate: renewDate, renewDate },
      update: { planId, status: "active", billingCycle, startDate: now, endDate: renewDate, renewDate },
    });

    await tx.invoice.create({
      data: {
        subscriptionId: sub.id, userAccountId: accountId, couponId: couponId || null,
        totalPrice: price.toNumber(), status: "issued", paymentStatus: "paid", type: "subscription",
        idempotencyKey: `inv-${idKey}`,
        items: { create: [{ name: plan.name, description: `${billingCycle} subscription`, price: price.toNumber(), quantity: 1 }] },
      },
    });

    if (couponId) await tx.coupon.update({ where: { id: couponId }, data: { currentUses: { increment: 1 } } });

    return sub;
  });

  // Init entitlements in MongoDB
  await connectMongo();
  await Entitlement.updateOne(
    { user_account_id: accountId },
    { $setOnInsert: { limits: {}, usage: {}, occurrence: 0, period_start: now, period_end: renewDate, updated_at: now } },
    { upsert: true }
  );

  // Schedule renewal BullMQ job
  await renewalQueue.add("renew-subscription", { subscriptionId: result.id }, { delay: cycleMs, jobId: `renewal-${result.id}-${renewDate.getTime()}` });

  return NextResponse.json({ subscription: result }, { status: 201 });
}
