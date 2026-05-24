import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { deleteReceiptDocument } from "@/lib/document-delete";

function safeReturnTo(value: string | null, fallback: string) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get("returnTo"), "/receipts");

  await deleteReceiptDocument(user.companyId, id);

  return NextResponse.redirect(new URL(returnTo, request.url), 303);
}
