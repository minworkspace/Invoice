import { notFound, redirect } from "next/navigation";
import { DocumentForm } from "@/components/DocumentForm";
import { normalizeDocumentTemplateKey } from "@/components/document-templates/template-registry";
import { PageHeader } from "@/components/PageHeader";
import { requireCompanyUser } from "@/lib/auth";
import { dateInput, decimalInput } from "@/lib/format";
import { versionedLogoUrl } from "@/lib/logo-shared";
import { formDate, formStatus, formString, nullableDate, nullableString, parseLineItems } from "@/lib/forms";
import { prisma } from "@/lib/prisma";
import { ensureCompanySettings } from "@/lib/company-settings";

async function updateQuotationAction(formData: FormData) {
  "use server";
  const user = await requireCompanyUser();
  const id = formString(formData, "id");
  const { items, subtotal, total } = parseLineItems(formData);

  const existing = await prisma.quotation.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, pdfUrl: true }
  });
  if (!existing) throw new Error("Quotation not found.");

  await prisma.$transaction(async (tx) => {
    const customerId = formString(formData, "customerId");
    const customer = await tx.customer.findFirst({ where: { id: customerId, companyId: user.companyId } });
    if (!customer) throw new Error("Customer not found.");

    await tx.quotationItem.deleteMany({ where: { quotationId: id, companyId: user.companyId } });
    await tx.quotation.update({
      where: { id },
      data: {
        customerId,
        quotationNumber: formString(formData, "documentNumber"),
        status: formStatus(formData),
        issueDate: formDate(formData, "issueDate"),
        validUntil: nullableDate(formData, "validUntil"),
        subtotal,
        total,
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

  redirect(`/quotations/${id}/edit?saved=1&preview=final`);
}

export default async function EditQuotationPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; preview?: string }>;
}) {
  const user = await requireCompanyUser();
  const { id } = await params;
  const query = await searchParams;
  const [quotation, customers, settings] = await Promise.all([
    prisma.quotation.findFirst({
      where: { id, companyId: user.companyId },
      include: { items: { orderBy: { sortOrder: "asc" } } }
    }),
    prisma.customer.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } }),
    ensureCompanySettings(user.companyId)
  ]);

  if (!quotation) notFound();

  return (
    <>
      <PageHeader title={`Edit ${quotation.quotationNumber}`} eyebrow="Quotation" />
      {query.created || query.saved ? (
        <div className="mb-4 rounded-md border border-[#BBD7C1] bg-[#F0FAF2] px-3 py-2 text-sm text-[#2D6338]">
          {query.created ? "Quotation created. Generate a final PDF preview when you are ready." : "Quotation saved. Review the final PDF preview before sending."}
        </div>
      ) : null}
      <input type="hidden" name="id" value={quotation.id} />
      <DocumentForm
        action={async (formData) => {
          "use server";
          formData.set("id", quotation.id);
          await updateQuotationAction(formData);
        }}
        company={{
          name: user.company.name,
          email: user.company.email,
          phone: user.company.phone,
          address: user.company.address,
          logoUrl: versionedLogoUrl(settings?.logoUrl, settings?.updatedAt),
          ssmNumber: settings?.ssmNumber
        }}
        documentId={quotation.id}
        customers={customers.map((customer) => ({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          whatsapp: customer.whatsapp,
          address: customer.address
        }))}
        kind="quotation"
        initialPreviewMode={query.preview === "final" ? "final" : "live"}
        pdfNeedsRegeneration={quotation.pdfNeedsRegeneration}
        pdfUrl={quotation.pdfUrl}
        submitLabel="Save quotation"
        initial={{
          documentNumber: quotation.quotationNumber,
          customerId: quotation.customerId,
          status: quotation.status,
          issueDate: dateInput(quotation.issueDate),
          validUntil: dateInput(quotation.validUntil),
          importantNotes: quotation.importantNotes || "",
          paymentInfo: quotation.paymentInfo || "",
          remarks: quotation.remarks || "",
          templateKey: quotation.templateKey,
          items: quotation.items.map((item) => ({
            description: item.description,
            quantity: item.showQuantity ? decimalInput(item.quantity) : "",
            unitPrice: decimalInput(item.unitPrice)
          }))
        }}
      />
    </>
  );
}
