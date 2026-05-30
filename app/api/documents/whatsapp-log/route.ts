import { DocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireCompanyUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const user = await requireCompanyUser();
  const body = await request.json();
  const documentType = body.documentType as DocumentType;
  const documentId = String(body.documentId || "");
  const phoneNumber = String(body.phoneNumber || "");
  const message = String(body.message || "");

  if (!Object.values(DocumentType).includes(documentType) || !documentId || !phoneNumber || !message) {
    return NextResponse.json({ error: "Invalid document type." }, { status: 400 });
  }

  const document =
    documentType === DocumentType.INVOICE
      ? await prisma.invoice.findFirst({ where: { id: documentId, companyId: user.companyId }, select: { id: true } })
      : documentType === DocumentType.QUOTATION
        ? await prisma.quotation.findFirst({ where: { id: documentId, companyId: user.companyId }, select: { id: true } })
        : await prisma.receipt.findFirst({ where: { id: documentId, companyId: user.companyId }, select: { id: true } });

  if (!document) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  await prisma.whatsAppSendLog.create({
    data: {
      companyId: user.companyId,
      documentType,
      documentId,
      phoneNumber,
      message,
      sentByUserId: user.id
    }
  });

  return NextResponse.json({ ok: true });
}
