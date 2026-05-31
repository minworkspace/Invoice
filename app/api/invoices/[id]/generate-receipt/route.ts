import { DocumentType } from "@prisma/client";
import { normalizeDocumentTemplateKey } from "@/components/document-templates/template-registry";
import { requireCompanyUser } from "@/lib/auth";
import { ensureCompanySettingsTx } from "@/lib/company-settings";
import { reserveDocumentNumberTx } from "@/lib/numbering";
import { prisma } from "@/lib/prisma";
import { localRedirect } from "@/lib/redirect-response";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCompanyUser();
  const { id } = await params;

  const receipt = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id, companyId: user.companyId },
      include: { receipt: true }
    });

    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.receipt) return invoice.receipt;

    const receiptNumber = await reserveDocumentNumberTx(tx, user.companyId, DocumentType.RECEIPT);
    const amount = invoice.paidAmount.toString() === "0" ? invoice.total : invoice.paidAmount;
    const settings = await ensureCompanySettingsTx(tx, user.companyId);

    const newReceipt = await tx.receipt.create({
      data: {
        companyId: user.companyId,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        receiptNumber,
        status: "PAID",
        receiptDate: new Date(),
        amount,
        paymentMethod: "Manual",
        notes: `Receipt generated from invoice ${invoice.invoiceNumber}.`,
        templateKey: normalizeDocumentTemplateKey(settings.defaultReceiptTemplate),
        payments: {
          create: {
            companyId: user.companyId,
            customerId: invoice.customerId,
            invoiceId: invoice.id,
            amount,
            paidAt: new Date(),
            method: "Manual"
          }
        }
      }
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: amount,
        status: "PAID"
      }
    });

    return newReceipt;
  });

  return localRedirect(`/receipts/${receipt.id}?created=from-invoice`);
}
