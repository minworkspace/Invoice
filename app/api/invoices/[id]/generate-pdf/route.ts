import { DocumentType } from "@prisma/client";
import { requireCompanyUser } from "@/lib/auth";
import { describePdfGenerationError, generateDocumentPdf } from "@/lib/pdf";
import { localRedirect } from "@/lib/redirect-response";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCompanyUser();
  const { id } = await params;

  try {
    await generateDocumentPdf({
      companyId: user.companyId,
      documentType: DocumentType.INVOICE,
      documentId: id
    });
  } catch (error) {
    console.error("Invoice PDF generation failed", describePdfGenerationError(error, { invoiceId: id }));
    return localRedirect(`/invoices/${id}?error=pdf-generation`);
  }

  return localRedirect(`/invoices/${id}?pdf=generated`);
}
