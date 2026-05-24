import Link from "next/link";
import { DocumentStatus, Prisma } from "@prisma/client";
import { AdminPager } from "@/components/AdminPager";
import { StatusPill } from "@/components/StatusPill";
import { pageCount, pageNumber, pagination } from "@/lib/admin-utils";
import { requireSuperAdmin } from "@/lib/auth";
import { money, shortDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type DocumentKind = "invoice" | "quotation" | "receipt";

type AdminDocumentRow = {
  id: string;
  type: "Invoice" | "Quotation" | "Receipt";
  number: string;
  companyId: string;
  companyName: string;
  customerName: string;
  date: Date;
  amount: Prisma.Decimal;
  status: DocumentStatus;
  pdfUrl: string | null;
};

function documentKind(value?: string): DocumentKind {
  if (value === "quotation" || value === "receipt") return value;
  return "invoice";
}

export default async function AdminDocumentsPage({
  searchParams
}: {
  searchParams: Promise<{ type?: string; q?: string; status?: string; companyId?: string; page?: string }>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const type = documentKind(params.type);
  const q = params.q?.trim();
  const page = pageNumber(params.page);
  const status = Object.values(DocumentStatus).includes(params.status as DocumentStatus)
    ? (params.status as DocumentStatus)
    : undefined;

  const common = {
    ...(params.companyId ? { companyId: params.companyId } : {}),
    ...(status ? { status } : {})
  };

  let rows: AdminDocumentRow[] = [];
  let total = 0;

  if (type === "invoice") {
    const where: Prisma.InvoiceWhereInput = {
      ...common,
      ...(q
        ? {
            OR: [
              { invoiceNumber: { contains: q } },
              { customer: { name: { contains: q } } },
              { company: { name: { contains: q } } }
            ]
          }
        : {})
    };
    const [count, docs] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        ...pagination(page),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          invoiceNumber: true,
          issueDate: true,
          total: true,
          status: true,
          pdfUrl: true,
          company: { select: { id: true, name: true } },
          customer: { select: { name: true } }
        }
      })
    ]);
    total = count;
    rows = docs.map((doc) => ({
      id: doc.id,
      type: "Invoice",
      number: doc.invoiceNumber,
      companyId: doc.company.id,
      companyName: doc.company.name,
      customerName: doc.customer.name,
      date: doc.issueDate,
      amount: doc.total,
      status: doc.status,
      pdfUrl: doc.pdfUrl
    }));
  } else if (type === "quotation") {
    const where: Prisma.QuotationWhereInput = {
      ...common,
      ...(q
        ? {
            OR: [
              { quotationNumber: { contains: q } },
              { customer: { name: { contains: q } } },
              { company: { name: { contains: q } } }
            ]
          }
        : {})
    };
    const [count, docs] = await Promise.all([
      prisma.quotation.count({ where }),
      prisma.quotation.findMany({
        where,
        ...pagination(page),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          quotationNumber: true,
          issueDate: true,
          total: true,
          status: true,
          pdfUrl: true,
          company: { select: { id: true, name: true } },
          customer: { select: { name: true } }
        }
      })
    ]);
    total = count;
    rows = docs.map((doc) => ({
      id: doc.id,
      type: "Quotation",
      number: doc.quotationNumber,
      companyId: doc.company.id,
      companyName: doc.company.name,
      customerName: doc.customer.name,
      date: doc.issueDate,
      amount: doc.total,
      status: doc.status,
      pdfUrl: doc.pdfUrl
    }));
  } else {
    const where: Prisma.ReceiptWhereInput = {
      ...common,
      ...(q
        ? {
            OR: [
              { receiptNumber: { contains: q } },
              { customer: { name: { contains: q } } },
              { company: { name: { contains: q } } },
              { invoice: { invoiceNumber: { contains: q } } }
            ]
          }
        : {})
    };
    const [count, docs] = await Promise.all([
      prisma.receipt.count({ where }),
      prisma.receipt.findMany({
        where,
        ...pagination(page),
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          receiptNumber: true,
          receiptDate: true,
          amount: true,
          status: true,
          pdfUrl: true,
          company: { select: { id: true, name: true } },
          customer: { select: { name: true } }
        }
      })
    ]);
    total = count;
    rows = docs.map((doc) => ({
      id: doc.id,
      type: "Receipt",
      number: doc.receiptNumber,
      companyId: doc.company.id,
      companyName: doc.company.name,
      customerName: doc.customer.name,
      date: doc.receiptDate,
      amount: doc.amount,
      status: doc.status,
      pdfUrl: doc.pdfUrl
    }));
  }

  const scopedCompany = params.companyId
    ? await prisma.company.findUnique({ where: { id: params.companyId }, select: { id: true, name: true } })
    : null;
  const pages = pageCount(total);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Read-only document overview</p>
        <h1 className="mt-1 text-3xl font-bold text-ink">Documents</h1>
        <p className="mt-2 text-sm text-muted">
          Company names are shown clearly. Editing stays inside explicit company workflows.
          {scopedCompany ? (
            <>
              {" "}Filtered to{" "}
              <Link className="font-semibold text-brand" href={`/admin/companies/${scopedCompany.id}`}>
                {scopedCompany.name}
              </Link>
              .
            </>
          ) : null}
        </p>
      </header>

      <form className="panel grid gap-3 md:grid-cols-2 xl:grid-cols-[160px_1fr_180px_auto_auto]">
        {params.companyId ? <input name="companyId" type="hidden" value={params.companyId} /> : null}
        <select className="field" name="type" defaultValue={type}>
          <option value="invoice">Invoices</option>
          <option value="quotation">Quotations</option>
          <option value="receipt">Receipts</option>
        </select>
        <input className="field" name="q" placeholder="Search number, customer, company" defaultValue={q || ""} />
        <select className="field" name="status" defaultValue={status || ""}>
          <option value="">All statuses</option>
          {Object.values(DocumentStatus).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
        {params.companyId ? (
          <Link className="btn btn-secondary" href={`/admin/documents?type=${type}`}>
            Clear company
          </Link>
        ) : null}
      </form>

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Number</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">PDF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="table-cell">{row.type}</td>
                <td className="table-cell font-semibold">{row.number}</td>
                <td className="table-cell">
                  <Link className="font-semibold text-brand" href={`/admin/companies/${row.companyId}`}>
                    {row.companyName}
                  </Link>
                </td>
                <td className="table-cell">{row.customerName}</td>
                <td className="table-cell">{shortDate(row.date)}</td>
                <td className="table-cell">{money(row.amount)}</td>
                <td className="table-cell">
                  <StatusPill status={row.status} />
                </td>
                <td className="table-cell">
                  {row.pdfUrl ? (
                    <a className="font-semibold text-brand" href={`/api/documents/${row.type.toUpperCase()}/${row.id}/pdf`}>
                      View PDF
                    </a>
                  ) : (
                    <span className="text-muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="p-5 text-sm text-muted">No documents found.</p> : null}
      </div>

      <AdminPager
        basePath="/admin/documents"
        page={page}
        pages={pages}
        params={{ type, q, status, companyId: params.companyId }}
      />
    </div>
  );
}
