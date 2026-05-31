import { DocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { describePdfGenerationError, generateDocumentPdf } from "@/lib/pdf";
import { localRedirect } from "@/lib/redirect-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireCompanyUser();
  const formData = await request.formData();
  const documentType = String(formData.get("documentType") || "") as DocumentType;
  const documentId = String(formData.get("documentId") || "");
  const wantsJson = new URL(request.url).searchParams.get("return") === "json";

  if (!Object.values(DocumentType).includes(documentType) || !documentId) {
    return NextResponse.json({ error: "Invalid document." }, { status: 400 });
  }

  const basePath =
    documentType === DocumentType.INVOICE
      ? "invoices"
      : documentType === DocumentType.QUOTATION
        ? "quotations"
        : "receipts";

  try {
    const pdfUrl = await generateDocumentPdf({
      companyId: user.companyId,
      documentType,
      documentId
    });

    if (wantsJson) {
      return NextResponse.json({
        pdfUrl,
        previewUrl: `/api/documents/${documentType.toLowerCase()}/${documentId}/pdf?inline=1&v=${Date.now()}`
      });
    }

    return localRedirect(`/${basePath}/${documentId}?pdf=generated`);
  } catch (error) {
    console.error("PDF generation failed", describePdfGenerationError(error, {
      documentType,
      documentId
    }));

    if (wantsJson) {
      return NextResponse.json(
        {
          error:
            "PDF generation failed. Please check the document, company settings, and uploaded logo/chop files, then try again."
        },
        { status: 500 }
      );
    }

    return localRedirect(`/${basePath}/${documentId}?error=pdf-generation`);
  }
}
