import { isMicrosoftSsoConfigured } from "@rizlife/shared/microsoft-sso";
import { LoginCard } from "@rizlife/shared/ui";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMap: Record<string, string> = {
    unauthorized:
      "Access restricted to Administrator accounts. Teachers and Students should sign in on their dedicated portals.",
    sso_not_configured:
      "Microsoft SSO awaits APC IT tenant credentials. Please sign in with your administrator email and password.",
    sso_account_not_provisioned:
      "Your Microsoft account does not have Administrator access.",
    sso_failed: "Microsoft sign-in could not be completed. Please try again.",
    sso_cancelled: "Microsoft sign-in was cancelled.",
    sso_missing_code: "Microsoft did not return a sign-in code. Please try again.",
    sso_state_mismatch:
      "Your Microsoft sign-in expired or was started in another tab. Please try again.",
    sso_domain_not_allowed: "Use your APC Microsoft account (@apc.edu.ph).",
    sso_account_conflict:
      "This account is linked to a different Microsoft account. Sign in with your password, or contact another RizLife administrator.",
  };

  return (
    <LoginCard
      portal="admin"
      portalTitle="Admin Console"
      portalSubtitle="Provision teacher & student accounts, configure global email digests, and override any RizLife section."
      defaultDemoEmail="admin@apc.edu.ph"
      defaultDemoPassword="Admin@RizLife2026"
      microsoftSsoConfigured={isMicrosoftSsoConfigured()}
      initialError={
        params.error
          ? errorMap[params.error] ?? "Sign-in could not be completed. Please try again."
          : null
      }
    />
  );
}
