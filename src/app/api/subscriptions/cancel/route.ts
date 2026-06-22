import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth/middleware";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();
  const { accountId } = z.object({ accountId: z.string() }).parse(await req.json());

  const mgmt = await prisma.userAccountManagement.findFirst({ where: { userId: auth.userId, userAccountId: accountId, role: "owner" } });
  if (!mgmt) return NextResponse.json({ error: "Only owner can cancel" }, { status: 403 });

  const sub = await prisma.subscription.findUnique({ where: { userAccountId: accountId } });
  if (!sub || sub.status === "cancelled") return badRequest("No active subscription");

  await prisma.subscription.update({ where: { id: sub.id }, data: { status: "cancel_pending" } });
  return NextResponse.json({ message: "Subscription will be cancelled at next renewal date", effectiveDate: sub.renewDate });
}
