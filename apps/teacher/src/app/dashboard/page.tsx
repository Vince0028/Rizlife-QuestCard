import { redirect } from "next/navigation";
import { SESSION_ENDED_PATH } from "@rizlife/shared/portal-auth";
import { listManageableSections } from "@rizlife/shared/workspace-service";
import { getTeacherSession } from "@/lib/session";
import { TeacherDashboardClient } from "@/components/TeacherDashboardClient";

export const dynamic = "force-dynamic";

export default async function TeacherDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; tab?: string }>;
}) {
  const session = await getTeacherSession();
  if (!session) redirect(SESSION_ENDED_PATH);
  if (session.mustChangePassword) redirect("/change-password");

  const params = await searchParams;
  const sections = await listManageableSections(session);

  return (
    <TeacherDashboardClient
      user={session}
      initialSections={sections.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        term: s.term,
        teacherId: s.teacherId,
        teacher: s.teacher,
        _count: s._count,
      }))}
      initialSectionId={params.section ?? null}
      initialTab={params.tab ?? null}
    />
  );
}
