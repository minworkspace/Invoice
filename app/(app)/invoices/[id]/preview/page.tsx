import Link from "next/link";
import { notFound } from "next/navigation";
import { FinalPdfPreviewFrame } from "@/components/FinalPdfPreviewFrame";
import { PageHeader } from "@/components/PageHeader";
import { requireCompanyUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function InvoicePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCompanyUser();
  const { id } = await params;
  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: user.companyId },
    select: {
      id: true,
      invoiceNumber: true,
      pdfNeedsRegeneration: true,
      pdfUrl: true
    }
  });

  if (!invoice) notFound();

  return (
    <>
      <PageHeader
        title={`Preview ${invoice.invoiceNumber}`}
        eyebrow="Invoice"
        actions={
          <>
            <Link className="btn btn-secondary" href={`/invoices/${invoice.id}`}>
              Back to invoice
            </Link>
            {invoice.pdfUrl && !invoice.pdfNeedsRegeneration ? (
              <a className="btn btn-primary" href={`/api/documents/invoice/${invoice.id}/pdf`} download>
                Download PDF
              </a>
            ) : null}
          </>
        }
      />

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <FinalPdfPreviewFrame
          documentId={invoice.id}
          documentType="INVOICE"
          pdfNeedsRegeneration={invoice.pdfNeedsRegeneration}
          pdfUrl={invoice.pdfUrl}
        />
      </section>
    </>
  );
}
