import Link from "next/link";
import { redirect } from "next/navigation";
import { createSession, hashPassword, requireGuest } from "@/lib/auth";
import { authDatabaseErrorMessage, authDatabaseErrorRedirect, getDatabaseSetupError } from "@/lib/database";
import { formString } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

async function registerAction(formData: FormData) {
  "use server";
  const companyName = formString(formData, "companyName");
  const name = formString(formData, "name");
  const email = formString(formData, "email").toLowerCase();
  const password = formString(formData, "password");

  if (password.length < 8) {
    redirect("/register?error=password");
  }

  const setupError = getDatabaseSetupError();
  if (setupError) {
    redirect("/register?error=db-missing");
  }

  let existingUser;
  try {
    existingUser = await prisma.user.findUnique({ where: { email } });
  } catch (error) {
    redirect(authDatabaseErrorRedirect(error, "/register"));
  }

  if (existingUser) {
    redirect("/register?error=exists");
  }

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: companyName,
          settings: {
            create: {
              chopUrl: "",
              ssmNumber: "",
              invoicePrefix: "INV-",
              invoiceStartNumber: 1,
              quotationPrefix: "QUO-",
              quotationStartNumber: 1,
              receiptPrefix: "REC-",
              receiptStartNumber: 1,
              documentNumberPadding: 5,
              paymentInfo: "",
              defaultImportantNotes: "",
              defaultRemarks: ""
            }
          }
        }
      });

      return tx.user.create({
        data: {
          companyId: company.id,
          name,
          email,
          passwordHash,
          role: "COMPANY_ADMIN"
        }
      });
    });

    await createSession(user.id, user.companyId);
  } catch (error) {
    redirect(authDatabaseErrorRedirect(error, "/register"));
  }

  redirect("/dashboard");
}

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; detail?: string }>;
}) {
  await requireGuest();
  const params = await searchParams;
  const setupError = getDatabaseSetupError();

  const error =
    params?.error === "exists"
      ? "An account with that email already exists."
      : params?.error === "password"
        ? "Password must be at least 8 characters."
        : authDatabaseErrorMessage(params?.error, params?.detail);

  return (
    <div className="panel">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Invoice App</p>
        <h1 className="mt-1 text-2xl font-bold">Register company</h1>
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
      <form action={registerAction} className="space-y-4">
        <label className="block">
          <span className="label">Company name</span>
          <input className="field" name="companyName" required />
        </label>
        <label className="block">
          <span className="label">Your name</span>
          <input className="field" name="name" required />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input className="field" name="email" type="email" required />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input className="field" name="password" type="password" minLength={8} required />
        </label>
        <button className="btn btn-primary w-full" type="submit">
          Create account
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        Already registered?{" "}
        <Link className="font-semibold text-brand" href="/login">
          Log in
        </Link>
      </p>
    </div>
  );
}
