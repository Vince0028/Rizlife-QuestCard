import { isMicrosoftSsoConfigured } from "@rizlife/shared/microsoft-sso";
import { LoginCard } from "@rizlife/shared/ui";

export const dynamic = "force-dynamic";

export default async function TeacherLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMap: Record<string, string> = {
    unauthorized:
      "Access restricted to Faculty & Admin accounts (@apc.edu.ph). Students should use the Student QuestCard portal.",
    sso_not_configured:
      "Microsoft SSO awaits APC IT tenant credentials. Please use your faculty email and password below.",
    sso_account_not_provisioned:
      "Your Microsoft account is not yet provisioned as a Teacher. Contact the RizLife Administrator.",
    sso_failed: "Microsoft sign-in could not be completed. Please try again.",
  };

  return (
    <LoginCard
      portal="teacher"
      portalTitle="Teacher Command Center"
      portalSubtitle="Review OpenLearning submissions, stamp QuestCards, manage rosters, and control class leaderboards."
      defaultDemoEmail="teacher@apc.edu.ph"
      defaultDemoPassword="Teacher@RizLife2026"
      microsoftSsoConfigured={isMicrosoftSsoConfigured()}
      initialError={params.error ? errorMap[params.error] || params.error : null}
    />
  );
}
