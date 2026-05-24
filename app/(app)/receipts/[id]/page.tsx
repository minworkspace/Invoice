import Link from "next/link";
import { DocumentType } from "@prisma/client";
import { notFound } from "next/navigation";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { PageHeader } from "@/components/PageHeader";
import { SuccessModal } from "@/components/SuccessModal";
import { StatusPill } from "@/components/StatusPill";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { money, shortDate } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ReceiptDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pdf?: string; created?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const query = await searchParams;
  const receipt = await prisma.receipt.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      customer: true,
      invoice: true,
      payments: { orderBy: { paidAt: "desc" } }
    }
  });

  if (!receipt) notFound();

  const linkPath = receipt.pdfUrl || `/receipts/${receipt.id}`;

  return (
    <>
      <PageHeader
        title={receipt.receiptNumber}
        eyebrow="Receipt"
        actions={
          <>
            <Link className="btn btn-secondary" href={`/receipts/${receipt.id}/preview`}>
              Preview
            </Link>
            <Link className="btn btn-secondary" href={`/receipts/${receipt.id}/edit`}>
              Edit
            </Link>
            <form action="/api/documents/generate-pdf" method="post">
              <input type="hidden" name="documentType" value={DocumentType.RECEIPT} />
              <input type="hidden" name="documentId" value={receipt.id} />
              <button className="btn btn-secondary" type="submit">
                {receipt.pdfUrl ? "Regenerate PDF" : "Generate PDF"}
              </button>
            </form>
            {receipt.pdfUrl ? (
              <a className={`btn ${query.pdf === "generated" ? "btn-primary" : "btn-secondary"}`} href={`/api/documents/${DocumentType.RECEIPT}/${receipt.id}/pdf`} download>
                Download PDF
              </a>
            ) : null}
            <WhatsAppButton
              documentType="RECEIPT"
              documentId={receipt.id}
              documentNumber={receipt.receiptNumber}
              amount={money(receipt.amount)}
              defaultPhone={receipt.customer.whatsapp}
              linkPath={linkPath}
            />
            <Link className="btn btn-primary" href={`/invoices/${receipt.invoice.id}`}>
              View invoice
            </Link>
            <DeleteDocumentButton
              action={`/api/receipts/${receipt.id}/delete`}
              buttonClassName="btn btn-secondary"
              description="This receipt will be permanently deleted. If it is the latest draft receipt, its number will be reused for the next new receipt."
              returnTo="/receipts"
              title="Delete receipt?"
            />
          </>
        }
      />

      <SuccessModal
        message="Receipt created successfully from invoice. You are now viewing the new receipt."
        open={query.created === "from-invoice"}
        primaryLabel="Bring me there"
        title="Receipt created"
      />

      {query.pdf === "generated" ? (
        <div className="mb-4 rounded-md border border-[#4C9A68]/25 bg-[#E9F7EE] px-3 py-2 text-sm text-[#2F7047]">
          PDF generated successfully. Use Download PDF to save a copy.
        </div>
      ) : null}

      {receipt.pdfNeedsRegeneration ? (
        <div className="mb-4 rounded-md border border-[#CFAE43]/30 bg-[#FFF8DF] px-3 py-2 text-sm text-[#765B00]">
          PDF is outdated.
        </div>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Received from</p>
              <h3 className="mt-1 text-xl font-bold">{receipt.customer.name}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{receipt.customer.address || "-"}</p>
            </div>
            <StatusPill status={receipt.status} />
          </div>

          <div className="mt-8 rounded-md border border-line bg-paper p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Amount received</p>
            <p className="mt-2 text-4xl font-bold">{money(receipt.amount)}</p>
            <p className="mt-2 text-sm text-muted">For invoice {receipt.invoice.invoiceNumber}</p>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Notes</p>
            <p className="mt-2 whitespace-pre-line text-sm">{receipt.notes || "-"}</p>
          </div>
        </div>

        <aside className="panel h-fit space-y-4">
          <DetailRow label="Receipt date" value={shortDate(receipt.receiptDate)} />
          <DetailRow label="Invoice" value={receipt.invoice.invoiceNumber} />
          <DetailRow label="Payment method" value={receipt.paymentMethod || "-"} />
          <DetailRow label="Amount" value={money(receipt.amount)} strong />
          <DetailRow label="PDF generated" value={shortDate(receipt.pdfGeneratedAt)} />
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
