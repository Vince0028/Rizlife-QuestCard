import { redirect } from "next/navigation";
import { SESSION_ENDED_PATH } from "@rizlife/shared/portal-auth";
import { getStudentSession } from "@/lib/session";
import { StudentDashboardClient } from "@/components/StudentDashboardClient";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const session = await getStudentSession();
  if (!session) {
    redirect(SESSION_ENDED_PATH);
  }
  if (session.mustChangePassword) {
    redirect("/change-password");
  }

  return <StudentDashboardClient initialUser={session} />;
}
