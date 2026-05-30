import { DocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { describePdfGenerationError, generateDocumentPdf } from "@/lib/pdf";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.redirect(new URL(`/invoices/${id}?error=pdf-generation`, request.url), 303);
  }

  return NextResponse.redirect(new URL(`/invoices/${id}?pdf=generated`, request.url), 303);
}
