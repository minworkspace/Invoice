import Link from "next/link";
import packageJson from "@/package.json";
import { StatusPill } from "@/components/StatusPill";
import { requireSuperAdmin } from "@/lib/auth";
import { formatBytes, pdfStorageSummary } from "@/lib/admin-utils";
import { money, shortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

async function databaseStatus() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, label: "Connected" };
  } catch (error) {
    return {
      ok: false,
      label: error instanceof Error ? error.message.split("\n")[0] : "Unavailable"
    };
  }
}

export default async function AdminOverviewPage() {
  await requireSuperAdmin();

  const [
    totalCompanies,
    disabledCompanies,
    totalUsers,
    disabledUsers,
    totalCustomers,
    totalQuotations,
    totalInvoices,
    totalReceipts,
    recentInvoices,
    recentLogs,
    storage,
    db
  ] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({ where: { isActive: false } }),
    prisma.user.count(),
    prisma.user.count({ where: { isActive: false } }),
    prisma.customer.count(),
    prisma.quotation.count(),
    prisma.invoice.count(),
    prisma.receipt.count(),
    prisma.invoice.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        status: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
        customer: { select: { name: true } }
      }
    }),
    prisma.whatsAppSendLog.findMany({
      take: 6,
      orderBy: { sentAt: "desc" },
      select: {
        id: true,
        documentType: true,
        phoneNumber: true,
        sentAt: true,
        company: { select: { id: true, name: true } },
        sentByUser: { select: { name: true } }
      }
    }),
    pdfStorageSummary(),
    databaseStatus()
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">System overview</p>
          <h1 className="mt-1 text-3xl font-bold text-ink">Super Admin</h1>
          <p className="mt-2 text-sm text-muted">A lightweight overview of tenants, documents, storage, and health.</p>
        </div>
        <Link className="btn btn-primary" href="/admin/companies">
          View companies
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Companies" value={totalCompanies} helper={`${disabledCompanies} disabled`} />
        <StatCard label="Users" value={totalUsers} helper={`${disabledUsers} disabled`} />
        <StatCard label="Customers" value={totalCustomers} helper="Across all tenants" />
        <StatCard label="Storage usage" value={storage.display} helper={`${storage.files} uploaded/generated files`} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Quotations" value={totalQuotations} helper="All companies" />
        <StatCard label="Invoices" value={totalInvoices} helper="All companies" />
        <StatCard label="Receipts" value={totalReceipts} helper="All companies" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Recent invoices</h2>
              <p className="text-sm text-muted">Read-only system view. Manage client documents from company mode only.</p>
            </div>
            <Link className="btn btn-secondary" href="/admin/documents?type=invoice">
              All documents
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="table-cell font-semibold">{invoice.invoiceNumber}</td>
                    <td className="table-cell">
                      <Link className="font-semibold text-brand" href={`/admin/companies/${invoice.company.id}`}>
                        {invoice.company.name}
                      </Link>
                    </td>
                    <td className="table-cell">{invoice.customer.name}</td>
                    <td className="table-cell">{money(invoice.total)}</td>
                    <td className="table-cell">
                      <StatusPill status={invoice.status} />
                    </td>
                    <td className="table-cell">{shortDate(invoice.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!recentInvoices.length ? <p className="p-4 text-sm text-muted">No invoices yet.</p> : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="panel">
            <h2 className="text-lg font-bold">System health</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <InfoRow label="Database" value={db.label} ok={db.ok} />
              <InfoRow label="App version" value={packageJson.version || "0.0.0"} />
              <InfoRow label="Build" value={process.env.NEXT_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA || "local"} />
              <InfoRow label="Storage bytes" value={formatBytes(storage.bytes)} />
            </dl>
          </div>

          <div className="panel">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Recent activity</h2>
              <Link className="text-sm font-semibold text-brand" href="/admin/activity">
                View all
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="rounded-md border border-line bg-paper p-3 text-sm">
                  <p className="font-semibold text-ink">{log.documentType} sent via WhatsApp</p>
                  <p className="mt-1 text-muted">
                    {log.company.name} · {log.sentByUser.name} · {log.phoneNumber}
                  </p>
                  <p className="mt-1 text-xs text-muted">{shortDate(log.sentAt)}</p>
                </div>
              ))}
              {!recentLogs.length ? <p className="text-sm text-muted">No activity logs yet.</p> : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string | number; helper: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm text-muted">{helper}</p>
    </div>
  );
}

function InfoRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line pb-3 last:border-b-0 last:pb-0">
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className={`text-right font-semibold ${ok === false ? "text-[#A63D40]" : "text-ink"}`}>{value}</dd>
    </div>
  );
}
