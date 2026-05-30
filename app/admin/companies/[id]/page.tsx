import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { getDocumentTemplate } from "@/components/document-templates/template-registry";
import { StatusPill } from "@/components/StatusPill";
import { pdfStorageSummary } from "@/lib/admin-utils";
import { requireSuperAdmin } from "@/lib/auth";
import { money, shortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { deleteCompanyAction, deleteUserAction, setCompanyActiveAction, setUserActiveAction } from "../../actions";

export default async function AdminCompanyDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const admin = await requireSuperAdmin();
  const { id } = await params;
  const query = await searchParams;

  const [company, users, invoices, quotations, receipts, storage] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        settings: {
          select: {
            invoicePrefix: true,
            quotationPrefix: true,
            receiptPrefix: true,
            documentNumberPadding: true,
            logoUrl: true,
            chopUrl: true,
            ssmNumber: true,
            defaultInvoiceTemplate: true,
            defaultQuotationTemplate: true,
            defaultReceiptTemplate: true
          }
        },
        _count: {
          select: {
            users: true,
            customers: true,
            quotations: true,
            invoices: true,
            receipts: true
          }
        }
      }
    }),
    prisma.user.findMany({
      where: { companyId: id },
      take: 20,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    }),
    prisma.invoice.findMany({
      where: { companyId: id },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        total: true,
        createdAt: true,
        customer: { select: { name: true } }
      }
    }),
    prisma.quotation.findMany({
      where: { companyId: id },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        quotationNumber: true,
        status: true,
        total: true,
        createdAt: true,
        customer: { select: { name: true } }
      }
    }),
    prisma.receipt.findMany({
      where: { companyId: id },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        receiptNumber: true,
        status: true,
        amount: true,
        createdAt: true,
        customer: { select: { name: true } }
      }
    }),
    pdfStorageSummary(id)
  ]);

  if (!company) notFound();
  const templateSummary = [
    getDocumentTemplate(company.settings?.defaultInvoiceTemplate).name,
    getDocumentTemplate(company.settings?.defaultQuotationTemplate).name,
    getDocumentTemplate(company.settings?.defaultReceiptTemplate).name
  ].join(" / ");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Company details</p>
          <h1 className="mt-1 text-3xl font-bold text-ink">{company.name}</h1>
          <p className="mt-2 text-sm text-muted">{company.email || "No email"} · Created {shortDate(company.createdAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn-secondary" href={`/admin/users?companyId=${company.id}`}>
            Users
          </Link>
          <Link className="btn btn-secondary" href={`/admin/documents?companyId=${company.id}`}>
            Documents
          </Link>
          {company.id === admin.companyId ? (
            <span className="self-center rounded-full border border-line px-3 py-2 text-sm font-semibold text-muted">
              Protected system company
            </span>
          ) : (
            <>
              <form action={setCompanyActiveAction}>
                <input name="companyId" type="hidden" value={company.id} />
                <input name="isActive" type="hidden" value={company.isActive ? "false" : "true"} />
                <button className="btn btn-primary" type="submit">
                  {company.isActive ? "Disable company" : "Enable company"}
                </button>
              </form>
              <AdminDeleteButton
                action={deleteCompanyAction}
                buttonClassName="btn btn-danger"
                buttonLabel="Delete company"
                confirmLabel="Delete company"
                confirmText={company.name}
                description="This permanently deletes the company, users, customers, documents, payments, WhatsApp logs, numbering sequences, settings, uploaded logos/chops, and generated PDFs. Use this only for test/demo tenants."
                fields={{ companyId: company.id }}
                title={`Delete ${company.name}?`}
              />
            </>
          )}
        </div>
      </header>

      {query.created ? (
        <div className="rounded-md border border-[#BBD7C1] bg-[#F0FAF2] px-3 py-2 text-sm text-[#2D6338]">
          Company account created. The Company Admin can now log in and issue documents.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Users" value={company._count.users} />
        <StatCard label="Customers" value={company._count.customers} />
        <StatCard label="Quotations" value={company._count.quotations} />
        <StatCard label="Invoices" value={company._count.invoices} />
        <StatCard label="Receipts" value={company._count.receipts} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="panel">
          <h2 className="text-lg font-bold">Settings snapshot</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <Info label="Status" value={company.isActive ? "Active" : "Disabled"} />
            <Info label="Phone" value={company.phone || "-"} />
            <Info label="Address" value={company.address || "-"} />
            <Info label="SSM" value={company.settings?.ssmNumber || "-"} />
            <Info label="Number prefixes" value={`${company.settings?.invoicePrefix || "INV-"} / ${company.settings?.quotationPrefix || "QUO-"} / ${company.settings?.receiptPrefix || "REC-"}`} />
            <Info label="Templates" value={templateSummary} />
            <Info label="Logo file" value={company.settings?.logoUrl || "-"} />
            <Info label="Chop file" value={company.settings?.chopUrl || "-"} />
            <Info label="Storage usage" value={`${storage.display} across ${storage.files} uploaded/generated files`} />
          </dl>
        </div>

        <div className="panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Users</h2>
              <p className="text-sm text-muted">Latest 20 users for this company.</p>
            </div>
            <Link className="btn btn-secondary" href={`/admin/users?companyId=${company.id}`}>
              View all
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="table-head">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="table-cell">
                      <div className="font-semibold">{user.name}</div>
                      <div className="text-muted">{user.email}</div>
                    </td>
                    <td className="table-cell">{user.role}</td>
                    <td className="table-cell">{user.isActive ? "Active" : "Disabled"}</td>
                    <td className="table-cell">{shortDate(user.createdAt)}</td>
                    <td className="table-cell text-right">
                      {user.id === admin.id ? (
                        <span className="text-sm text-muted">Current user</span>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <form action={setUserActiveAction}>
                            <input name="userId" type="hidden" value={user.id} />
                            <input name="isActive" type="hidden" value={user.isActive ? "false" : "true"} />
                            <button className="btn btn-secondary h-9" type="submit">
                              {user.isActive ? "Disable" : "Enable"}
                            </button>
                          </form>
                          <AdminDeleteButton
                            action={deleteUserAction}
                            buttonLabel="Delete"
                            confirmLabel="Delete user"
                            description="This permanently deletes the user account and WhatsApp send logs created by this user. Company documents are kept."
                            fields={{ userId: user.id }}
                            title={`Delete ${user.name}?`}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <RecentDocumentCard title="Recent invoices" rows={invoices.map((item) => ({
          id: item.id,
          number: item.invoiceNumber,
          customer: item.customer.name,
          amount: money(item.total),
          status: item.status,
          createdAt: item.createdAt
        }))} />
        <RecentDocumentCard title="Recent quotations" rows={quotations.map((item) => ({
          id: item.id,
          number: item.quotationNumber,
          customer: item.customer.name,
          amount: money(item.total),
          status: item.status,
          createdAt: item.createdAt
        }))} />
        <RecentDocumentCard title="Recent receipts" rows={receipts.map((item) => ({
          id: item.id,
          number: item.receiptNumber,
          customer: item.customer.name,
          amount: money(item.amount),
          status: item.status,
          createdAt: item.createdAt
        }))} />
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-line pb-3 last:border-b-0 last:pb-0 md:grid-cols-[160px_1fr]">
      <dt className="font-semibold text-muted">{label}</dt>
      <dd className="break-words text-ink">{value}</dd>
    </div>
  );
}

function RecentDocumentCard({
  title,
  rows
}: {
  title: string;
  rows: Array<{ id: string; number: string; customer: string; amount: string; status: string; createdAt: Date }>;
}) {
  return (
    <div className="panel">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-md border border-line bg-paper p-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">{row.number}</p>
                <p className="text-muted">{row.customer}</p>
              </div>
              <StatusPill status={row.status} />
            </div>
            <div className="mt-2 flex justify-between gap-3 text-muted">
              <span>{shortDate(row.createdAt)}</span>
              <span className="font-semibold text-ink">{row.amount}</span>
            </div>
          </div>
        ))}
        {!rows.length ? <p className="text-sm text-muted">No documents yet.</p> : null}
      </div>
    </div>
  );
}
