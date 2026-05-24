import Link from "next/link";
import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { createSession, requireGuest, verifyPassword } from "@/lib/auth";
import { authDatabaseErrorMessage, authDatabaseErrorRedirect, getDatabaseSetupError } from "@/lib/database";
import { prisma } from "@/lib/prisma";
import { formString } from "@/lib/forms";

async function loginAction(formData: FormData) {
  "use server";
  const email = formString(formData, "email").toLowerCase();
  const password = formString(formData, "password");

  const setupError = getDatabaseSetupError();
  if (setupError) {
    redirect("/login?error=db-missing");
  }

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email },
      include: { company: { select: { isActive: true } } }
    });
  } catch (error) {
    redirect(authDatabaseErrorRedirect(error, "/login"));
  }

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=invalid");
  }
  if (!user.isActive || (user.role !== UserRole.SUPER_ADMIN && !user.company.isActive)) {
    redirect("/login?error=disabled");
  }

  await createSession(user.id, user.companyId);
  redirect(user.role === UserRole.SUPER_ADMIN ? "/admin" : "/dashboard");
}

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; detail?: string }>;
}) {
  await requireGuest();
  const params = await searchParams;
  const setupError = getDatabaseSetupError();
  const error =
    authDatabaseErrorMessage(params?.error, params?.detail) ||
    (params?.error === "disabled" ? "This account is disabled. Please contact the system owner." : null) ||
    (params?.error === "invalid" ? "Invalid email or password." : null);

  return (
    <div className="panel">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Invoice App</p>
        <h1 className="mt-1 text-2xl font-bold">Log in</h1>
      </div>
      {setupError ? (
        <div className="mb-4 rounded-md border border-[#CFAE43]/30 bg-[#FFF8DF] px-3 py-2 text-sm text-[#765B00]">
          {setupError}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-md border border-[#B64545]/30 bg-[#FDECEC] px-3 py-2 text-sm text-[#9D3838]">
          {error}
        </div>
      ) : null}
      <form action={loginAction} className="space-y-4">
        <label className="block">
          <span className="label">Email</span>
          <input className="field" name="email" type="email" required />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input className="field" name="password" type="password" required />
        </label>
        <button className="btn btn-primary w-full" type="submit">
          Log in
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        New company?{" "}
        <Link className="font-semibold text-brand" href="/register">
          Create an account
        </Link>
      </p>
    </div>
  );
}
