import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth/middleware";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

const PlanSchema = z.object({
  name: z.string(),
  accountType: z.enum(["individual", "organization"]),
  seatModel: z.enum(["dedicated", "shared_pool", "hybrid"]),
  priceMonthly: z.number(),
  priceAnnual: z.number(),
  details: z.object({
    baseSeatCount: z.number().optional(),
    baseRoomPoolSize: z.number().optional(),
    maxParticipants: z.number(),
    storageGb: z.number(),
    maxMeetingDurationMin: z.number().optional(),
    meetingQuotaDays: z.number().optional(),
  }),
});

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth?.isAdmin) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const data = PlanSchema.parse(body);

  const plan = await prisma.plan.create({
    data: {
      name: data.name,
      accountType: data.accountType,
      seatModel: data.seatModel,
      priceMonthly: data.priceMonthly,
      priceAnnual: data.priceAnnual,
      details: { create: data.details },
    },
    include: { details: true },
  });

  return NextResponse.json({ plan }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth?.isAdmin) return unauthorized();
  const plans = await prisma.plan.findMany({ include: { details: true, addons: { include: { addon: true } } } });
  return NextResponse.json({ plans });
}
