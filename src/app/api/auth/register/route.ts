import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db/prisma";
import { signToken } from "@/lib/auth/jwt";
import { z } from "zod";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  accountType: z.enum(["individual", "organization"]),
  orgName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { email, password, firstName, lastName, accountType, orgName } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 12);

  const { user, account } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, passwordHash, firstName, lastName } });
    const accountName = accountType === "organization" ? (orgName || `${firstName}'s Org`) : `${firstName} ${lastName}`;
    const account = await tx.userAccount.create({ data: { type: accountType, name: accountName } });
    await tx.userAccountManagement.create({ data: { userId: user.id, userAccountId: account.id, role: "owner" } });
    await tx.wallet.create({ data: { userAccountId: account.id } });
    return { user, account };
  });

  const token = await signToken({ userId: user.id, email, isAdmin: false });
  const res = NextResponse.json({ user: { id: user.id, email, firstName, lastName }, account: { id: account.id, type: accountType }, token }, { status: 201 });
  res.cookies.set("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 7 * 24 * 3600 });
  return res;
}
