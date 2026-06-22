import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth/middleware";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

const AddonSchema = z.object({ name: z.string(), manifest: z.record(z.unknown()) });
const PlanAddonSchema = z.object({ planId: z.string(), addonId: z.string(), price: z.number(), cycle: z.string(), unit: z.string(), config: z.record(z.unknown()) });

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth?.isAdmin) return unauthorized();
  const { searchParams } = new URL(req.url);
  const body = await req.json().catch(() => ({}));

  if (searchParams.get("action") === "link-plan") {
    const data = PlanAddonSchema.parse(body);
    const pa = await prisma.planAddon.create({ data: { ...data, config: data.config as any } });
    return NextResponse.json({ planAddon: pa }, { status: 201 });
  }

  const data = AddonSchema.parse(body);
  const addon = await prisma.addon.create({ data: { name: data.name, manifest: data.manifest } });
  return NextResponse.json({ addon }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth?.isAdmin) return unauthorized();
  const addons = await prisma.addon.findMany({ include: { planAddons: { include: { plan: true } } } });
  return NextResponse.json({ addons });
}
