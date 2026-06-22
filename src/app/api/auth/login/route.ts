import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db/prisma";
import { signToken } from "@/lib/auth/jwt";
import { z } from "zod";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(body);

  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: { include: { userAccount: { include: { subscription: { include: { plan: true } }, wallet: true } } } } },
  });
  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const token = await signToken({ userId: user.id, email, isAdmin: user.isAdmin });
  const res = NextResponse.json({
    user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, isAdmin: user.isAdmin },
    accounts: user.accounts.map((m) => ({
      managementId: m.id, role: m.role,
      account: { id: m.userAccount.id, type: m.userAccount.type, name: m.userAccount.name,
        subscription: m.userAccount.subscription ? { status: m.userAccount.subscription.status, plan: m.userAccount.subscription.plan.name, renewDate: m.userAccount.subscription.renewDate } : null,
        walletBalance: m.userAccount.wallet?.balance },
    })),
    token,
  });
  res.cookies.set("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 3600 });
  return res;
}
