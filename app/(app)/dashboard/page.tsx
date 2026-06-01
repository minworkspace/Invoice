import Link from "next/link";
import { DocumentStatus } from "@prisma/client";
import { DeleteDocumentButton } from "@/components/DeleteDocumentButton";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { money, shortDate } from "@/lib/format";
import { requireCompanyUser } from "@/lib/auth";
import { invoiceGrandTotal, invoiceOutstandingBalance, invoiceRecordedPaid } from "@/lib/invoice-amounts";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const user = await requireCompanyUser();
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    invoiceCount,
    paidReceiptAggregate,
    manuallyPaidInvoices,
    activeInvoices,
    recentInvoices,
    recentQuotations,
    recentReceipts
  ] =
    await Promise.all([
      prisma.invoice.count({
        where: { companyId: user.companyId, issueDate: { gte: startOfMonth } }
      }),
      prisma.receipt.aggregate({
        where: {
          companyId: user.companyId,
          status: DocumentStatus.PAID,
          receiptDate: { gte: startOfMonth }
        },
        _sum: { amount: true }
      }),
      prisma.invoice.findMany({
        where: {
          companyId: user.companyId,
          status: { not: DocumentStatus.CANCELLED },
          issueDate: { gte: startOfMonth },
          receipt: { is: null },
          OR: [{ paidAmount: { gt: 0 } }, { status: DocumentStatus.PAID }]
        },
        select: {
          total: true,
          refundableDeposit: true,
          paidAmount: true,
          status: true
        }
      }),
      prisma.invoice.findMany({
        where: {
          companyId: user.companyId,
          status: { not: DocumentStatus.CANCELLED }
        },
        select: {
          total: true,
          refundableDeposit: true,
          paidAmount: true,
          status: true,
          receipt: {
            select: {
              amount: true,
              status: true
            }
          }
        }
      }),
      prisma.invoice.findMany({
        where: { companyId: user.companyId },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      prisma.quotation.findMany({
        where: { companyId: user.companyId },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: 5
      }),
      prisma.receipt.findMany({
        where: { companyId: user.companyId },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
        take: 5
      })
    ]);

  const outstanding = activeInvoices.reduce((sum, invoice) => sum + invoiceOutstandingBalance(invoice), 0);
  const paidThisMonth =
    Number(paidReceiptAggregate._sum.amount || 0) +
    manuallyPaidInvoices.reduce((sum, invoice) => sum + invoiceRecordedPaid(invoice), 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        eyebrow="Overview"
        actions={
          <>
            <Link href="/invoices/new" className="btn btn-primary">
              New invoice
            </Link>
            <Link href="/quotations/new" className="btn btn-secondary">
              New quotation
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <div className="panel">
          <p className="text-sm font-semibold text-muted">Invoices this month</p>
          <p className="mt-2 text-3xl font-bold">{invoiceCount}</p>
        </div>
        <div className="panel">
          <p className="text-sm font-semibold text-muted">Paid this month</p>
          <p className="mt-2 text-3xl font-bold">{money(paidThisMonth)}</p>
        </div>
        <div className="panel">
          <p className="text-sm font-semibold text-muted">Outstanding amount</p>
          <p className="mt-2 text-3xl font-bold">{money(outstanding)}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-3">
        <RecentList
          title="Recent invoices"
          empty="No invoices yet."
          rows={recentInvoices.map((invoice) => ({
            href: `/invoices/${invoice.id}`,
            deleteAction: `/api/invoices/${invoice.id}/delete`,
            deleteDescription:
              "This invoice will be permanently deleted. If it has a receipt, the linked receipt will be deleted too.",
            number: invoice.invoiceNumber,
            customer: invoice.customer.name,
            date: shortDate(invoice.issueDate),
            total: money(invoiceGrandTotal(invoice)),
            status: invoice.status,
            title: "Delete invoice?"
          }))}
        />
        <RecentList
          title="Recent quotations"
          empty="No quotations yet."
          rows={recentQuotations.map((quotation) => ({
            href: `/quotations/${quotation.id}`,
            deleteAction: `/api/quotations/${quotation.id}/delete`,
            deleteDescription:
              "This quotation will be permanently deleted. If it is the latest draft quotation, its number can be reused.",
            number: quotation.quotationNumber,
            customer: quotation.customer.name,
            date: shortDate(quotation.issueDate),
            total: money(quotation.total),
            status: quotation.status,
            title: "Delete quotation?"
          }))}
        />
        <RecentList
          title="Recent receipts"
          empty="No receipts yet."
          rows={recentReceipts.map((receipt) => ({
            href: `/receipts/${receipt.id}`,
            deleteAction: `/api/receipts/${receipt.id}/delete`,
            deleteDescription: "This receipt will be permanently deleted.",
            number: receipt.receiptNumber,
            customer: receipt.customer.name,
            date: shortDate(receipt.receiptDate),
            total: money(receipt.amount),
            status: receipt.status,
            title: "Delete receipt?"
          }))}
        />
      </section>
    </>
  );
}

function RecentList({
  title,
  rows,
  empty
}: {
  title: string;
  empty: string;
  rows: Array<{
    href: string;
    deleteAction: string;
    deleteDescription: string;
    number: string;
    customer: string;
    date: string;
    total: string;
    status: string;
    title: string;
  }>;
}) {
  return (
    <div className="panel">
      <h3 className="text-lg font-bold">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.href} className="rounded-md border border-line p-3 hover:border-brand">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={row.href} className="font-semibold hover:text-brand">
                    {row.number}
                  </Link>
                  <p className="text-sm text-muted">{row.customer}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={row.status} />
                  <DeleteDocumentButton
                    action={row.deleteAction}
                    buttonClassName="btn btn-secondary h-8 px-3 text-xs"
                    buttonLabel="Delete"
                    confirmLabel="Delete"
                    description={row.deleteDescription}
                    title={row.title}
                  />
                </div>
              </div>
              <div className="mt-2 flex justify-between text-sm text-muted">
                <span>{row.date}</span>
                <span className="font-semibold text-ink">{row.total}</span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted">{empty}</p>
        )}
      </div>
    </div>
  );
}
