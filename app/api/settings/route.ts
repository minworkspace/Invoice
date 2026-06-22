import { normalizeDocumentTemplateKey } from "@/components/document-templates/template-registry";
import { requireCompanyUser } from "@/lib/auth";
import { sanitizeNullablePhoneDisplay } from "@/lib/document-text";
import { formString, nullableString } from "@/lib/forms";
import { deleteManagedAssetFile, saveCompanyChop, saveCompanyLogo } from "@/lib/logo";
import { prisma } from "@/lib/prisma";
import { localRedirect } from "@/lib/redirect-response";

export const runtime = "nodejs";

function parsePositiveNumber(value: string, fallback: number, max?: number) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) return fallback;
  return max ? Math.min(number, max) : number;
}

function settingsErrorRedirect(message: string) {
  return localRedirect(`/settings?error=${encodeURIComponent(message)}`);
}

export async function POST(request: Request) {
  const user = await requireCompanyUser();
  const formData = await request.formData();
  const nextCompanyName = formString(formData, "companyName");
  const nextCompanyEmail = nullableString(formData, "companyEmail");
  const nextCompanyPhone = sanitizeNullablePhoneDisplay(formData.get("companyPhone"));
  const nextCompanyAddress = nullableString(formData, "companyAddress");
  const nextSsmNumber = nullableString(formData, "ssmNumber");
  const nextInvoicePrefix = formString(formData, "invoicePrefix", "INV-");
  const nextInvoiceStartNumber = parsePositiveNumber(formString(formData, "invoiceStartNumber", "1"), 1);
  const nextQuotationPrefix = formString(formData, "quotationPrefix", "QUO-");
  const nextQuotationStartNumber = parsePositiveNumber(formString(formData, "quotationStartNumber", "1"), 1);
  const nextReceiptPrefix = formString(formData, "receiptPrefix", "REC-");
  const nextReceiptStartNumber = parsePositiveNumber(formString(formData, "receiptStartNumber", "1"), 1);
  const nextNumberPadding = parsePositiveNumber(formString(formData, "documentNumberPadding", "5"), 5, 12);
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
    const message = error instanceof Error ? error.message : "Image upload failed.";
    return settingsErrorRedirect(message);
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
    console.error("Company settings save failed", {
      companyId: user.companyId,
      error: error instanceof Error ? { name: error.name, message: error.message } : String(error)
    });
    return settingsErrorRedirect("Settings could not be saved. Please try again.");
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

  return localRedirect("/settings?saved=1");
}
