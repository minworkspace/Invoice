import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { timingSafeEqual } from "crypto";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required for bootstrap.`);
  }

  return value;
}

function safeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

async function tokenFromRequest(request: NextRequest) {
  const headerToken = request.headers.get("x-bootstrap-token")?.trim();
  if (headerToken) return headerToken;

  const authorization = request.headers.get("authorization")?.trim();
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim();
  }

  try {
    const body = (await request.json()) as { token?: string };
    return body.token?.trim() || "";
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  const bootstrapToken = process.env.BOOTSTRAP_SUPER_ADMIN_TOKEN?.trim();

  if (!bootstrapToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "BOOTSTRAP_SUPER_ADMIN_TOKEN is not configured."
      },
      { status: 503 }
    );
  }

  const requestToken = await tokenFromRequest(request);

  if (!requestToken || !safeEquals(requestToken, bootstrapToken)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid bootstrap token."
      },
      { status: 401 }
    );
  }

  const existingSuperAdmin = await prisma.user.findFirst({
    where: { role: UserRole.SUPER_ADMIN },
    select: { id: true, email: true }
  });

  if (existingSuperAdmin) {
    return NextResponse.json({
      ok: true,
      created: false,
      disabled: true,
      message: "SUPER_ADMIN already exists. Bootstrap did not create a duplicate."
    });
  }

  let superAdminEmail: string;
  let superAdminPassword: string;

  try {
    superAdminEmail = requiredEnv("SUPER_ADMIN_EMAIL").toLowerCase();
    superAdminPassword = requiredEnv("SUPER_ADMIN_PASSWORD");
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Super admin bootstrap environment is incomplete."
      },
      { status: 503 }
    );
  }

  const superAdminName = process.env.SUPER_ADMIN_NAME?.trim() || "System Owner";
  const passwordHash = await hashPassword(superAdminPassword);

  const result = await prisma.$transaction(async (tx) => {
    const existingInsideTransaction = await tx.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
      select: { email: true }
    });

    if (existingInsideTransaction) {
      return {
        created: false,
        systemCompany: null,
        superAdmin: existingInsideTransaction
      };
    }

    const systemCompany = await tx.company.upsert({
      where: { id: "system-admin-company" },
      update: {
        name: "System Administration",
        email: superAdminEmail,
        isActive: true
      },
      create: {
        id: "system-admin-company",
        name: "System Administration",
        email: superAdminEmail
      }
    });

    const superAdmin = await tx.user.upsert({
      where: { email: superAdminEmail },
      update: {
        companyId: systemCompany.id,
        name: superAdminName,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        isActive: true
      },
      create: {
        companyId: systemCompany.id,
        name: superAdminName,
        email: superAdminEmail,
        passwordHash,
        role: UserRole.SUPER_ADMIN
      },
      select: {
        email: true
      }
    });

    return {
      created: true,
      systemCompany,
      superAdmin
    };
  });

  if (!result.created) {
    return NextResponse.json({
      ok: true,
      created: false,
      disabled: true,
      message: "SUPER_ADMIN already exists. Bootstrap did not create a duplicate."
    });
  }

  return NextResponse.json({
    ok: true,
    created: true,
    disabled: true,
    message: "SUPER_ADMIN created. Bootstrap will not create duplicates after this.",
    company: result.systemCompany?.name,
    email: result.superAdmin.email
  });
}
