import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusPill } from "@/components/StatusPill";
import { requireUser } from "@/lib/auth";
import { formString, nullableString } from "@/lib/forms";
import { money, shortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

async function updateCustomerAction(formData: FormData) {
  "use server";
  const user = await requireUser();
  const id = formString(formData, "id");

  await prisma.customer.update({
    where: { id, companyId: user.companyId },
    data: {
      name: formString(formData, "name"),
      email: nullableString(formData, "email"),
      phone: nullableString(formData, "phone"),
      whatsapp: nullableString(formData, "whatsapp"),
      address: nullableString(formData, "address")
    }
  });

  redirect(`/customers/${id}`);
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const customer = await prisma.customer.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      invoices: { orderBy: { issueDate: "desc" }, take: 20 },
      quotations: { orderBy: { issueDate: "desc" }, take: 20 },
      receipts: { orderBy: { receiptDate: "desc" }, take: 20 }
    }
  });

  if (!customer) notFound();

  const documents = [
    ...customer.quotations.map((document) => ({
      type: "Quotation",
      number: document.quotationNumber,
      href: `/quotations/${document.id}`,
      date: document.issueDate,
      amount: document.total,
      status: document.status
    })),
    ...customer.invoices.map((document) => ({
      type: "Invoice",
      number: document.invoiceNumber,
      href: `/invoices/${document.id}`,
      date: document.issueDate,
      amount: document.total,
      status: document.status
    })),
    ...customer.receipts.map((document) => ({
      type: "Receipt",
      number: document.receiptNumber,
      href: `/receipts/${document.id}`,
      date: document.receiptDate,
      amount: document.amount,
      status: document.status
    }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <>
      <PageHeader title={customer.name} eyebrow="Customer history" />

      <form action={updateCustomerAction} className="panel mb-6 grid gap-4 lg:grid-cols-2">
        <input type="hidden" name="id" value={customer.id} />
        <label>
          <span className="label">Name</span>
          <input className="field" name="name" defaultValue={customer.name} required />
        </label>
        <label>
          <span className="label">Email</span>
          <input className="field" name="email" type="email" defaultValue={customer.email || ""} />
        </label>
        <label>
          <span className="label">Phone</span>
          <input className="field" name="phone" defaultValue={customer.phone || ""} />
        </label>
        <label>
          <span className="label">WhatsApp</span>
          <input className="field" name="whatsapp" defaultValue={customer.whatsapp || ""} />
        </label>
        <label className="lg:col-span-2">
          <span className="label">Address</span>
          <textarea className="field min-h-24" name="address" defaultValue={customer.address || ""} />
        </label>
        <div className="lg:col-span-2 flex justify-end">
          <button className="btn btn-primary" type="submit">
            Save customer
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={`${document.type}-${document.number}`}>
                <td className="table-cell">{document.type}</td>
                <td className="table-cell font-semibold">{document.number}</td>
                <td className="table-cell">{shortDate(document.date)}</td>
                <td className="table-cell">{money(document.amount)}</td>
                <td className="table-cell">
                  <StatusPill status={document.status} />
                </td>
                <td className="table-cell text-right">
                  <Link className="btn btn-secondary" href={document.href}>
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!documents.length ? <p className="p-5 text-sm text-muted">No documents for this customer yet.</p> : null}
      </div>
    </>
  );
}
