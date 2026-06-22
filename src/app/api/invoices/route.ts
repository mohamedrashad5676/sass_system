import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth/middleware";
import prisma from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();
  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const mgmt = await prisma.userAccountManagement.findFirst({ where: { userId: auth.userId, userAccountId: accountId } });
  if (!mgmt) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const invoices = await prisma.invoice.findMany({
    where: { userAccountId: accountId },
    include: { items: true, coupon: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ invoices });
}
