import "server-only";

import { DocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type NumberSettings = {
  prefix: string;
  startNumber: number;
};

type Tx = Prisma.TransactionClient;
type NumberLookupDb = {
  invoice: {
    findFirst(args: Prisma.InvoiceFindFirstArgs): Promise<unknown>;
  };
  quotation: {
    findFirst(args: Prisma.QuotationFindFirstArgs): Promise<unknown>;
  };
  receipt: {
    findFirst(args: Prisma.ReceiptFindFirstArgs): Promise<unknown>;
  };
};

function settingsForType(
  settings: {
    invoicePrefix: string;
    invoiceStartNumber: number;
    quotationPrefix: string;
    quotationStartNumber: number;
    receiptPrefix: string;
    receiptStartNumber: number;
  },
  documentType: DocumentType
): NumberSettings {
  if (documentType === DocumentType.INVOICE) {
    return { prefix: settings.invoicePrefix, startNumber: settings.invoiceStartNumber };
  }

  if (documentType === DocumentType.QUOTATION) {
    return { prefix: settings.quotationPrefix, startNumber: settings.quotationStartNumber };
  }

  return { prefix: settings.receiptPrefix, startNumber: settings.receiptStartNumber };
}

function formatDocumentNumber(prefix: string, currentNumber: number, padding: number) {
  return `${prefix}${String(currentNumber).padStart(padding, "0")}`;
}

function parseDocumentNumberValue(documentNumber: string) {
  const match = documentNumber.match(/(\d+)\s*$/);
  if (!match) return null;

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

async function documentNumberExists(
  db: NumberLookupDb,
  companyId: string,
  documentType: DocumentType,
  documentNumber: string
) {
  if (documentType === DocumentType.INVOICE) {
    return Boolean(
      await db.invoice.findFirst({
        where: { companyId, invoiceNumber: documentNumber },
        select: { id: true }
      })
    );
  }

  if (documentType === DocumentType.QUOTATION) {
    return Boolean(
      await db.quotation.findFirst({
        where: { companyId, quotationNumber: documentNumber },
        select: { id: true }
      })
    );
  }

  return Boolean(
    await db.receipt.findFirst({
      where: { companyId, receiptNumber: documentNumber },
      select: { id: true }
    })
  );
}

async function nextUnusedDocumentNumber(
  db: NumberLookupDb,
  companyId: string,
  documentType: DocumentType,
  prefix: string,
  currentNumber: number,
  padding: number
) {
  for (let attempts = 0; attempts < 1000; attempts += 1) {
    const candidate = formatDocumentNumber(prefix, currentNumber + attempts, padding);
    if (!(await documentNumberExists(db, companyId, documentType, candidate))) return candidate;
  }

  throw new Error("Could not find an unused document number.");
}

export async function getSuggestedDocumentNumber(companyId: string, documentType: DocumentType) {
  const settings = await prisma.companySettings.findUniqueOrThrow({
    where: { companyId }
  });
  const sequence = await prisma.documentNumberSequence.findUnique({
    where: {
      companyId_documentType: {
        companyId,
        documentType
      }
    }
  });
  const config = settingsForType(settings, documentType);
  const nextNumber = sequence ? sequence.currentNumber + 1 : config.startNumber;

  return nextUnusedDocumentNumber(prisma, companyId, documentType, config.prefix, nextNumber, settings.documentNumberPadding);
}

export async function reserveDocumentNumberTx(
  tx: Tx,
  companyId: string,
  documentType: DocumentType
) {
  const settings = await tx.companySettings.findUniqueOrThrow({
    where: { companyId }
  });
  const config = settingsForType(settings, documentType);

  let sequence = await tx.documentNumberSequence.upsert({
    where: {
      companyId_documentType: {
        companyId,
        documentType
      }
    },
    update: {
      currentNumber: {
        increment: 1
      }
    },
    create: {
      companyId,
      documentType,
      currentNumber: config.startNumber
    }
  });

  for (let attempts = 0; attempts < 1000; attempts += 1) {
    const candidate = formatDocumentNumber(config.prefix, sequence.currentNumber, settings.documentNumberPadding);
    if (!(await documentNumberExists(tx, companyId, documentType, candidate))) return candidate;

    sequence = await tx.documentNumberSequence.update({
      where: { id: sequence.id },
      data: {
        currentNumber: {
          increment: 1
        }
      }
    });
  }

  throw new Error("Could not reserve an unused document number.");
}

export async function reserveDocumentNumber(companyId: string, documentType: DocumentType) {
  return prisma.$transaction((tx) => reserveDocumentNumberTx(tx, companyId, documentType));
}

export async function releaseDocumentNumberIfLatestDraftTx(
  tx: Tx,
  companyId: string,
  documentType: DocumentType,
  documentNumber: string,
  status: string
) {
  if (status !== "DRAFT") return;

  const settings = await tx.companySettings.findUniqueOrThrow({
    where: { companyId }
  });
  const config = settingsForType(settings, documentType);
  const deletedValue = parseDocumentNumberValue(documentNumber);

  if (deletedValue === null) return;

  const sequence = await tx.documentNumberSequence.findUnique({
    where: {
      companyId_documentType: {
        companyId,
        documentType
      }
    }
  });

  if (!sequence || sequence.currentNumber !== deletedValue) return;

  await tx.documentNumberSequence.update({
    where: { id: sequence.id },
    data: {
      currentNumber: Math.max(config.startNumber - 1, sequence.currentNumber - 1)
    }
  });
}
