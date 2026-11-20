import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/session";
import { AdminDashboardClient } from "@/components/AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");
  if (session.mustChangePassword) redirect("/change-password");

  return <AdminDashboardClient user={session} />;
}
