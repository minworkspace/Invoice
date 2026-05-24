import Link from "next/link";
import { Prisma } from "@prisma/client";
import { AdminPager } from "@/components/AdminPager";
import { pageCount, pageNumber, pagination } from "@/lib/admin-utils";
import { requireSuperAdmin } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { setUserActiveAction } from "../actions";

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; companyId?: string; page?: string }>;
}) {
  const admin = await requireSuperAdmin();
  const params = await searchParams;
  const q = params.q?.trim();
  const page = pageNumber(params.page);
  const where: Prisma.UserWhereInput = {
    ...(params.companyId ? { companyId: params.companyId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { company: { name: { contains: q } } }
          ]
        }
      : {})
  };

  const [total, users, scopedCompany] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      ...pagination(page),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        company: { select: { id: true, name: true, isActive: true } }
      }
    }),
    params.companyId
      ? prisma.company.findUnique({
          where: { id: params.companyId },
          select: { id: true, name: true }
        })
      : Promise.resolve(null)
  ]);
  const pages = pageCount(total);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Accounts</p>
          <h1 className="mt-1 text-3xl font-bold text-ink">Users</h1>
          {scopedCompany ? (
            <p className="mt-2 text-sm text-muted">
              Filtered to{" "}
              <Link className="font-semibold text-brand" href={`/admin/companies/${scopedCompany.id}`}>
                {scopedCompany.name}
              </Link>
            </p>
          ) : null}
        </div>
      </header>

      <form className="panel flex flex-wrap gap-3">
        {params.companyId ? <input name="companyId" type="hidden" value={params.companyId} /> : null}
        <input className="field min-w-72 flex-1" name="q" placeholder="Search user name, email, or company" defaultValue={q || ""} />
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
        {params.companyId ? (
          <Link className="btn btn-secondary" href="/admin/users">
            Clear company
          </Link>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full min-w-[980px] border-collapse">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">User status</th>
              <th className="px-4 py-3">Company status</th>
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
                <td className="table-cell">
                  <Link className="font-semibold text-brand" href={`/admin/companies/${user.company.id}`}>
                    {user.company.name}
                  </Link>
                </td>
                <td className="table-cell">{user.role}</td>
                <td className="table-cell">{user.isActive ? "Active" : "Disabled"}</td>
                <td className="table-cell">{user.company.isActive ? "Active" : "Disabled"}</td>
                <td className="table-cell">{shortDate(user.createdAt)}</td>
                <td className="table-cell text-right">
                  {user.id === admin.id ? (
                    <span className="text-sm text-muted">Current user</span>
                  ) : (
                    <form action={setUserActiveAction}>
                      <input name="userId" type="hidden" value={user.id} />
                      <input name="isActive" type="hidden" value={user.isActive ? "false" : "true"} />
                      <button className="btn btn-secondary h-9" type="submit">
                        {user.isActive ? "Disable" : "Enable"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users.length ? <p className="p-5 text-sm text-muted">No users found.</p> : null}
      </div>

      <AdminPager basePath="/admin/users" page={page} pages={pages} params={{ q, companyId: params.companyId }} />
    </div>
  );
}
