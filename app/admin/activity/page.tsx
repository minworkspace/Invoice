import Link from "next/link";
import { Prisma } from "@prisma/client";
import { AdminPager } from "@/components/AdminPager";
import { pageCount, pageNumber, pagination } from "@/lib/admin-utils";
import { requireSuperAdmin } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function AdminActivityPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const q = params.q?.trim();
  const page = pageNumber(params.page);
  const where: Prisma.WhatsAppSendLogWhereInput = q
    ? {
        OR: [
          { phoneNumber: { contains: q } },
          { message: { contains: q } },
          { company: { name: { contains: q } } },
          { sentByUser: { name: { contains: q } } },
          { sentByUser: { email: { contains: q } } }
        ]
      }
    : {};

  const [total, logs] = await Promise.all([
    prisma.whatsAppSendLog.count({ where }),
    prisma.whatsAppSendLog.findMany({
      where,
      ...pagination(page),
      orderBy: { sentAt: "desc" },
      select: {
        id: true,
        documentType: true,
        documentId: true,
        phoneNumber: true,
        message: true,
        sentAt: true,
        company: { select: { id: true, name: true } },
        sentByUser: { select: { id: true, name: true, email: true } }
      }
    })
  ]);
  const pages = pageCount(total);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Activity</p>
        <h1 className="mt-1 text-3xl font-bold text-ink">WhatsApp send logs</h1>
        <p className="mt-2 text-sm text-muted">System-level log view, paginated to keep tenant data light.</p>
      </header>

      <form className="panel flex flex-wrap gap-3">
        <input className="field min-w-72 flex-1" name="q" placeholder="Search phone, message, user, company" defaultValue={q || ""} />
        <button className="btn btn-secondary" type="submit">
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full min-w-[1100px] border-collapse">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">Sent at</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Sent by</th>
              <th className="px-4 py-3">Message</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="table-cell">{shortDate(log.sentAt)}</td>
                <td className="table-cell">
                  <Link className="font-semibold text-brand" href={`/admin/companies/${log.company.id}`}>
                    {log.company.name}
                  </Link>
                </td>
                <td className="table-cell">
                  {log.documentType} · <span className="text-muted">{log.documentId.slice(0, 8)}</span>
                </td>
                <td className="table-cell">{log.phoneNumber}</td>
                <td className="table-cell">
                  <div className="font-semibold">{log.sentByUser.name}</div>
                  <div className="text-muted">{log.sentByUser.email}</div>
                </td>
                <td className="table-cell max-w-xl truncate">{log.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!logs.length ? <p className="p-5 text-sm text-muted">No activity logs found.</p> : null}
      </div>

      <AdminPager basePath="/admin/activity" page={page} pages={pages} params={{ q }} />
    </div>
  );
}
