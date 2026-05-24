import Link from "next/link";
import { AdminPager } from "@/components/AdminPager";
import { PageHeader } from "@/components/PageHeader";
import { pageCount, pageNumber, pagination } from "@/lib/admin-utils";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CustomersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const q = params?.q?.trim();
  const page = pageNumber(params.page);
  const where = {
    companyId: user.companyId,
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { whatsapp: { contains: q } }
          ]
        }
      : {})
  };

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      ...pagination(page),
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        whatsapp: true,
        address: true,
        _count: {
          select: {
            invoices: true,
            quotations: true,
            receipts: true
          }
        }
      }
    })
  ]);
  const pages = pageCount(total);

  return (
    <>
      <PageHeader
        title="Customers"
        eyebrow="Contacts"
        actions={
          <Link href="/customers/new" className="btn btn-primary">
            New customer
          </Link>
        }
      />

      <form className="panel mb-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <input className="field" name="q" placeholder="Search by name, email, phone, WhatsApp" defaultValue={q || ""} />
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Documents</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="table-cell">
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-muted">{customer.address || "-"}</p>
                </td>
                <td className="table-cell">
                  <p>{customer.email || "-"}</p>
                  <p className="text-muted">{customer.whatsapp || customer.phone || "-"}</p>
                </td>
                <td className="table-cell text-muted">
                  {customer._count.quotations} quotations, {customer._count.invoices} invoices, {customer._count.receipts} receipts
                </td>
                <td className="table-cell text-right">
                  <Link className="btn btn-secondary" href={`/customers/${customer.id}`}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!customers.length ? <p className="p-5 text-sm text-muted">No customers found.</p> : null}
      </div>

      <AdminPager basePath="/customers" page={page} pages={pages} params={{ q }} />
    </>
  );
}
