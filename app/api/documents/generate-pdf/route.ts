import { DocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { generateDocumentPdf } from "@/lib/pdf";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await requireUser();
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

    return NextResponse.redirect(new URL(`/${basePath}/${documentId}?pdf=generated`, request.url), 303);
  } catch (error) {
    console.error("PDF generation failed", {
      documentType,
      documentId,
      error
    });

    if (wantsJson) {
      return NextResponse.json({ error: "PDF generation failed. Please try again." }, { status: 500 });
    }

    return NextResponse.redirect(new URL(`/${basePath}/${documentId}?error=pdf-generation`, request.url), 303);
  }
}
