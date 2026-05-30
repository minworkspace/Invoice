import { DocumentType } from "@prisma/client";
import { redirect } from "next/navigation";
import { DocumentForm } from "@/components/DocumentForm";
import { normalizeDocumentTemplateKey } from "@/components/document-templates/template-registry";
import { PageHeader } from "@/components/PageHeader";
import { requireCompanyUser } from "@/lib/auth";
import { dateInput } from "@/lib/format";
import {
  formDate,
  formMoney,
  formStatus,
  formString,
  nullableDate,
  nullableString,
  parseLineItems
} from "@/lib/forms";
import { getSuggestedDocumentNumber, reserveDocumentNumberTx } from "@/lib/numbering";
import { versionedLogoUrl } from "@/lib/logo-shared";
import { prisma } from "@/lib/prisma";
import { ensureCompanySettings } from "@/lib/company-settings";

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
  );
}

async function createInvoiceAction(formData: FormData) {
  "use server";
  const user = await requireCompanyUser();
  const { items, subtotal, total } = parseLineItems(formData);
  let createdInvoiceId = "";

  try {
    const invoice = await prisma.$transaction(async (tx) => {
      const customerId = formString(formData, "customerId");
      const customer = await tx.customer.findFirst({ where: { id: customerId, companyId: user.companyId } });
      if (!customer) throw new Error("Customer not found.");

      const providedNumber = formString(formData, "documentNumber");
      const existingNumber = providedNumber
        ? await tx.invoice.findFirst({
            where: { companyId: user.companyId, invoiceNumber: providedNumber },
            select: { id: true }
          })
        : null;
      if (existingNumber) throw new Error("DUPLICATE_INVOICE_NUMBER");

      const invoiceNumber = providedNumber || (await reserveDocumentNumberTx(tx, user.companyId, DocumentType.INVOICE));

      return tx.invoice.create({
        data: {
          companyId: user.companyId,
          customerId,
          invoiceNumber,
          status: formStatus(formData),
          issueDate: formDate(formData, "issueDate"),
          dueDate: nullableDate(formData, "dueDate"),
          subtotal,
          total,
          paidAmount: formMoney(formData, "paidAmount"),
          refundableDeposit: formMoney(formData, "refundableDeposit"),
          importantNotes: nullableString(formData, "importantNotes"),
          paymentInfo: nullableString(formData, "paymentInfo"),
          remarks: nullableString(formData, "remarks"),
          templateKey: normalizeDocumentTemplateKey(formData.get("templateKey")),
          items: {
            create: items.map((item) => ({
              companyId: user.companyId,
              ...item
            }))
          }
        }
      });
    });

    createdInvoiceId = invoice.id;
  } catch (error) {
    if (error instanceof Error && error.message === "DUPLICATE_INVOICE_NUMBER") {
      redirect("/invoices/new?error=duplicate-number");
    }

    if (isUniqueConstraintError(error)) {
      redirect("/invoices/new?error=duplicate-number");
    }

    throw error;
  }

  redirect(`/invoices/${createdInvoiceId}/edit?created=1&preview=final`);
}

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireCompanyUser();
  const query = await searchParams;
  const [customers, suggestedNumber, settings] = await Promise.all([
    prisma.customer.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } }),
    getSuggestedDocumentNumber(user.companyId, DocumentType.INVOICE),
    ensureCompanySettings(user.companyId)
  ]);

  return (
    <>
      <PageHeader title="New invoice" eyebrow="Documents" />
      {query.error === "duplicate-number" ? (
        <div className="mb-4 rounded-md border border-[#CFAE43]/30 bg-[#FFF8DF] px-3 py-2 text-sm text-[#765B00]">
          That invoice number already exists. Leave the number blank to use the next available number, or enter a unique invoice number.
        </div>
      ) : null}
      <DocumentForm
        action={createInvoiceAction}
        company={{
          name: user.company.name,
          email: user.company.email,
          phone: user.company.phone,
          address: user.company.address,
          logoUrl: versionedLogoUrl(settings?.logoUrl, settings?.updatedAt),
          ssmNumber: settings?.ssmNumber
        }}
        customers={customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          whatsapp: customer.whatsapp,
          address: customer.address
        }))}
        kind="invoice"
        submitLabel="Create invoice"
        suggestedNumber={suggestedNumber}
        initial={{
          issueDate: dateInput(new Date()),
          importantNotes: settings?.defaultImportantNotes || "",
          paymentInfo: settings?.paymentInfo || "",
          remarks: settings?.defaultRemarks || "",
          templateKey: settings?.defaultInvoiceTemplate || "classic"
        }}
      />
    </>
  );
}
