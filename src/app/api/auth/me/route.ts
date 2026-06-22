import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, unauthorized } from "@/lib/auth/middleware";
import prisma from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return unauthorized();
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: { accounts: { include: { userAccount: { include: { subscription: { include: { plan: true, addonItems: { include: { planAddon: { include: { addon: true } } } } } }, wallet: true } } } } },
  });
  if (!user) return unauthorized();
  const { passwordHash, ...safeUser } = user;
  return NextResponse.json({ user: safeUser });
}
