import { isMicrosoftSsoConfigured } from "@rizlife/shared/microsoft-sso";
import { LoginCard } from "@rizlife/shared/ui";

export const dynamic = "force-dynamic";

export default async function StudentLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMap: Record<string, string> = {
    unauthorized:
      "Access restricted to Student accounts (@student.apc.edu.ph). Teachers and Admins should use their dedicated portal.",
    sso_not_configured:
      "Microsoft SSO awaits APC IT tenant credentials. Please use your email and password below.",
    sso_account_not_provisioned:
      "Your Microsoft account is not yet enrolled in RizLife QuestCard. Ask your instructor to add your roster email.",
    sso_failed: "Microsoft sign-in could not be completed. Please try again.",
    sso_cancelled: "Microsoft sign-in was cancelled.",
    sso_missing_code: "Microsoft did not return a sign-in code. Please try again.",
    sso_state_mismatch:
      "Your Microsoft sign-in expired or was started in another tab. Please try again.",
    sso_domain_not_allowed:
      "Use your APC Microsoft account (@student.apc.edu.ph).",
    sso_account_conflict:
      "This RizLife account is linked to a different Microsoft account. Ask your instructor or the RizLife administrator for help.",
  };

  return (
    <LoginCard
      portal="student"
      portalTitle="Student QuestCard"
      portalSubtitle="Sign in to view your Rizal tasks, submit OpenLearning links, and track your stamps."
      defaultDemoEmail="vpalobin@student.apc.edu.ph"
      defaultDemoPassword="Student@2026"
      microsoftSsoConfigured={isMicrosoftSsoConfigured()}
      initialError={
        params.error
          ? errorMap[params.error] ?? "Sign-in could not be completed. Please try again."
          : null
      }
    />
  );
}
