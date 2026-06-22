/**
 * POST /api/rooms/[roomId]/start
 *
 * Full 6-guard chain before starting a meeting:
 *
 * Guard 1 — Subscription active?
 * Guard 2 — Room belongs to this user? (dedicated rooms)
 * Guard 3 — Room not already in a meeting?
 * Guard 4 — Large capacity addon check
 *   Guard 4a — Org has the entitlement?
 *   Guard 4b — Member has permission?
 *   Guard 4c — Member's capacity tier covers this room?
 */
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { connectMongo } from "@/lib/db/mongoose";
import { Entitlement } from "@/lib/db/models/entitlement.model";
import { getAuthUser, unauthorized } from "@/lib/auth/middleware";

export async function POST(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();

  const { roomId } = params;
  await connectMongo();

  // ─── Load room with account context ───────────────────────────────────────
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      userAccount: {
        include: {
          subscription: {
            include: {
              addonItems: {
                where: { status: "active" },
                include: {
                  planAddon: { include: { addon: true } },
                },
              },
            },
          },
        },
      },
      activeMeeting: true,
    },
  });

  if (!room || !room.isActive) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const sub = room.userAccount.subscription;

  // ── Guard 1: Subscription active? ─────────────────────────────────────────
  if (!sub) {
    return NextResponse.json({ error: "No active subscription" }, { status: 403 });
  }
  if (sub.status === "suspended") {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }
  if (sub.status === "past_due") {
    return NextResponse.json({ error: "Payment overdue" }, { status: 403 });
  }
  if (sub.status === "cancelled") {
    return NextResponse.json({ error: "No active subscription" }, { status: 403 });
  }

  // ── Guard 2: Room belongs to this user (dedicated seat model) ─────────────
  if (room.seatModel === "dedicated" && room.ownerId !== auth.userId) {
    return NextResponse.json(
      { error: "You do not have access to this room" },
      { status: 403 }
    );
  }

  // For shared pool: verify user is a member of the account
  if (room.seatModel === "shared_pool") {
    const membership = await prisma.userAccountManagement.findFirst({
      where: { userId: auth.userId, userAccountId: room.userAccountId },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "You are not a member of this account" },
        { status: 403 }
      );
    }
  }

  // ── Guard 3: Room not already in a meeting? ────────────────────────────────
  if (room.activeMeeting) {
    return NextResponse.json({ error: "Room is already in use" }, { status: 409 });
  }

  // ── Guard 4: Large capacity addon check ───────────────────────────────────
  // Check if this room has a large meeting capacity addon assigned to it
  const largeMeetingAddonItem = sub.addonItems.find((item) => {
    const manifest = item.planAddon.addon.manifest as any;
    const rc = item.runtimeConfig as any;
    return manifest?.type === "resource" && rc?.room_name === room.name;
  });

  if (largeMeetingAddonItem) {
    const accountId = room.userAccountId;

    // ── Guard 4a: Org has the entitlement? ──────────────────────────────────
    const entitlement = await Entitlement.findOne({ user_account_id: accountId }).lean();
    const largeMeetingCount = (entitlement as any)?.limits?.large_meeting?.count ?? 0;

    if (largeMeetingCount <= 0) {
      return NextResponse.json(
        { error: "Organisation has no large meeting rooms available" },
        { status: 403 }
      );
    }

    // ── Guard 4b: Member has permission? ────────────────────────────────────
    const membership = await prisma.userAccountManagement.findFirst({
      where: { userId: auth.userId, userAccountId: accountId },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this account" }, { status: 403 });
    }

    const largeMeetingFeature = await prisma.memberFeature.findFirst({
      where: { userAccountManagementId: membership.id, featureKey: "large_meeting" },
    });
    if (!largeMeetingFeature || largeMeetingFeature.featureValue !== "true") {
      return NextResponse.json(
        { error: "You do not have large meeting permission" },
        { status: 403 }
      );
    }

    // ── Guard 4c: Member's capacity tier covers this room? ──────────────────
    const capacityFeature = await prisma.memberFeature.findFirst({
      where: { userAccountManagementId: membership.id, featureKey: "capacity_of_large_meeting" },
    });
    const memberCapacity = parseInt(capacityFeature?.featureValue ?? "0", 10);
    const runtimeConfig = largeMeetingAddonItem.runtimeConfig as any;
    const roomCapacity = parseInt(runtimeConfig?.capacity ?? "0", 10);

    if (roomCapacity > memberCapacity) {
      return NextResponse.json(
        {
          error: `Room capacity (${roomCapacity}) exceeds your permitted tier (${memberCapacity})`,
        },
        { status: 403 }
      );
    }
  }

  // ── All guards passed → start the meeting ─────────────────────────────────
  const activeMeeting = await prisma.activeMeeting.create({
    data: {
      roomId: room.id,
      startedBy: auth.userId,
      metadata: {
        planName: sub.plan?.name ?? "",
        seatModel: room.seatModel,
        hasLargeCapacity: !!largeMeetingAddonItem,
      },
    },
  });

  return NextResponse.json(
    {
      message: "Meeting started",
      meeting: {
        id: activeMeeting.id,
        roomId: room.id,
        roomName: room.name,
        startedAt: activeMeeting.startedAt,
      },
    },
    { status: 201 }
  );
}

// DELETE /api/rooms/[roomId]/start — end the meeting
export async function DELETE(
  req: NextRequest,
  { params }: { params: { roomId: string } }
) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();

  const { roomId } = params;

  const activeMeeting = await prisma.activeMeeting.findFirst({
    where: { roomId },
    include: { room: true },
  });

  if (!activeMeeting) {
    return NextResponse.json({ error: "No active meeting found for this room" }, { status: 404 });
  }

  // Only the person who started it, the room owner, or an admin can end it
  const isStarter = activeMeeting.startedBy === auth.userId;
  const isRoomOwner = activeMeeting.room.ownerId === auth.userId;

  const membership = await prisma.userAccountManagement.findFirst({
    where: { userId: auth.userId, userAccountId: activeMeeting.room.userAccountId },
  });
  const isAccountAdmin = membership && ["owner", "admin"].includes(membership.role);

  if (!isStarter && !isRoomOwner && !isAccountAdmin) {
    return NextResponse.json(
      { error: "You do not have permission to end this meeting" },
      { status: 403 }
    );
  }

  await prisma.activeMeeting.delete({ where: { id: activeMeeting.id } });

  return NextResponse.json({ message: "Meeting ended", roomId });
}
