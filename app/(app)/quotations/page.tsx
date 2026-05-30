import Link from "next/link";
import { DocumentStatus } from "@prisma/client";
import { AdminPager } from "@/components/AdminPager";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { money, shortDate } from "@/lib/format";
import { requireCompanyUser } from "@/lib/auth";
import { pageCount, pageNumber, pagination } from "@/lib/admin-utils";
import { prisma } from "@/lib/prisma";

export default async function QuotationsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; customerId?: string; status?: string; from?: string; to?: string; page?: string }>;
}) {
  const user = await requireCompanyUser();
  const params = await searchParams;
  const q = params?.q?.trim();
  const page = pageNumber(params.page);
  const status = Object.values(DocumentStatus).includes(params?.status as DocumentStatus)
    ? (params.status as DocumentStatus)
    : undefined;
  const where = {
    companyId: user.companyId,
    ...(params?.customerId ? { customerId: params.customerId } : {}),
    ...(status ? { status } : {}),
    ...(params?.from || params?.to
      ? {
          issueDate: {
            ...(params.from ? { gte: new Date(`${params.from}T00:00:00`) } : {}),
            ...(params.to ? { lte: new Date(`${params.to}T23:59:59`) } : {})
          }
        }
      : {}),
    ...(q
      ? {
          OR: [
            { quotationNumber: { contains: q } },
            { customer: { name: { contains: q } } }
          ]
        }
      : {})
  };

  const [customers, total, quotations] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: user.companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true }
    }),
    prisma.quotation.count({ where }),
    prisma.quotation.findMany({
      where,
      ...pagination(page),
      select: {
        id: true,
        quotationNumber: true,
        issueDate: true,
        total: true,
        status: true,
        customer: { select: { name: true } },
        invoice: { select: { invoiceNumber: true } }
      },
      orderBy: { issueDate: "desc" }
    })
  ]);
  const pages = pageCount(total);

  return (
    <>
      <PageHeader
        title="Quotations"
        eyebrow="Documents"
        actions={
          <Link className="btn btn-primary" href="/quotations/new">
            New quotation
          </Link>
        }
      />

      <form className="panel mb-5 grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_180px_160px_150px_150px_auto]">
        <input className="field" name="q" placeholder="Search customer or number" defaultValue={q || ""} />
        <select className="field" name="customerId" defaultValue={params?.customerId || ""}>
          <option value="">All customers</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        <select className="field" name="status" defaultValue={status || ""}>
          <option value="">All statuses</option>
          {Object.values(DocumentStatus).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <input className="field" name="from" type="date" defaultValue={params?.from || ""} />
        <input className="field" name="to" type="date" defaultValue={params?.to || ""} />
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full min-w-[920px] border-collapse">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">Quotation</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {quotations.map((quotation) => (
              <tr key={quotation.id}>
                <td className="table-cell font-semibold">{quotation.quotationNumber}</td>
                <td className="table-cell">{quotation.customer.name}</td>
                <td className="table-cell">{shortDate(quotation.issueDate)}</td>
                <td className="table-cell">{money(quotation.total)}</td>
                <td className="table-cell">
                  <StatusPill status={quotation.status} />
                </td>
                <td className="table-cell text-muted">{quotation.invoice?.invoiceNumber || "-"}</td>
                <td className="table-cell text-right">
                  <Link className="btn btn-secondary" href={`/quotations/${quotation.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!quotations.length ? <p className="p-5 text-sm text-muted">No quotations found.</p> : null}
      </div>

      <AdminPager
        basePath="/quotations"
        page={page}
        pages={pages}
        params={{ q, customerId: params.customerId, status, from: params.from, to: params.to }}
      />
    </>
  );
}
