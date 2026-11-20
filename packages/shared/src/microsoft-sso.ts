import type { PortalKey } from "./types";

export interface MicrosoftProfile {
  oid: string;
  email: string;
  firstName: string;
  lastName: string;
}

export function getMicrosoftSsoConfig() {
  const clientId = process.env.AZURE_AD_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET?.trim() ?? "";
  const tenantId = process.env.AZURE_AD_TENANT_ID?.trim() ?? "";

  return {
    configured: Boolean(clientId && clientSecret && tenantId),
    clientId,
    clientSecret,
    tenantId,
  };
}

export function isMicrosoftSsoConfigured(): boolean {
  return getMicrosoftSsoConfig().configured;
}

export function buildMicrosoftAuthUrl(params: {
  redirectUri: string;
  state: string;
  portal: PortalKey;
}): string {
  const { configured, clientId, tenantId } = getMicrosoftSsoConfig();
  if (!configured) {
    throw new Error("Microsoft Entra ID SSO is not configured yet.");
  }

  const query = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: params.redirectUri,
    response_mode: "query",
    scope: "openid profile email User.Read",
    state: `${params.portal}:${params.state}`,
    prompt: "select_account",
  });

  return `https://login.microsoftonline.com/${encodeURIComponent(
    tenantId
  )}/oauth2/v2.0/authorize?${query.toString()}`;
}

export async function exchangeMicrosoftCode(params: {
  code: string;
  redirectUri: string;
}): Promise<MicrosoftProfile> {
  const { configured, clientId, clientSecret, tenantId } = getMicrosoftSsoConfig();
  if (!configured) {
    throw new Error("Microsoft Entra ID SSO is not configured yet.");
  }

  const tokenEndpoint = `https://login.microsoftonline.com/${encodeURIComponent(
    tenantId
  )}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
    scope: "openid profile email User.Read",
  });

  const tokenRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Microsoft token exchange failed: ${errText}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error("Microsoft token response missing access_token.");
  }

  const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!meRes.ok) {
    const errText = await meRes.text();
    throw new Error(`Microsoft Graph /me lookup failed: ${errText}`);
  }

  const me = (await meRes.json()) as {
    id: string;
    mail?: string | null;
    userPrincipalName?: string | null;
    givenName?: string | null;
    surname?: string | null;
    displayName?: string | null;
  };

  const email = (me.mail || me.userPrincipalName || "").trim().toLowerCase();
  if (!email) {
    throw new Error("Microsoft profile did not return an email address.");
  }

  return {
    oid: me.id,
    email,
    firstName: me.givenName?.trim() || me.displayName?.split(" ")[0] || "APC",
    lastName: me.surname?.trim() || me.displayName?.split(" ").slice(-1)[0] || "User",
  };
}
