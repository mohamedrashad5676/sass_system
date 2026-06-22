import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth/middleware";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

const CouponSchema = z.object({
  code: z.string(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number(),
  maxGlobalUses: z.number().optional(),
  maxPerUserUses: z.number().optional(),
  expiresAt: z.string().datetime().optional(),
  planIds: z.array(z.string()).optional(),
  planAddonIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth?.isAdmin) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const { planIds = [], planAddonIds = [], ...rest } = CouponSchema.parse(body);

  const coupon = await prisma.coupon.create({
    data: {
      ...rest,
      expiresAt: rest.expiresAt ? new Date(rest.expiresAt) : null,
      planCoupons: planIds.length > 0 ? { create: planIds.map((planId) => ({ planId })) } : undefined,
      addonCoupons: planAddonIds.length > 0 ? { create: planAddonIds.map((planAddonId) => ({ planAddonId })) } : undefined,
    },
    include: { planCoupons: true, addonCoupons: true },
  });

  return NextResponse.json({ coupon }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth?.isAdmin) return unauthorized();
  const coupons = await prisma.coupon.findMany({ include: { planCoupons: true, addonCoupons: true } });
  return NextResponse.json({ coupons });
}
