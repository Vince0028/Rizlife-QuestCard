import { redirect } from "next/navigation";
import { ChangePasswordView } from "@rizlife/shared/ui";
import { getAdminSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminChangePasswordPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  return (
    <ChangePasswordView
      userEmail={session.email}
      mustChangePassword={session.mustChangePassword}
    />
  );
}
