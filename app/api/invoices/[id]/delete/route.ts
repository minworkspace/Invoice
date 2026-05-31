import { requireCompanyUser } from "@/lib/auth";
import { deleteInvoiceDocument } from "@/lib/document-delete";
import { localRedirect, safeReturnPath } from "@/lib/redirect-response";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireCompanyUser();
  const { id } = await params;
  const returnTo = safeReturnPath(new URL(request.url).searchParams.get("returnTo"), "/invoices");

  await deleteInvoiceDocument(user.companyId, id);

  return localRedirect(returnTo);
}
