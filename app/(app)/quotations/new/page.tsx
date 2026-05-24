import { DocumentType } from "@prisma/client";
import { redirect } from "next/navigation";
import { DocumentForm } from "@/components/DocumentForm";
import { normalizeDocumentTemplateKey } from "@/components/document-templates/template-registry";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { formDate, formStatus, formString, nullableDate, nullableString, parseLineItems } from "@/lib/forms";
import { dateInput } from "@/lib/format";
import { getSuggestedDocumentNumber, reserveDocumentNumberTx } from "@/lib/numbering";
import { versionedLogoUrl } from "@/lib/logo-shared";
import { prisma } from "@/lib/prisma";

async function createQuotationAction(formData: FormData) {
  "use server";
  const user = await requireUser();
  const { items, subtotal, total } = parseLineItems(formData);

  const quotation = await prisma.$transaction(async (tx) => {
    const customerId = formString(formData, "customerId");
    const customer = await tx.customer.findFirst({ where: { id: customerId, companyId: user.companyId } });
    if (!customer) throw new Error("Customer not found.");

    const providedNumber = formString(formData, "documentNumber");
    const quotationNumber = providedNumber || (await reserveDocumentNumberTx(tx, user.companyId, DocumentType.QUOTATION));

    return tx.quotation.create({
      data: {
        companyId: user.companyId,
        customerId,
        quotationNumber,
        status: formStatus(formData),
        issueDate: formDate(formData, "issueDate"),
        validUntil: nullableDate(formData, "validUntil"),
        subtotal,
        total,
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

  redirect(`/quotations/${quotation.id}/edit?created=1&preview=final`);
}

export default async function NewQuotationPage() {
  const user = await requireUser();
  const [customers, suggestedNumber] = await Promise.all([
    prisma.customer.findMany({ where: { companyId: user.companyId }, orderBy: { name: "asc" } }),
    getSuggestedDocumentNumber(user.companyId, DocumentType.QUOTATION)
  ]);
  const settings = user.company.settings;

  return (
    <>
      <PageHeader title="New quotation" eyebrow="Documents" />
      <DocumentForm
        action={createQuotationAction}
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
        kind="quotation"
        submitLabel="Create quotation"
        suggestedNumber={suggestedNumber}
        initial={{
          issueDate: dateInput(new Date()),
          importantNotes: settings?.defaultImportantNotes || "",
          paymentInfo: settings?.paymentInfo || "",
          remarks: settings?.defaultRemarks || "",
          templateKey: settings?.defaultQuotationTemplate || "classic"
        }}
      />
    </>
  );
}
