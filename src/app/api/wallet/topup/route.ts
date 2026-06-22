import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth/middleware";
import prisma from "@/lib/db/prisma";
import { renewalQueue } from "@/lib/queue";
import Decimal from "decimal.js";
import { z } from "zod";

const TopupSchema = z.object({ accountId: z.string(), amount: z.number().positive() });

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const { accountId, amount } = TopupSchema.parse(body);

  const mgmt = await prisma.userAccountManagement.findFirst({ where: { userId: auth.userId, userAccountId: accountId, role: { in: ["owner"] } } });
  if (!mgmt) return NextResponse.json({ error: "Only owner can top up" }, { status: 403 });

  const now = new Date();
  const idKey = `topup-${accountId}-${now.getTime()}`;

  const wallet = await prisma.$transaction(async (tx) => {
    const w = await tx.wallet.update({ where: { userAccountId: accountId }, data: { balance: { increment: amount } } });
    await tx.walletTransaction.create({ data: { walletId: w.id, type: "credit", amount, description: "Wallet top-up", idempotencyKey: idKey } });
    await tx.invoice.create({
      data: {
        subscriptionId: (await tx.subscription.findUnique({ where: { userAccountId: accountId } }))?.id || "none",
        userAccountId: accountId, totalPrice: amount, status: "issued", paymentStatus: "paid", type: "topup", idempotencyKey: `inv-${idKey}`,
        items: { create: [{ name: "Wallet Top-up", price: amount, quantity: 1 }] },
      },
    });
    return w;
  });

  // If subscription is past_due, trigger immediate retry
  const sub = await prisma.subscription.findUnique({ where: { userAccountId: accountId } });
  if (sub && sub.status === "past_due") {
    await renewalQueue.add("renew-subscription", { subscriptionId: sub.id }, { jobId: `topup-retry-${sub.id}-${now.getTime()}` });
  }

  return NextResponse.json({ balance: wallet.balance, message: "Wallet topped up" });
}
