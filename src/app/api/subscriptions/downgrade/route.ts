import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth/middleware";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

const DowngradeSchema = z.object({ accountId: z.string(), newPlanId: z.string(), addonItemsToCancel: z.array(z.string()).optional() });

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const { accountId, newPlanId, addonItemsToCancel = [] } = DowngradeSchema.parse(body);

  const mgmt = await prisma.userAccountManagement.findFirst({ where: { userId: auth.userId, userAccountId: accountId, role: { in: ["owner", "admin"] } } });
  if (!mgmt) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sub = await prisma.subscription.findUnique({ where: { userAccountId: accountId } });
  if (!sub || sub.status !== "active") return badRequest("No active subscription");

  const newPlan = await prisma.plan.findUnique({ where: { id: newPlanId } });
  if (!newPlan) return badRequest("Plan not found");

  // Store pending downgrade — applied at next renewal
  const downgrade = await prisma.$transaction(async (tx) => {
    // Remove existing pending downgrade if any
    await tx.downgrade.deleteMany({ where: { userAccountId: accountId } });

    const dg = await tx.downgrade.create({
      data: {
        userAccountId: accountId,
        newPlanId,
        requestedBy: auth.userId,
        addonItems: addonItemsToCancel.length > 0 ? {
          create: addonItemsToCancel.map((id) => ({ addonItemId: id })),
        } : undefined,
      },
    });
    return dg;
  });

  return NextResponse.json({ message: "Downgrade scheduled for next renewal", effectiveDate: sub.renewDate, downgradeId: downgrade.id });
}
