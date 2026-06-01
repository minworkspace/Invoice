import Link from "next/link";
import { DocumentType } from "@prisma/client";
import { notFound } from "next/navigation";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { PageHeader } from "@/components/PageHeader";
import { PostRedirectButton } from "@/components/PostRedirectButton";
import { SuccessModal } from "@/components/SuccessModal";
import { StatusPill } from "@/components/StatusPill";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { money, shortDate } from "@/lib/format";
import { requireCompanyUser } from "@/lib/auth";
import { invoiceGrandTotal, invoiceOutstandingBalance, invoiceRecordedPaid } from "@/lib/invoice-amounts";
import { prisma } from "@/lib/prisma";

export default async function InvoiceDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pdf?: string; created?: string; error?: string }>;
}) {
  const user = await requireCompanyUser();
  const { id } = await params;
  const query = await searchParams;
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      customer: true,
      quotation: true,
      receipt: true,
      items: { orderBy: { sortOrder: "asc" } }
    }
  });

  if (!invoice) notFound();

  const linkPath = invoice.pdfUrl || `/invoices/${invoice.id}`;
  const grandTotal = invoiceGrandTotal(invoice);
  const recordedPaid = invoiceRecordedPaid(invoice);
  const outstandingBalance = invoiceOutstandingBalance(invoice);

  return (
    <>
      <PageHeader
        title={invoice.invoiceNumber}
        eyebrow="Invoice"
        actions={
          <>
            <Link className="btn btn-secondary" href={`/invoices/${invoice.id}/preview`}>
              Preview
            </Link>
            <Link className="btn btn-secondary" href={`/invoices/${invoice.id}/edit`}>
              Edit
            </Link>
            <form action={`/api/invoices/${invoice.id}/generate-pdf`} method="post">
              <button className="btn btn-secondary" type="submit">
                {invoice.pdfUrl ? "Regenerate PDF" : "Generate PDF"}
              </button>
            </form>
            {invoice.pdfUrl ? (
              <a className={`btn ${query.pdf === "generated" ? "btn-primary" : "btn-secondary"}`} href={`/api/documents/${DocumentType.INVOICE}/${invoice.id}/pdf`} download>
                Download PDF
              </a>
            ) : null}
            <WhatsAppButton
              documentType="INVOICE"
              documentId={invoice.id}
              documentNumber={invoice.invoiceNumber}
              amount={money(grandTotal)}
              defaultPhone={invoice.customer.whatsapp}
              linkPath={linkPath}
            />
            {invoice.receipt ? (
              <Link className="btn btn-primary" href={`/receipts/${invoice.receipt.id}`}>
                View receipt
              </Link>
            ) : (
              <PostRedirectButton
                action={`/api/invoices/${invoice.id}/generate-receipt`}
                className="btn btn-primary"
                idleLabel="Generate receipt"
              />
            )}
            <DeleteDocumentButton
              action={`/api/invoices/${invoice.id}/delete`}
              buttonClassName="btn btn-secondary"
              description="This invoice will be permanently deleted. If it already has a receipt, the linked receipt will be deleted too. If it is the latest draft invoice, its number will be reused for the next new invoice."
              returnTo="/invoices"
              title="Delete invoice?"
            />
          </>
        }
      />

      <SuccessModal
        message="Invoice created successfully from quotation. You are now viewing the new invoice."
        open={query.created === "from-quotation"}
        primaryLabel="Bring me there"
        title="Invoice created"
      />

      {query.pdf === "generated" ? (
        <div className="mb-4 rounded-md border border-[#4C9A68]/25 bg-[#E9F7EE] px-3 py-2 text-sm text-[#2F7047]">
          PDF generated successfully. Use Download PDF to save a copy.
        </div>
      ) : null}

      {query.error === "pdf-generation" ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          PDF generation failed. Please check company settings and uploaded logo/chop files, then try again.
        </div>
      ) : null}

      {invoice.pdfNeedsRegeneration ? (
        <div className="mb-4 rounded-md border border-[#CFAE43]/30 bg-[#FFF8DF] px-3 py-2 text-sm text-[#765B00]">
          PDF is outdated.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">To</p>
              <h3 className="mt-1 text-xl font-bold">{invoice.customer.name}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{invoice.customer.address || "-"}</p>
            </div>
            <StatusPill status={invoice.status} />
          </div>

          <div className="mt-6 overflow-hidden rounded-md border border-line">
            <table className="w-full min-w-[640px] border-collapse">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id}>
                    <td className="table-cell whitespace-pre-line">{item.description}</td>
                    <td className="table-cell text-right">{item.showQuantity ? Number(item.quantity).toFixed(2) : ""}</td>
                    <td className="table-cell text-right">{money(item.unitPrice)}</td>
                    <td className="table-cell text-right font-semibold">{money(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <TextPanel title="Important notes" value={invoice.importantNotes} />
            <TextPanel title="Payment info" value={invoice.paymentInfo} />
            <TextPanel title="Remarks" value={invoice.remarks} />
          </div>
        </div>

        <aside className="panel h-fit space-y-4">
          <DetailRow label="Issue date" value={shortDate(invoice.issueDate)} />
          <DetailRow label="Due date" value={shortDate(invoice.dueDate)} />
          <DetailRow label="Quotation" value={invoice.quotation?.quotationNumber || "-"} />
          <DetailRow label="Subtotal" value={money(invoice.subtotal)} />
          <DetailRow label="Refundable deposit" value={money(invoice.refundableDeposit)} />
          <DetailRow label="Total" value={money(grandTotal)} strong />
          <DetailRow label="Paid amount" value={money(recordedPaid)} />
          <DetailRow label="Outstanding" value={money(outstandingBalance)} />
          <DetailRow label="PDF generated" value={shortDate(invoice.pdfGeneratedAt)} />
        </aside>
      </section>
    </>
  );
}

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line pb-3 last:border-b-0 last:pb-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-right text-sm ${strong ? "font-bold text-ink" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function TextPanel({ title, value }: { title: string; value?: string | null }) {
  return (
    <div className="rounded-md border border-line bg-paper p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-2 whitespace-pre-line text-sm">{value || "-"}</p>
    </div>
  );
}
