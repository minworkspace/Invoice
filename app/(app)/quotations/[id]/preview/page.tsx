import Link from "next/link";
import { notFound } from "next/navigation";
import { FinalPdfPreviewFrame } from "@/components/FinalPdfPreviewFrame";
import { PageHeader } from "@/components/PageHeader";
import { requireCompanyUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function QuotationPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCompanyUser();
  const { id } = await params;
  const quotation = await prisma.quotation.findFirst({
    where: { id, companyId: user.companyId },
    select: {
      id: true,
      quotationNumber: true,
      pdfNeedsRegeneration: true,
      pdfUrl: true
    }
  });

  if (!quotation) notFound();

  return (
    <>
      <PageHeader
        title={`Preview ${quotation.quotationNumber}`}
        eyebrow="Quotation"
        actions={
          <>
            <Link className="btn btn-secondary" href={`/quotations/${quotation.id}`}>
              Back to quotation
            </Link>
            {quotation.pdfUrl && !quotation.pdfNeedsRegeneration ? (
              <a className="btn btn-primary" href={`/api/documents/quotation/${quotation.id}/pdf`} download>
                Download PDF
              </a>
            ) : null}
          </>
        }
      />

      <section className="overflow-hidden rounded-lg border border-line bg-white shadow-soft">
        <FinalPdfPreviewFrame
          documentId={quotation.id}
          documentType="QUOTATION"
          pdfNeedsRegeneration={quotation.pdfNeedsRegeneration}
          pdfUrl={quotation.pdfUrl}
        />
      </section>
    </>
  );
}
