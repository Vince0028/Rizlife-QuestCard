import { redirect } from "next/navigation";
import { ChangePasswordView } from "@rizlife/shared/ui";
import { getStudentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StudentChangePasswordPage() {
  const session = await getStudentSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <ChangePasswordView
      userEmail={session.email}
      mustChangePassword={session.mustChangePassword}
    />
  );
}
