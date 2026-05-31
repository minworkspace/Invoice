import { notFound, redirect } from "next/navigation";
import { ReceiptForm } from "@/components/ReceiptForm";
import { normalizeDocumentTemplateKey } from "@/components/document-templates/template-registry";
import { PageHeader } from "@/components/PageHeader";
import { requireCompanyUser } from "@/lib/auth";
import { dateInput, decimalInput } from "@/lib/format";
import { formDate, formMoney, formStatus, formString, nullableString } from "@/lib/forms";
import { versionedLogoUrl } from "@/lib/logo-shared";
import { prisma } from "@/lib/prisma";
import { ensureCompanySettings } from "@/lib/company-settings";

async function updateReceiptAction(formData: FormData) {
  "use server";
  const user = await requireCompanyUser();
  const id = formString(formData, "id");

  const existing = await prisma.receipt.findFirst({
    where: { id, companyId: user.companyId },
    select: { id: true, pdfUrl: true }
  });
  if (!existing) throw new Error("Receipt not found.");

  await prisma.receipt.update({
    where: { id },
    data: {
      receiptNumber: formString(formData, "receiptNumber"),
      status: formStatus(formData),
      receiptDate: formDate(formData, "receiptDate"),
      amount: formMoney(formData, "amount"),
      paymentMethod: nullableString(formData, "paymentMethod"),
      notes: nullableString(formData, "notes"),
      templateKey: normalizeDocumentTemplateKey(formData.get("templateKey")),
      pdfNeedsRegeneration: Boolean(existing.pdfUrl)
    }
  });

  redirect(`/receipts/${id}/edit?saved=1&preview=final`);
}

export default async function EditReceiptPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; preview?: string }>;
}) {
  const user = await requireCompanyUser();
  const { id } = await params;
  const query = await searchParams;
  const [receipt, settings] = await Promise.all([
    prisma.receipt.findFirst({
      where: { id, companyId: user.companyId },
      include: {
        company: true,
        customer: true,
        invoice: {
          include: {
            items: { orderBy: { sortOrder: "asc" } }
          }
        }
      }
    }),
    ensureCompanySettings(user.companyId)
  ]);

  if (!receipt) notFound();

  return (
    <>
      <PageHeader title={`Edit ${receipt.receiptNumber}`} eyebrow="Receipt" />
      {query.saved ? (
        <div className="mb-4 rounded-md border border-[#BBD7C1] bg-[#F0FAF2] px-3 py-2 text-sm text-[#2D6338]">
          Receipt saved. Review the final PDF preview before sending.
        </div>
      ) : null}
      <ReceiptForm
        action={async (formData) => {
          "use server";
          formData.set("id", receipt.id);
          await updateReceiptAction(formData);
        }}
        initialPreviewMode={query.preview === "final" ? "final" : "live"}
        documentId={receipt.id}
        pdfNeedsRegeneration={receipt.pdfNeedsRegeneration}
        pdfUrl={receipt.pdfUrl}
        company={{
          name: receipt.company.name,
          email: receipt.company.email,
          phone: receipt.company.phone,
          address: receipt.company.address,
          logoUrl: versionedLogoUrl(settings?.logoUrl, settings?.updatedAt),
          chopUrl: versionedLogoUrl(settings?.chopUrl, settings?.updatedAt),
          ssmNumber: settings?.ssmNumber,
          paymentInfo: settings?.paymentInfo,
          importantNotes: settings?.defaultImportantNotes
        }}
        customer={{
          name: receipt.customer.name,
          phone: receipt.customer.phone,
          address: receipt.customer.address
        }}
        invoice={{
          invoiceNumber: receipt.invoice.invoiceNumber,
          total: decimalInput(receipt.invoice.total),
          refundableDeposit: decimalInput(receipt.invoice.refundableDeposit),
          items: receipt.invoice.items.map((item) => ({
            description: item.description,
            lineTotal: decimalInput(item.lineTotal)
          }))
        }}
        initial={{
          receiptNumber: receipt.receiptNumber,
          receiptDate: dateInput(receipt.receiptDate),
          status: receipt.status,
          amount: decimalInput(receipt.amount),
          paymentMethod: receipt.paymentMethod,
          notes: receipt.notes,
          templateKey: receipt.templateKey
        }}
      />
    </>
  );
}
