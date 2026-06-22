import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth/middleware";
import prisma from "@/lib/db/prisma";
import Decimal from "decimal.js";
import { z } from "zod";

const UpgradeSchema = z.object({ accountId: z.string(), newPlanId: z.string() });

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const { accountId, newPlanId } = UpgradeSchema.parse(body);

  const mgmt = await prisma.userAccountManagement.findFirst({ where: { userId: auth.userId, userAccountId: accountId, role: { in: ["owner", "admin"] } } });
  if (!mgmt) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sub = await prisma.subscription.findUnique({ where: { userAccountId: accountId }, include: { plan: true } });
  if (!sub || sub.status !== "active") return badRequest("No active subscription");

  const newPlan = await prisma.plan.findUnique({ where: { id: newPlanId, isActive: true } });
  if (!newPlan) return badRequest("Plan not found");

  // Proration
  const now = new Date();
  const totalDays = (sub.renewDate.getTime() - sub.startDate.getTime()) / 86400000;
  const daysRemaining = Math.max(0, (sub.renewDate.getTime() - now.getTime()) / 86400000);

  const oldPrice = sub.billingCycle === "annual" ? sub.plan.priceAnnual : sub.plan.priceMonthly;
  const newPrice = sub.billingCycle === "annual" ? newPlan.priceAnnual : newPlan.priceMonthly;

  const priceDiff = new Decimal(newPrice.toString()).minus(oldPrice.toString());
  if (priceDiff.lte(0)) return badRequest("Use downgrade for lower-tier plans");

  const prorated = priceDiff.dividedBy(totalDays).times(daysRemaining).toDecimalPlaces(2);

  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userAccountId: accountId } });
    if (!wallet) throw new Error("Wallet not found");
    if (new Decimal(wallet.balance.toString()).lessThan(prorated)) throw new Error("INSUFFICIENT_BALANCE");

    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: prorated.toNumber() } } });

    const idKey = `upgrade-${sub.id}-${now.getTime()}`;
    await tx.walletTransaction.create({
      data: { walletId: wallet.id, type: "debit", amount: prorated.toNumber(), description: `Upgrade to ${newPlan.name} (prorated)`, idempotencyKey: idKey },
    });

    await tx.subscription.update({ where: { id: sub.id }, data: { planId: newPlanId } });

    await tx.invoice.create({
      data: {
        subscriptionId: sub.id, userAccountId: accountId, totalPrice: prorated.toNumber(),
        status: "issued", paymentStatus: "paid", type: "subscription", idempotencyKey: `inv-${idKey}`,
        items: { create: [{ name: `Upgrade: ${sub.plan.name} → ${newPlan.name}`, description: `Prorated for ${daysRemaining.toFixed(1)} days`, price: prorated.toNumber(), quantity: 1 }] },
      },
    });

    // Cancel any pending downgrade
    await tx.downgrade.deleteMany({ where: { userAccountId: accountId } });
  });

  return NextResponse.json({ message: "Upgraded successfully", proratedCharge: prorated });
}
