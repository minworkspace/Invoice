"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth";
import { formString } from "@/lib/forms";
import { prisma } from "@/lib/prisma";

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
