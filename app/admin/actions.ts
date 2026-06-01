"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, requireSuperAdmin } from "@/lib/auth";
import { defaultCompanySettingsData } from "@/lib/company-settings";
import { formString } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { deleteFile, deleteFolder } from "@/lib/storage";

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
  );
}

export async function createCompanyWithAdminAction(formData: FormData) {
  await requireSuperAdmin();

  const companyName = formString(formData, "companyName");
  const companyEmail = formString(formData, "companyEmail");
  const adminName = formString(formData, "adminName");
  const adminEmail = formString(formData, "adminEmail").toLowerCase();
  const adminPassword = formString(formData, "adminPassword");

  if (!companyName || !adminName || !adminEmail || adminPassword.length < 8) {
    redirect("/admin/companies?error=invalid-company-admin");
  }

  try {
    const passwordHash = await hashPassword(adminPassword);
    const company = await prisma.$transaction(async (tx) => {
      const createdCompany = await tx.company.create({
        data: {
          name: companyName,
          email: companyEmail || null,
          settings: {
            create: defaultCompanySettingsData()
          }
        }
      });

      await tx.user.create({
        data: {
          companyId: createdCompany.id,
          name: adminName,
          email: adminEmail,
          passwordHash,
          role: "COMPANY_ADMIN"
        }
      });

      return createdCompany;
    });

    revalidatePath("/admin");
    revalidatePath("/admin/companies");
    revalidatePath("/admin/users");
    redirect(`/admin/companies/${company.id}?created=1`);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      redirect("/admin/companies?error=admin-email-exists");
    }

    throw error;
  }
}

export async function setCompanyActiveAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const companyId = formString(formData, "companyId");
  const isActive = formString(formData, "isActive") === "true";

  if (!companyId || (companyId === admin.companyId && !isActive)) return;

  await prisma.company.update({
    where: { id: companyId },
    data: { isActive }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/companies");
  revalidatePath(`/admin/companies/${companyId}`);
  revalidatePath("/admin/users");
}

export async function setUserActiveAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const userId = formString(formData, "userId");
  const isActive = formString(formData, "isActive") === "true";

  if (!userId || (userId === admin.id && !isActive)) return;

  await prisma.user.update({
    where: { id: userId },
    data: { isActive }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/companies");
}

export async function resetUserPasswordAction(formData: FormData) {
  await requireSuperAdmin();
  const userId = formString(formData, "userId");
  const password = formString(formData, "password");
  const confirmPassword = formString(formData, "confirmPassword");

  if (!userId || password.length < 8 || password !== confirmPassword) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(password)
    }
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/companies");
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const userId = formString(formData, "userId");

  if (!userId || userId === admin.id) return;

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!user) return;

    await tx.whatsAppSendLog.deleteMany({
      where: { sentByUserId: userId }
    });
    await tx.user.delete({
      where: { id: userId }
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/companies");
}

export async function deleteCompanyAction(formData: FormData) {
  const admin = await requireSuperAdmin();
  const companyId = formString(formData, "companyId");
  const confirmation = formString(formData, "confirmation");

  if (!companyId || companyId === admin.companyId) {
    redirect("/admin/companies?error=delete-system-company");
  }

  let filesToDelete: Array<string | null | undefined> = [];
  let blockedSuperAdminCompany = false;
  let invalidConfirmation = false;

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        settings: { select: { logoUrl: true, chopUrl: true } },
        name: true,
        users: { where: { role: "SUPER_ADMIN" }, select: { id: true }, take: 1 }
      }
    });

    if (!company) return;
    if (confirmation !== company.name) {
      invalidConfirmation = true;
      return;
    }
    if (company.users.length > 0) {
      blockedSuperAdminCompany = true;
      return;
    }

    const [invoicePdfs, quotationPdfs, receiptPdfs] = await Promise.all([
      tx.invoice.findMany({ where: { companyId }, select: { pdfUrl: true } }),
      tx.quotation.findMany({ where: { companyId }, select: { pdfUrl: true } }),
      tx.receipt.findMany({ where: { companyId }, select: { pdfUrl: true } })
    ]);

    filesToDelete = [
      company.settings?.logoUrl,
      company.settings?.chopUrl,
      ...invoicePdfs.map((item) => item.pdfUrl),
      ...quotationPdfs.map((item) => item.pdfUrl),
      ...receiptPdfs.map((item) => item.pdfUrl)
    ];

    await tx.whatsAppSendLog.deleteMany({ where: { companyId } });
    await tx.payment.deleteMany({ where: { companyId } });
    await tx.receipt.deleteMany({ where: { companyId } });
    await tx.invoiceItem.deleteMany({ where: { companyId } });
    await tx.invoice.deleteMany({ where: { companyId } });
    await tx.quotationItem.deleteMany({ where: { companyId } });
    await tx.quotation.deleteMany({ where: { companyId } });
    await tx.customer.deleteMany({ where: { companyId } });
    await tx.documentNumberSequence.deleteMany({ where: { companyId } });
    await tx.companySettings.deleteMany({ where: { companyId } });
    await tx.user.deleteMany({ where: { companyId } });
    await tx.company.delete({ where: { id: companyId } });
  });

  if (blockedSuperAdminCompany) {
    redirect("/admin/companies?error=delete-system-company");
  }
  if (invalidConfirmation) {
    redirect("/admin/companies?error=delete-company-confirmation");
  }

  await Promise.all(filesToDelete.map((file) => deleteFile(file)));
  await deleteFolder(`uploads/company-${companyId}`);

  revalidatePath("/admin");
  revalidatePath("/admin/companies");
  revalidatePath("/admin/users");
  revalidatePath("/admin/documents");
  redirect("/admin/companies?notice=company-deleted");
}
