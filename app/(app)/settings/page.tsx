import { redirect } from "next/navigation";
import { documentTemplateOptions, normalizeDocumentTemplateKey } from "@/components/document-templates/template-registry";
import { CompanyImageField } from "@/components/CompanyImageField";
import { PageHeader } from "@/components/PageHeader";
import { requireCompanyUser } from "@/lib/auth";
import { ensureCompanySettings } from "@/lib/company-settings";
import { formString, nullableString } from "@/lib/forms";
import { companyAssetStatus, deleteManagedAssetFile, saveCompanyChop, saveCompanyLogo } from "@/lib/logo";
import { versionedLogoUrl } from "@/lib/logo-shared";
import { prisma } from "@/lib/prisma";

async function updateSettingsAction(formData: FormData) {
  "use server";
  const user = await requireCompanyUser();
  const nextCompanyName = formString(formData, "companyName");
  const nextCompanyEmail = nullableString(formData, "companyEmail");
  const nextCompanyPhone = nullableString(formData, "companyPhone");
  const nextCompanyAddress = nullableString(formData, "companyAddress");
  const nextSsmNumber = nullableString(formData, "ssmNumber");
  const nextInvoicePrefix = formString(formData, "invoicePrefix", "INV-");
  const nextInvoiceStartNumber = Number(formString(formData, "invoiceStartNumber", "1"));
  const nextQuotationPrefix = formString(formData, "quotationPrefix", "QUO-");
  const nextQuotationStartNumber = Number(formString(formData, "quotationStartNumber", "1"));
  const nextReceiptPrefix = formString(formData, "receiptPrefix", "REC-");
  const nextReceiptStartNumber = Number(formString(formData, "receiptStartNumber", "1"));
  const nextNumberPadding = Number(formString(formData, "documentNumberPadding", "5"));
  const nextPaymentInfo = nullableString(formData, "paymentInfo");
  const nextDefaultImportantNotes = nullableString(formData, "defaultImportantNotes");
  const nextDefaultRemarks = nullableString(formData, "defaultRemarks");
  const nextDefaultInvoiceTemplate = normalizeDocumentTemplateKey(formData.get("defaultInvoiceTemplate"));
  const nextDefaultQuotationTemplate = normalizeDocumentTemplateKey(formData.get("defaultQuotationTemplate"));
  const nextDefaultReceiptTemplate = normalizeDocumentTemplateKey(formData.get("defaultReceiptTemplate"));
  const currentSettings = await prisma.companySettings.findUnique({
    where: { companyId: user.companyId }
  });
  const uploadedLogo = formData.get("logo");
  const uploadedChop = formData.get("chop");
  const removeLogo = formData.get("removeLogo") === "1";
  const removeChop = formData.get("removeChop") === "1";
  let nextLogoUrl = currentSettings?.logoUrl ?? null;
  let nextChopUrl = currentSettings?.chopUrl ?? null;
  const filesToDeleteAfterSave: Array<string | null | undefined> = [];
  const newFilesToRollback: Array<string | null | undefined> = [];

  try {
    if (uploadedLogo instanceof File && uploadedLogo.size > 0) {
      const savedLogoUrl = await saveCompanyLogo(user.companyId, uploadedLogo);
      if (savedLogoUrl) {
        newFilesToRollback.push(savedLogoUrl);
        filesToDeleteAfterSave.push(currentSettings?.logoUrl);
        nextLogoUrl = savedLogoUrl;
      }
    } else if (removeLogo && currentSettings?.logoUrl) {
      filesToDeleteAfterSave.push(currentSettings.logoUrl);
      nextLogoUrl = null;
    }

    if (uploadedChop instanceof File && uploadedChop.size > 0) {
      const savedChopUrl = await saveCompanyChop(user.companyId, uploadedChop);
      if (savedChopUrl) {
        newFilesToRollback.push(savedChopUrl);
        filesToDeleteAfterSave.push(currentSettings?.chopUrl);
        nextChopUrl = savedChopUrl;
      }
    } else if (removeChop && currentSettings?.chopUrl) {
      filesToDeleteAfterSave.push(currentSettings.chopUrl);
      nextChopUrl = null;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Logo upload failed.";
    redirect(`/settings?error=${encodeURIComponent(message)}`);
  }

  try {
    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        name: nextCompanyName,
        email: nextCompanyEmail,
        phone: nextCompanyPhone,
        address: nextCompanyAddress,
        settings: {
          upsert: {
            create: {
              logoUrl: nextLogoUrl,
              chopUrl: nextChopUrl,
              ssmNumber: nextSsmNumber,
              invoicePrefix: nextInvoicePrefix,
              invoiceStartNumber: nextInvoiceStartNumber,
              quotationPrefix: nextQuotationPrefix,
              quotationStartNumber: nextQuotationStartNumber,
              receiptPrefix: nextReceiptPrefix,
              receiptStartNumber: nextReceiptStartNumber,
              documentNumberPadding: nextNumberPadding,
              paymentInfo: nextPaymentInfo,
              defaultImportantNotes: nextDefaultImportantNotes,
              defaultRemarks: nextDefaultRemarks,
              defaultInvoiceTemplate: nextDefaultInvoiceTemplate,
              defaultQuotationTemplate: nextDefaultQuotationTemplate,
              defaultReceiptTemplate: nextDefaultReceiptTemplate
            },
            update: {
              logoUrl: nextLogoUrl,
              chopUrl: nextChopUrl,
              ssmNumber: nextSsmNumber,
              invoicePrefix: nextInvoicePrefix,
              invoiceStartNumber: nextInvoiceStartNumber,
              quotationPrefix: nextQuotationPrefix,
              quotationStartNumber: nextQuotationStartNumber,
              receiptPrefix: nextReceiptPrefix,
              receiptStartNumber: nextReceiptStartNumber,
              documentNumberPadding: nextNumberPadding,
              paymentInfo: nextPaymentInfo,
              defaultImportantNotes: nextDefaultImportantNotes,
              defaultRemarks: nextDefaultRemarks,
              defaultInvoiceTemplate: nextDefaultInvoiceTemplate,
              defaultQuotationTemplate: nextDefaultQuotationTemplate,
              defaultReceiptTemplate: nextDefaultReceiptTemplate
            }
          }
        }
      }
    });
  } catch (error) {
    await Promise.all(newFilesToRollback.map((file) => deleteManagedAssetFile(file)));
    throw error;
  }

  await Promise.all(
    filesToDeleteAfterSave
      .filter((file) => file && file !== nextLogoUrl && file !== nextChopUrl)
      .map((file) => deleteManagedAssetFile(file))
  );

  const companyHeaderChanged =
    nextCompanyName !== user.company.name ||
    nextCompanyEmail !== (user.company.email ?? null) ||
    nextCompanyPhone !== (user.company.phone ?? null) ||
    nextCompanyAddress !== (user.company.address ?? null) ||
    nextLogoUrl !== currentSettings?.logoUrl ||
    nextChopUrl !== currentSettings?.chopUrl ||
    nextSsmNumber !== (currentSettings?.ssmNumber ?? null);

  if (companyHeaderChanged) {
    await prisma.$transaction([
      prisma.invoice.updateMany({
        where: { companyId: user.companyId, pdfUrl: { not: null } },
        data: { pdfNeedsRegeneration: true }
      }),
      prisma.quotation.updateMany({
        where: { companyId: user.companyId, pdfUrl: { not: null } },
        data: { pdfNeedsRegeneration: true }
      }),
      prisma.receipt.updateMany({
        where: { companyId: user.companyId, pdfUrl: { not: null } },
        data: { pdfNeedsRegeneration: true }
      })
    ]);
  }

  redirect("/settings?saved=1");
}

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const user = await requireCompanyUser();
  const params = await searchParams;
  const settings = await ensureCompanySettings(user.companyId);
  const logoStatus = companyAssetStatus(settings?.logoUrl);
  const chopStatus = companyAssetStatus(settings?.chopUrl);

  return (
    <>
      <PageHeader title="Company settings" eyebrow="Numbering and defaults" />
      {params?.saved ? (
        <div className="mb-4 rounded-md border border-[#4C9A68]/25 bg-[#E9F7EE] px-3 py-2 text-sm text-[#2F7047]">
          Settings saved.
        </div>
      ) : null}
      {params?.error ? (
        <div className="mb-4 rounded-md border border-[#B64545]/30 bg-[#FDECEC] px-3 py-2 text-sm text-[#9D3838]">
          {params.error}
        </div>
      ) : null}
      {settings?.logoUrl && (!logoStatus.exists || !logoStatus.pdfEmbeddable) ? (
        <div className="mb-4 rounded-md border border-[#CFAE43]/30 bg-[#FFF8DF] px-3 py-2 text-sm text-[#765B00]">
          This logo may not appear in generated PDFs because the file is {logoStatus.exists ? "not PDF-compatible" : "missing from storage"}.
          Re-upload the logo as PNG or JPG, then regenerate affected PDFs.
        </div>
      ) : null}
      {settings?.chopUrl && (!chopStatus.exists || !chopStatus.pdfEmbeddable) ? (
        <div className="mb-4 rounded-md border border-[#CFAE43]/30 bg-[#FFF8DF] px-3 py-2 text-sm text-[#765B00]">
          This chop/stamp may not appear in generated PDFs because the file is {chopStatus.exists ? "not PDF-compatible" : "missing from storage"}.
          Re-upload it as PNG or JPG, then regenerate affected receipts.
        </div>
      ) : null}
      <form action={updateSettingsAction} className="space-y-6">
        <section className="panel grid gap-4 lg:grid-cols-2">
          <label>
            <span className="label">Company name</span>
            <input className="field" name="companyName" defaultValue={user.company.name} required />
          </label>
          <label>
            <span className="label">Company email</span>
            <input className="field" name="companyEmail" type="email" defaultValue={user.company.email || ""} />
          </label>
          <label>
            <span className="label">Company phone</span>
            <input className="field" name="companyPhone" defaultValue={user.company.phone || ""} />
          </label>
          <label>
            <span className="label">SSM / registration number</span>
            <input className="field" name="ssmNumber" defaultValue={settings?.ssmNumber || ""} />
          </label>
          <label className="lg:col-span-2">
            <span className="label">Company address</span>
            <textarea className="field min-h-28" name="companyAddress" defaultValue={user.company.address || ""} />
          </label>
          <div className="lg:col-span-2">
            <CompanyImageField
              companyName={user.company.name}
              existingImageUrl={versionedLogoUrl(settings?.logoUrl, settings?.updatedAt)}
              kind="logo"
            />
          </div>
          <div className="lg:col-span-2">
            <CompanyImageField
              companyName={user.company.name}
              existingImageUrl={versionedLogoUrl(settings?.chopUrl, settings?.updatedAt)}
              kind="chop"
            />
          </div>
        </section>

        <section className="panel grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          <label>
            <span className="label">Invoice prefix</span>
            <input className="field" name="invoicePrefix" defaultValue={settings?.invoicePrefix || "INV-"} />
          </label>
          <label>
            <span className="label">Invoice start</span>
            <input className="field" name="invoiceStartNumber" type="number" defaultValue={settings?.invoiceStartNumber || 1} />
          </label>
          <label>
            <span className="label">Quotation prefix</span>
            <input className="field" name="quotationPrefix" defaultValue={settings?.quotationPrefix || "QUO-"} />
          </label>
          <label>
            <span className="label">Quotation start</span>
            <input className="field" name="quotationStartNumber" type="number" defaultValue={settings?.quotationStartNumber || 1} />
          </label>
          <label>
            <span className="label">Receipt prefix</span>
            <input className="field" name="receiptPrefix" defaultValue={settings?.receiptPrefix || "REC-"} />
          </label>
          <label>
            <span className="label">Receipt start</span>
            <input className="field" name="receiptStartNumber" type="number" defaultValue={settings?.receiptStartNumber || 1} />
          </label>
          <label>
            <span className="label">Number padding</span>
            <input className="field" name="documentNumberPadding" type="number" min={1} max={12} defaultValue={settings?.documentNumberPadding || 5} />
          </label>
        </section>

        <section className="panel grid gap-4 lg:grid-cols-3">
          <label>
            <span className="label">Default invoice template</span>
            <select className="field" name="defaultInvoiceTemplate" defaultValue={normalizeDocumentTemplateKey(settings?.defaultInvoiceTemplate)}>
              {documentTemplateOptions.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Default quotation template</span>
            <select className="field" name="defaultQuotationTemplate" defaultValue={normalizeDocumentTemplateKey(settings?.defaultQuotationTemplate)}>
              {documentTemplateOptions.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Default receipt template</span>
            <select className="field" name="defaultReceiptTemplate" defaultValue={normalizeDocumentTemplateKey(settings?.defaultReceiptTemplate)}>
              {documentTemplateOptions.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="panel grid gap-4 lg:grid-cols-3">
          <label>
            <span className="label">Default important notes</span>
            <textarea className="field min-h-36" name="defaultImportantNotes" defaultValue={settings?.defaultImportantNotes || ""} />
          </label>
          <label>
            <span className="label">Default payment info</span>
            <textarea className="field min-h-36" name="paymentInfo" defaultValue={settings?.paymentInfo || ""} />
          </label>
          <label>
            <span className="label">Default remarks</span>
            <textarea className="field min-h-36" name="defaultRemarks" defaultValue={settings?.defaultRemarks || ""} />
          </label>
        </section>

        <div className="flex justify-end">
          <button className="btn btn-primary" type="submit">
            Save settings
          </button>
        </div>
      </form>
    </>
  );
}
