import { isMicrosoftSsoEnabled } from "@rizlife/shared/portal-auth";
import { LoginCard } from "@rizlife/shared/ui";

export const dynamic = "force-dynamic";

// Fictional account from the local JSON dev database. Shown and pre-filled only in local
// development: never on a deployed portal, and never with Supabase/Postgres configured.
const DEMO_EMAIL = "admin@apc.edu.ph";
const DEMO_PASSWORD = "Admin@RizLife2026";
const showDemoAccount =
  process.env.NODE_ENV !== "production" &&
  !process.env.DATABASE_URL?.trim() &&
  !process.env.SUPABASE_URL?.trim();

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMap: Record<string, string> = {
    session_expired:
      "Your session has ended (your password or account access changed). Please sign in again.",
    unauthorized:
      "Access restricted to Administrator accounts. Teachers and Students should sign in on their dedicated portals.",
    sso_disabled:
      "Microsoft sign-in is currently turned off by the RizLife administrator. Please use your email and password below.",
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
      defaultDemoEmail={showDemoAccount ? DEMO_EMAIL : undefined}
      defaultDemoPassword={showDemoAccount ? DEMO_PASSWORD : undefined}
      microsoftSsoConfigured={await isMicrosoftSsoEnabled()}
      initialError={
        params.error
          ? errorMap[params.error] ?? "Sign-in could not be completed. Please try again."
          : null
      }
    />
  );
}
