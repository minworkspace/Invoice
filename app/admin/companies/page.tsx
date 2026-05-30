import Link from "next/link";
import { Prisma } from "@prisma/client";
import { AdminPager } from "@/components/AdminPager";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { pageCount, pageNumber, pagination } from "@/lib/admin-utils";
import { requireSuperAdmin } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { createCompanyWithAdminAction, deleteCompanyAction, setCompanyActiveAction } from "../actions";

export default async function AdminCompaniesPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; page?: string; notice?: string; error?: string }>;
}) {
  const admin = await requireSuperAdmin();
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

      {params.notice === "super-admin-documents" ? (
        <div className="rounded-md border border-[#CFAE43]/30 bg-[#FFF8DF] px-3 py-2 text-sm text-[#765B00]">
          Super Admin cannot issue documents directly. Please create or access a company account to issue invoices.
        </div>
      ) : null}
      {params.notice === "company-deleted" ? (
        <div className="rounded-md border border-[#BBD7C1] bg-[#F0FAF2] px-3 py-2 text-sm text-[#2D6338]">
          Company and its related records were deleted.
        </div>
      ) : null}
      {params.error === "delete-system-company" ? (
        <div className="rounded-md border border-[#B64545]/30 bg-[#FDECEC] px-3 py-2 text-sm text-[#9D3838]">
          The System Administration company, or any company that owns a Super Admin account, cannot be deleted here.
        </div>
      ) : null}
      {params.error === "delete-company-confirmation" ? (
        <div className="rounded-md border border-[#B64545]/30 bg-[#FDECEC] px-3 py-2 text-sm text-[#9D3838]">
          Company delete was cancelled because the confirmation text did not match.
        </div>
      ) : null}
      {params.error === "admin-email-exists" ? (
        <div className="rounded-md border border-[#B64545]/30 bg-[#FDECEC] px-3 py-2 text-sm text-[#9D3838]">
          That company admin email is already used by another account.
        </div>
      ) : null}
      {params.error === "invalid-company-admin" ? (
        <div className="rounded-md border border-[#B64545]/30 bg-[#FDECEC] px-3 py-2 text-sm text-[#9D3838]">
          Add a company name, admin name, admin email, and a password with at least 8 characters.
        </div>
      ) : null}

      <form action={createCompanyWithAdminAction} className="panel grid gap-3 lg:grid-cols-5">
        <div className="lg:col-span-5">
          <h2 className="text-lg font-bold">Create company account</h2>
          <p className="mt-1 text-sm text-muted">Create a real tenant company and its first Company Admin.</p>
        </div>
        <label>
          <span className="label">Company name</span>
          <input className="field" name="companyName" required />
        </label>
        <label>
          <span className="label">Company email</span>
          <input className="field" name="companyEmail" type="email" />
        </label>
        <label>
          <span className="label">Admin name</span>
          <input className="field" name="adminName" required />
        </label>
        <label>
          <span className="label">Admin email</span>
          <input className="field" name="adminEmail" type="email" required />
        </label>
        <label>
          <span className="label">Admin password</span>
          <input className="field" name="adminPassword" type="password" minLength={8} required />
        </label>
        <div className="lg:col-span-5">
          <button className="btn btn-primary" type="submit">
            Create company and admin
          </button>
        </div>
      </form>

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
                    {company.id === admin.companyId ? (
                      <span className="self-center text-sm text-muted">Protected</span>
                    ) : (
                      <>
                        <form action={setCompanyActiveAction}>
                          <input name="companyId" type="hidden" value={company.id} />
                          <input name="isActive" type="hidden" value={company.isActive ? "false" : "true"} />
                          <button className="btn btn-secondary h-9" type="submit">
                            {company.isActive ? "Disable" : "Enable"}
                          </button>
                        </form>
                        <AdminDeleteButton
                          action={deleteCompanyAction}
                          confirmLabel="Delete company"
                          confirmText={company.name}
                          description="This permanently deletes the company, users, customers, documents, payments, WhatsApp logs, numbering sequences, settings, uploaded logos/chops, and generated PDFs. Use this only for test/demo tenants."
                          fields={{ companyId: company.id }}
                          title={`Delete ${company.name}?`}
                        />
                      </>
                    )}
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
