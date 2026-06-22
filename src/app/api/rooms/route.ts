import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth/middleware";

// GET /api/rooms?accountId=xxx
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();

  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return badRequest("accountId is required");

  // Verify user belongs to this account
  const membership = await prisma.userAccountManagement.findFirst({
    where: { userId: auth.userId, userAccountId: accountId },
  });
  if (!membership) return unauthorized();

  const rooms = await prisma.room.findMany({
    where: { userAccountId: accountId, isActive: true },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      activeMeeting: { select: { id: true, startedAt: true, startedBy: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ rooms });
}

// POST /api/rooms — create a room
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();

  const body = await req.json();
  const { accountId, name, ownerId } = body;

  if (!accountId || !name) return badRequest("accountId and name are required");

  // Check membership & role (owner/admin can create rooms)
  const membership = await prisma.userAccountManagement.findFirst({
    where: { userId: auth.userId, userAccountId: accountId },
  });
  if (!membership) return unauthorized();
  if (!["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only owner or admin can create rooms" }, { status: 403 });
  }

  // Ensure account has active subscription
  const sub = await prisma.subscription.findUnique({
    where: { userAccountId: accountId },
    include: { plan: { include: { details: true } } },
  });
  if (!sub || sub.status !== "active") {
    return NextResponse.json({ error: "No active subscription" }, { status: 403 });
  }

  // Count existing rooms vs allowed seat count
  const existingRooms = await prisma.room.count({
    where: { userAccountId: accountId, isActive: true },
  });

  const plan = sub.plan;
  const maxRooms = plan.seatModel === "shared_pool"
    ? (plan.details?.baseRoomPoolSize ?? 0)
    : (plan.details?.baseSeatCount ?? 0);

  if (existingRooms >= maxRooms) {
    return NextResponse.json(
      { error: `Room limit reached (${maxRooms} rooms for ${plan.name} plan)` },
      { status: 400 }
    );
  }

  const effectiveOwnerId = ownerId || auth.userId;

  const room = await prisma.room.create({
    data: {
      userAccountId: accountId,
      ownerId: effectiveOwnerId,
      name,
      seatModel: plan.seatModel,
    },
    include: {
      owner: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  return NextResponse.json({ room }, { status: 201 });
}
