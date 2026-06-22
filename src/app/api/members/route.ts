import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";
import { getAuthUser, unauthorized, badRequest } from "@/lib/auth/middleware";

// GET /api/members?accountId=xxx
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();

  const accountId = req.nextUrl.searchParams.get("accountId");
  if (!accountId) return badRequest("accountId is required");

  // Verify requester is a member
  const myMembership = await prisma.userAccountManagement.findFirst({
    where: { userId: auth.userId, userAccountId: accountId },
  });
  if (!myMembership) return unauthorized();

  const managements = await prisma.userAccountManagement.findMany({
    where: { userAccountId: accountId },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      features: { select: { featureKey: true, featureValue: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    members: managements,
    myRole: myMembership.role,
  });
}
