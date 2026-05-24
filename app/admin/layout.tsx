import { AdminShell } from "@/components/AdminShell";
import { requireSuperAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin();

  return <AdminShell userName={user.name}>{children}</AdminShell>;
}
