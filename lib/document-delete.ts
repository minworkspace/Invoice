import "server-only";

import { DocumentType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { releaseDocumentNumberIfLatestDraftTx } from "@/lib/numbering";
import { deleteFile } from "@/lib/storage";

type DeleteResult = {
  deleted: boolean;
};

type Tx = Prisma.TransactionClient;

async function cleanupPdfFiles(urls: Array<string | null | undefined>) {
  await Promise.all(
    urls.map((url) => deleteFile(url))
  );
}

async function deleteQuotationTx(tx: Tx, companyId: string, id: string) {
  const quotation = await tx.quotation.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      quotationNumber: true,
      status: true,
      pdfUrl: true
    }
  });

  if (!quotation) return { deleted: false, pdfUrls: [] as Array<string | null> };

  await tx.quotation.delete({
    where: { id: quotation.id }
  });

  await releaseDocumentNumberIfLatestDraftTx(
    tx,
    companyId,
    DocumentType.QUOTATION,
    quotation.quotationNumber,
    quotation.status
  );

  return { deleted: true, pdfUrls: [quotation.pdfUrl] };
}

async function deleteReceiptTx(tx: Tx, companyId: string, id: string) {
  const receipt = await tx.receipt.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      receiptNumber: true,
      status: true,
      pdfUrl: true
    }
  });

  if (!receipt) return { deleted: false, pdfUrls: [] as Array<string | null> };

  await tx.receipt.delete({
    where: { id: receipt.id }
  });

  await releaseDocumentNumberIfLatestDraftTx(
    tx,
    companyId,
    DocumentType.RECEIPT,
    receipt.receiptNumber,
    receipt.status
  );

  return { deleted: true, pdfUrls: [receipt.pdfUrl] };
}

async function deleteInvoiceTx(tx: Tx, companyId: string, id: string) {
  const invoice = await tx.invoice.findFirst({
    where: { id, companyId },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      pdfUrl: true,
      receipt: {
        select: {
          id: true,
          receiptNumber: true,
          status: true,
          pdfUrl: true
        }
      }
    }
  });

  if (!invoice) return { deleted: false, pdfUrls: [] as Array<string | null> };

  if (invoice.receipt) {
    await tx.receipt.delete({
      where: { id: invoice.receipt.id }
    });

    await releaseDocumentNumberIfLatestDraftTx(
      tx,
      companyId,
      DocumentType.RECEIPT,
      invoice.receipt.receiptNumber,
      invoice.receipt.status
    );
  }

  await tx.invoice.delete({
    where: { id: invoice.id }
  });

  await releaseDocumentNumberIfLatestDraftTx(
    tx,
    companyId,
    DocumentType.INVOICE,
    invoice.invoiceNumber,
    invoice.status
  );

  return { deleted: true, pdfUrls: [invoice.pdfUrl, invoice.receipt?.pdfUrl] };
}

export async function deleteQuotationDocument(companyId: string, id: string): Promise<DeleteResult> {
  const result = await prisma.$transaction((tx) => deleteQuotationTx(tx, companyId, id));
  await cleanupPdfFiles(result.pdfUrls);
  return { deleted: result.deleted };
}

export async function deleteInvoiceDocument(companyId: string, id: string): Promise<DeleteResult> {
  const result = await prisma.$transaction((tx) => deleteInvoiceTx(tx, companyId, id));
  await cleanupPdfFiles(result.pdfUrls);
  return { deleted: result.deleted };
}

export async function deleteReceiptDocument(companyId: string, id: string): Promise<DeleteResult> {
  const result = await prisma.$transaction((tx) => deleteReceiptTx(tx, companyId, id));
  await cleanupPdfFiles(result.pdfUrls);
  return { deleted: result.deleted };
}
