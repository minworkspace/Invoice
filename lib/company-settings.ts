import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export function defaultCompanySettingsData() {
  return {
    invoicePrefix: "INV-",
    invoiceStartNumber: 1,
    quotationPrefix: "QUO-",
    quotationStartNumber: 1,
    receiptPrefix: "REC-",
    receiptStartNumber: 1,
    documentNumberPadding: 5,
    defaultInvoiceTemplate: "classic",
    defaultQuotationTemplate: "classic",
    defaultReceiptTemplate: "classic"
  };
}

export async function ensureCompanySettings(companyId: string) {
  return prisma.companySettings.upsert({
    where: { companyId },
    update: {},
    create: {
      companyId,
      ...defaultCompanySettingsData()
    }
  });
}

export async function ensureCompanySettingsTx(tx: Prisma.TransactionClient, companyId: string) {
  return tx.companySettings.upsert({
    where: { companyId },
    update: {},
    create: {
      companyId,
      ...defaultCompanySettingsData()
    }
  });
}
