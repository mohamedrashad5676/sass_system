import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accountType = searchParams.get("accountType");

  const plans = await prisma.plan.findMany({
    where: { isActive: true, ...(accountType ? { accountType: accountType as any } : {}) },
    include: { details: true, addons: { include: { addon: true } } },
    orderBy: { priceMonthly: "asc" },
  });

  return NextResponse.json({ plans });
}
