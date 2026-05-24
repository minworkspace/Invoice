import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <AppShell companyName={user.company.name} role={user.role} userName={user.name}>
      {children}
    </AppShell>
  );
}
