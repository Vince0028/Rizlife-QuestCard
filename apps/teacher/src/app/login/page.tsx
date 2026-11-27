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
    sso_cancelled: "Microsoft sign-in was cancelled.",
    sso_missing_code: "Microsoft did not return a sign-in code. Please try again.",
    sso_state_mismatch:
      "Your Microsoft sign-in expired or was started in another tab. Please try again.",
    sso_domain_not_allowed: "Use your APC faculty Microsoft account (@apc.edu.ph).",
    sso_account_conflict:
      "This RizLife account is linked to a different Microsoft account. Contact the RizLife Administrator.",
  };

  return (
    <LoginCard
      portal="teacher"
      portalTitle="Teacher Command Center"
      portalSubtitle="Review OpenLearning submissions, stamp QuestCards, manage rosters, and control class leaderboards."
      defaultDemoEmail="teacher@apc.edu.ph"
      defaultDemoPassword="Teacher@RizLife2026"
      microsoftSsoConfigured={isMicrosoftSsoConfigured()}
      initialError={
        params.error
          ? errorMap[params.error] ?? "Sign-in could not be completed. Please try again."
          : null
      }
    />
  );
}
