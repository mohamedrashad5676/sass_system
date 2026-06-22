import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

// GET /api/addons?planId=xxx — get available addons for a plan
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const planId = searchParams.get("planId");
  if (!planId) return NextResponse.json({ error: "planId required" }, { status: 400 });

  const planAddons = await prisma.planAddon.findMany({
    where: { planId },
    include: { addon: true },
  });

  return NextResponse.json({ addons: planAddons });
}
