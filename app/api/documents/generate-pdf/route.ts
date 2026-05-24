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

  if (!Object.values(DocumentType).includes(documentType) || !documentId) {
    return NextResponse.json({ error: "Invalid document." }, { status: 400 });
  }

  const pdfUrl = await generateDocumentPdf({
    companyId: user.companyId,
    documentType,
    documentId
  });

  const basePath =
    documentType === DocumentType.INVOICE
      ? "invoices"
      : documentType === DocumentType.QUOTATION
        ? "quotations"
        : "receipts";

  if (new URL(request.url).searchParams.get("return") === "json") {
    return NextResponse.json({
      pdfUrl,
      previewUrl: `/api/documents/${documentType.toLowerCase()}/${documentId}/pdf?inline=1&v=${Date.now()}`
    });
  }

  return NextResponse.redirect(new URL(`/${basePath}/${documentId}?pdf=generated`, request.url), 303);
}
