import fs from "fs";
import { Readable } from "stream";
import { DocumentType, UserRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLocalFilePath } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function filenameFor(documentType: DocumentType, number: string) {
  return `${documentType.toLowerCase()}-${number.replace(/[^a-z0-9-]/gi, "") || "document"}.pdf`;
}

export async function GET(request: Request, { params }: { params: Promise<{ documentType: string; id: string }> }) {
  const user = await requireUser();
  const { documentType: rawType, id } = await params;
  const documentType = rawType.toUpperCase() as DocumentType;

  if (!Object.values(DocumentType).includes(documentType)) notFound();
  const scopedWhere = user.role === UserRole.SUPER_ADMIN ? { id } : { id, companyId: user.companyId };

  const document =
    documentType === DocumentType.INVOICE
      ? await prisma.invoice.findFirst({
          where: scopedWhere,
          select: { pdfUrl: true, invoiceNumber: true }
        })
      : documentType === DocumentType.QUOTATION
        ? await prisma.quotation.findFirst({
            where: scopedWhere,
            select: { pdfUrl: true, quotationNumber: true }
          })
        : await prisma.receipt.findFirst({
            where: scopedWhere,
            select: { pdfUrl: true, receiptNumber: true }
          });

  if (!document?.pdfUrl) notFound();

  const filePath = getLocalFilePath(document.pdfUrl);
  if (!filePath || !fs.existsSync(filePath)) notFound();

  const number =
    "invoiceNumber" in document
      ? document.invoiceNumber
      : "quotationNumber" in document
        ? document.quotationNumber
        : document.receiptNumber;
  const stream = fs.createReadStream(filePath);
  const disposition = new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment";

  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filenameFor(documentType, number)}"`,
      "Cache-Control": "private, max-age=0, must-revalidate"
    }
  });
}
