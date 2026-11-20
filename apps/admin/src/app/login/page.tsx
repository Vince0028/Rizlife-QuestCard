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
  };

  return (
    <LoginCard
      portal="admin"
      portalTitle="Admin Console"
      portalSubtitle="Provision teacher & student accounts, configure global email digests, and override any RizLife section."
      defaultDemoEmail="admin@apc.edu.ph"
      defaultDemoPassword="Admin@RizLife2026"
      microsoftSsoConfigured={isMicrosoftSsoConfigured()}
      initialError={params.error ? errorMap[params.error] || params.error : null}
    />
  );
}
