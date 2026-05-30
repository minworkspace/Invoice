import Link from "next/link";
import { redirect } from "next/navigation";
import { clearSession } from "@/lib/auth";

type AppShellProps = {
  companyName: string;
  role?: string;
  userName: string;
  children: React.ReactNode;
};

const links = [
  ["Dashboard", "/dashboard"],
  ["Customers", "/customers"],
  ["Quotations", "/quotations"],
  ["Invoices", "/invoices"],
  ["Receipts", "/receipts"],
  ["Settings", "/settings"]
];

const superAdminLinks = [
  ["Admin", "/admin"],
  ["Companies", "/admin/companies"],
  ["Users", "/admin/users"],
  ["Documents", "/admin/documents"]
];

async function logoutAction() {
  "use server";
  await clearSession();
  redirect("/login");
}

export function AppShell({ companyName, role, userName, children }: AppShellProps) {
  const visibleLinks = role === "SUPER_ADMIN" ? superAdminLinks : links;

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white lg:block">
        <div className="border-b border-line px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Company</p>
          <h1 className="mt-1 text-lg font-bold text-ink">{companyName}</h1>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {visibleLinks.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="block rounded-md px-3 py-2 text-sm font-semibold text-muted hover:bg-paper hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="lg:hidden">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Company</p>
              <p className="text-base font-bold">{companyName}</p>
            </div>
            <nav className="flex gap-2 overflow-x-auto lg:hidden">
              {visibleLinks.map(([label, href]) => (
                <Link key={href} href={href} className="btn btn-secondary h-9 whitespace-nowrap px-3">
                  {label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-muted">{userName}</span>
              <form action={logoutAction}>
                <button className="btn btn-secondary h-9" type="submit">
                  Log out
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-[1720px] px-3 py-6 sm:px-4 lg:px-5">{children}</main>
      </div>
    </div>
  );
}
