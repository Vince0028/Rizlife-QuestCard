import { redirect } from "next/navigation";
import { ChangePasswordView } from "@rizlife/shared/ui";
import { getTeacherSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TeacherChangePasswordPage() {
  const session = await getTeacherSession();
  if (!session) redirect("/login");

  return (
    <ChangePasswordView
      userEmail={session.email}
      mustChangePassword={session.mustChangePassword}
    />
  );
}
