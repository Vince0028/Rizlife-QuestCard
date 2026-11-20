import { redirect } from "next/navigation";
import { getStudentSession } from "@/lib/session";
import { StudentDashboardClient } from "@/components/StudentDashboardClient";

export const dynamic = "force-dynamic";

export default async function StudentDashboardPage() {
  const session = await getStudentSession();
  if (!session) {
    redirect("/login");
  }
  if (session.mustChangePassword) {
    redirect("/change-password");
  }

  return <StudentDashboardClient initialUser={session} />;
}
