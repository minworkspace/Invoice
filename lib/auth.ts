import "server-only";

import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDatabaseSetupError, isRecoverableDatabaseError } from "@/lib/database";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "invoice_session";

type SessionPayload = {
  userId: string;
  companyId: string;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required. Add it to your .env file.");
  }
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string, companyId: string) {
  const token = jwt.sign({ userId, companyId }, authSecret(), { expiresIn: "30d" });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, authSecret()) as SessionPayload;
    if (!payload.userId || !payload.companyId) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  if (getDatabaseSetupError()) return null;

  try {
    const user = await prisma.user.findFirst({
      where: {
        id: session.userId,
        companyId: session.companyId
      },
      include: {
        company: {
          include: {
            settings: true
          }
        }
      }
    });

    if (!user) return null;
    if (!user.isActive) return null;
    if (user.role !== UserRole.SUPER_ADMIN && !user.company.isActive) return null;

    return user;
  } catch (error) {
    if (isRecoverableDatabaseError(error)) {
      return null;
    }

    throw error;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSuperAdmin() {
  const user = await requireUser();
  if (user.role !== UserRole.SUPER_ADMIN) redirect("/dashboard");
  return user;
}

export async function requireCompanyUser() {
  const user = await requireUser();
  if (user.role === UserRole.SUPER_ADMIN) {
    redirect("/admin/companies?notice=super-admin-documents");
  }
  return user;
}

export async function requireGuest() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === UserRole.SUPER_ADMIN ? "/admin" : "/dashboard");
}
