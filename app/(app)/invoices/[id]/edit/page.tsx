import { notFound, redirect } from "next/navigation";
import { DocumentForm } from "@/components/DocumentForm";
import { normalizeDocumentTemplateKey } from "@/components/document-templates/template-registry";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { dateInput, decimalInput } from "@/lib/format";
import { versionedLogoUrl } from "@/lib/logo-shared";
import {
  formDate,
  formMoney,
  formStatus,
  formString,
  nullableDate,
  nullableString,
  parseLineItems
} from "@/lib/forms";
import { prisma } from "@/lib/prisma";

async function updateInvoiceAction(formData: FormData) {
  "use server";
  const user = await requireUser();
  const id = formString(formData, "id");
  const { items, subtotal, total } = parseLineItems(formData);

  const existing = await prisma.invoice.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, pdfUrl: true }
  });
  if (!existing) throw new Error("Invoice not found.");

  await prisma.$transaction(async (tx) => {
    const customerId = formString(formData, "customerId");
    const customer = await tx.customer.findFirst({ where: { id: customerId, companyId: user.companyId } });
    if (!customer) throw new Error("Customer not found.");

    await tx.invoiceItem.deleteMany({ where: { invoiceId: id, companyId: user.companyId } });
    await tx.invoice.update({
      where: { id },
      data: {
        customerId,
        invoiceNumber: formString(formData, "documentNumber"),
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
        pdfNeedsRegeneration: Boolean(existing.pdfUrl),
        items: {
          create: items.map((item) => ({
            companyId: user.companyId,
            ...item
          }))
        }
      }
    });
  });

  redirect(`/invoices/${id}/edit?saved=1&preview=final`);
}

export default async function EditInvoicePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; preview?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const [invoice, customers] = await Promise.all([
    prisma.invoice.findFirst({
      where: { id, companyId: user.companyId },
      include: { items: { orderBy: { sortOrder: "asc" } } }
    }),
    prisma.customer.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } })
  ]);

  if (!invoice) notFound();
  const settings = user.company.settings;

  return (
    <>
      <PageHeader title={`Edit ${invoice.invoiceNumber}`} eyebrow="Invoice" />
      {query.created || query.saved ? (
        <div className="mb-4 rounded-md border border-[#BBD7C1] bg-[#F0FAF2] px-3 py-2 text-sm text-[#2D6338]">
          {query.created ? "Invoice created. Generate a final PDF preview when you are ready." : "Invoice saved. Review the final PDF preview before sending."}
        </div>
      ) : null}
      <DocumentForm
        action={async (formData) => {
          "use server";
          formData.set("id", invoice.id);
          await updateInvoiceAction(formData);
        }}
        company={{
          name: user.company.name,
          email: user.company.email,
          phone: user.company.phone,
          address: user.company.address,
          logoUrl: versionedLogoUrl(settings?.logoUrl, settings?.updatedAt),
          ssmNumber: settings?.ssmNumber
        }}
        documentId={invoice.id}
        customers={customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          whatsapp: customer.whatsapp,
          address: customer.address
        }))}
        kind="invoice"
        initialPreviewMode={query.preview === "final" ? "final" : "live"}
        pdfNeedsRegeneration={invoice.pdfNeedsRegeneration}
        pdfUrl={invoice.pdfUrl}
        submitLabel="Save invoice"
        initial={{
          documentNumber: invoice.invoiceNumber,
          customerId: invoice.customerId,
          status: invoice.status,
          issueDate: dateInput(invoice.issueDate),
          dueDate: dateInput(invoice.dueDate),
          paidAmount: decimalInput(invoice.paidAmount),
          refundableDeposit: decimalInput(invoice.refundableDeposit),
          importantNotes: invoice.importantNotes || "",
          paymentInfo: invoice.paymentInfo || "",
          remarks: invoice.remarks || "",
          templateKey: invoice.templateKey,
          items: invoice.items.map((item) => ({
            description: item.description,
            quantity: item.showQuantity ? decimalInput(item.quantity) : "",
            unitPrice: decimalInput(item.unitPrice)
          }))
        }}
      />
    </>
  );
}
