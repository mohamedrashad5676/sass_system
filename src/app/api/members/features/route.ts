import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth/middleware";
import prisma from "@/lib/db/prisma";
import { z } from "zod";

const FeaturesSchema = z.object({
  managementId: z.string(),
  features: z.array(z.object({ featureKey: z.string(), featureValue: z.string() })),
});

// POST — assign member features (admin only)
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const { managementId, features } = FeaturesSchema.parse(body);

  const target = await prisma.userAccountManagement.findUnique({ where: { id: managementId } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const callerMgmt = await prisma.userAccountManagement.findFirst({
    where: { userId: auth.userId, userAccountId: target.userAccountId, role: { in: ["owner", "admin"] } },
  });
  if (!callerMgmt) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.$transaction(
    features.map((f) =>
      prisma.memberFeature.upsert({
        where: { userAccountManagementId_featureKey: { userAccountManagementId: managementId, featureKey: f.featureKey } },
        create: { userAccountManagementId: managementId, featureKey: f.featureKey, featureValue: f.featureValue },
        update: { featureValue: f.featureValue },
      })
    )
  );

  return NextResponse.json({ message: "Member features updated" });
}

// GET — list member features
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();
  const { searchParams } = new URL(req.url);
  const managementId = searchParams.get("managementId");
  if (!managementId) return NextResponse.json({ error: "managementId required" }, { status: 400 });

  const target = await prisma.userAccountManagement.findUnique({ where: { id: managementId }, include: { features: true } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const callerMgmt = await prisma.userAccountManagement.findFirst({
    where: { userId: auth.userId, userAccountId: target.userAccountId },
  });
  if (!callerMgmt) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ features: target.features });
}
