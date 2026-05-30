import Link from "next/link";
import { DocumentType } from "@prisma/client";
import { notFound } from "next/navigation";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { PageHeader } from "@/components/PageHeader";
import { PostRedirectButton } from "@/components/PostRedirectButton";
import { StatusPill } from "@/components/StatusPill";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { money, shortDate } from "@/lib/format";
import { requireCompanyUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function QuotationDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pdf?: string; error?: string }>;
}) {
  const user = await requireCompanyUser();
  const { id } = await params;
  const query = await searchParams;
  const quotation = await prisma.quotation.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      customer: true,
      items: { orderBy: { sortOrder: "asc" } },
      invoice: true
    }
  });

  if (!quotation) notFound();

  const linkPath = quotation.pdfUrl || `/quotations/${quotation.id}`;

  return (
    <>
      <PageHeader
        title={quotation.quotationNumber}
        eyebrow="Quotation"
        actions={
          <>
            <Link className="btn btn-secondary" href={`/quotations/${quotation.id}/preview`}>
              Preview
            </Link>
            <Link className="btn btn-secondary" href={`/quotations/${quotation.id}/edit`}>
              Edit
            </Link>
            <form action="/api/documents/generate-pdf" method="post">
              <input type="hidden" name="documentType" value={DocumentType.QUOTATION} />
              <input type="hidden" name="documentId" value={quotation.id} />
              <button className="btn btn-secondary" type="submit">
                {quotation.pdfUrl ? "Regenerate PDF" : "Generate PDF"}
              </button>
            </form>
            {quotation.pdfUrl ? (
              <a className={`btn ${query.pdf === "generated" ? "btn-primary" : "btn-secondary"}`} href={`/api/documents/${DocumentType.QUOTATION}/${quotation.id}/pdf`} download>
                Download PDF
              </a>
            ) : null}
            <WhatsAppButton
              documentType="QUOTATION"
              documentId={quotation.id}
              documentNumber={quotation.quotationNumber}
              amount={money(quotation.total)}
              defaultPhone={quotation.customer.whatsapp}
              linkPath={linkPath}
            />
            {quotation.invoice ? (
              <Link className="btn btn-primary" href={`/invoices/${quotation.invoice.id}`}>
                View invoice
              </Link>
            ) : (
              <PostRedirectButton
                action={`/api/quotations/${quotation.id}/convert-to-invoice`}
                className="btn btn-primary"
                idleLabel="Convert to invoice"
                pendingLabel="Creating invoice..."
              />
            )}
            <DeleteDocumentButton
              action={`/api/quotations/${quotation.id}/delete`}
              buttonClassName="btn btn-secondary"
              description="This quotation will be permanently deleted. If it is the latest draft quotation, its number will be reused for the next new quotation."
              returnTo="/quotations"
              title="Delete quotation?"
            />
          </>
        }
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

      {quotation.pdfNeedsRegeneration ? (
        <div className="mb-4 rounded-md border border-[#CFAE43]/30 bg-[#FFF8DF] px-3 py-2 text-sm text-[#765B00]">
          PDF is outdated.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">To</p>
              <h3 className="mt-1 text-xl font-bold">{quotation.customer.name}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{quotation.customer.address || "-"}</p>
            </div>
            <StatusPill status={quotation.status} />
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
                {quotation.items.map((item) => (
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
            <TextPanel title="Important notes" value={quotation.importantNotes} />
            <TextPanel title="Payment info" value={quotation.paymentInfo} />
            <TextPanel title="Remarks" value={quotation.remarks} />
          </div>
        </div>

        <aside className="panel h-fit space-y-4">
          <DetailRow label="Issue date" value={shortDate(quotation.issueDate)} />
          <DetailRow label="Total" value={money(quotation.total)} strong />
          <DetailRow label="PDF generated" value={shortDate(quotation.pdfGeneratedAt)} />
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
