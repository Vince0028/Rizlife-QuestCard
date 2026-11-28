import { redirect } from "next/navigation";
import { SESSION_ENDED_PATH } from "@rizlife/shared/portal-auth";
import { ChangePasswordView } from "@rizlife/shared/ui";
import { getStudentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function StudentChangePasswordPage() {
  const session = await getStudentSession();
  if (!session) {
    redirect(SESSION_ENDED_PATH);
  }

  return (
    <ChangePasswordView
      userEmail={session.email}
      mustChangePassword={session.mustChangePassword}
    />
  );
}
