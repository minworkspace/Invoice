import { DocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { normalizeDocumentTemplateKey } from "@/components/document-templates/template-registry";
import { requireCompanyUser } from "@/lib/auth";
import { ensureCompanySettingsTx } from "@/lib/company-settings";
import { reserveDocumentNumberTx } from "@/lib/numbering";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCompanyUser();
  const { id } = await params;

  const invoice = await prisma.$transaction(async (tx) => {
    const quotation = await tx.quotation.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        invoice: true
      }
    });

    if (!quotation) throw new Error("Quotation not found.");
    if (quotation.invoice) return quotation.invoice;

    const invoiceNumber = await reserveDocumentNumberTx(tx, user.companyId, DocumentType.INVOICE);
    const settings = await ensureCompanySettingsTx(tx, user.companyId);

    return tx.invoice.create({
      data: {
        companyId: user.companyId,
        customerId: quotation.customerId,
        quotationId: quotation.id,
        invoiceNumber,
        status: "DRAFT",
        issueDate: new Date(),
        subtotal: quotation.subtotal,
        total: quotation.total,
        importantNotes: quotation.importantNotes,
        paymentInfo: quotation.paymentInfo,
        remarks: quotation.remarks,
        templateKey: normalizeDocumentTemplateKey(settings.defaultInvoiceTemplate),
        items: {
          create: quotation.items.map((item) => ({
            companyId: user.companyId,
            description: item.description,
            quantity: item.quantity,
            showQuantity: item.showQuantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            sortOrder: item.sortOrder
          }))
        }
      }
    });
  });

  return NextResponse.redirect(new URL(`/invoices/${invoice.id}?created=from-quotation`, request.url), 303);
}
