import Link from "next/link";
import { Prisma } from "@prisma/client";
import { AdminPager } from "@/components/AdminPager";
import { pageCount, pageNumber, pagination } from "@/lib/admin-utils";
import { requireSuperAdmin } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { setCompanyActiveAction } from "../actions";

export default async function AdminCompaniesPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const q = params.q?.trim();
  const page = pageNumber(params.page);
  const where: Prisma.CompanyWhereInput = q
    ? {
        OR: [
          { name: { contains: q } },
          { email: { contains: q } }
        ]
      }
    : {};

  const [total, companies] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      ...pagination(page),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        createdAt: true,
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
    })
  ]);
  const pages = pageCount(total);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Tenants</p>
        <h1 className="mt-1 text-3xl font-bold text-ink">Companies</h1>
      </header>

      <form className="panel flex flex-wrap gap-3">
        <input className="field min-w-72 flex-1" name="q" placeholder="Search company name or email" defaultValue={q || ""} />
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full min-w-[1120px] border-collapse">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Users</th>
              <th className="px-4 py-3">Customers</th>
              <th className="px-4 py-3">Quotes</th>
              <th className="px-4 py-3">Invoices</th>
              <th className="px-4 py-3">Receipts</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr key={company.id}>
                <td className="table-cell">
                  <Link className="font-semibold text-brand" href={`/admin/companies/${company.id}`}>
                    {company.name}
                  </Link>
                </td>
                <td className="table-cell text-muted">
                  <div>{company.email || "-"}</div>
                  <div>{company.phone || ""}</div>
                </td>
                <td className="table-cell">{company._count.users}</td>
                <td className="table-cell">{company._count.customers}</td>
                <td className="table-cell">{company._count.quotations}</td>
                <td className="table-cell">{company._count.invoices}</td>
                <td className="table-cell">{company._count.receipts}</td>
                <td className="table-cell">
                  <Status isActive={company.isActive} />
                </td>
                <td className="table-cell">{shortDate(company.createdAt)}</td>
                <td className="table-cell text-right">
                  <div className="flex justify-end gap-2">
                    <Link className="btn btn-secondary h-9" href={`/admin/companies/${company.id}`}>
                      Details
                    </Link>
                    <form action={setCompanyActiveAction}>
                      <input name="companyId" type="hidden" value={company.id} />
                      <input name="isActive" type="hidden" value={company.isActive ? "false" : "true"} />
                      <button className="btn btn-secondary h-9" type="submit">
                        {company.isActive ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!companies.length ? <p className="p-5 text-sm text-muted">No companies found.</p> : null}
      </div>

      <AdminPager basePath="/admin/companies" page={page} pages={pages} params={{ q }} />
    </div>
  );
}

function Status({ isActive }: { isActive: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${isActive ? "bg-[#E9F7EE] text-[#2F7047]" : "bg-[#FDECEC] text-[#9D3838]"}`}>
      {isActive ? "Active" : "Disabled"}
    </span>
  );
}
