import Link from "next/link";
import { notFound } from "next/navigation";
import { FinalPdfPreviewFrame } from "@/components/FinalPdfPreviewFrame";
import { PageHeader } from "@/components/PageHeader";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ReceiptPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const receipt = await prisma.receipt.findFirst({
    where: { id, companyId: user.companyId },
    select: {
      id: true,
      receiptNumber: true,
      pdfNeedsRegeneration: true,
      pdfUrl: true
    }
  });

  if (!receipt) notFound();

  return (
    <>
      <PageHeader
        title={`Preview ${receipt.receiptNumber}`}
        eyebrow="Receipt"
        actions={
          <>
            <Link className="btn btn-secondary" href={`/receipts/${receipt.id}`}>
              Back to receipt
            </Link>
            {receipt.pdfUrl && !receipt.pdfNeedsRegeneration ? (
              <a className="btn btn-primary" href={`/api/documents/receipt/${receipt.id}/pdf`} download>
                Download PDF
              </a>
            ) : null}
          </>
        }
      />

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <FinalPdfPreviewFrame
          documentId={receipt.id}
          documentType="RECEIPT"
          pdfNeedsRegeneration={receipt.pdfNeedsRegeneration}
          pdfUrl={receipt.pdfUrl}
        />
      </section>
    </>
  );
}
