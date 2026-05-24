import Link from "next/link";
import { redirect } from "next/navigation";
import { clearSession } from "@/lib/auth";

type AdminShellProps = {
  children: React.ReactNode;
  userName: string;
};

const links = [
  ["Overview", "/admin"],
  ["Companies", "/admin/companies"],
  ["Users", "/admin/users"],
  ["Documents", "/admin/documents"],
  ["Activity", "/admin/activity"]
];

async function logoutAction() {
  "use server";
  await clearSession();
  redirect("/login");
}

export function AdminShell({ children, userName }: AdminShellProps) {
  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line bg-white lg:block">
        <div className="border-b border-line px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">System owner</p>
          <h1 className="mt-1 text-lg font-bold text-ink">Super Admin</h1>
        </div>
        <nav className="space-y-1 px-3 py-4">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="block rounded-md px-3 py-2 text-sm font-semibold text-muted hover:bg-paper hover:text-ink"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="block rounded-md px-3 py-2 text-sm font-semibold text-muted hover:bg-paper hover:text-ink"
          >
            Company App
          </Link>
        </nav>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav className="flex gap-2 overflow-x-auto lg:hidden">
              {links.map(([label, href]) => (
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
