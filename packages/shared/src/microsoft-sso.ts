import crypto from "node:crypto";
import type { PortalKey } from "./types";

export interface MicrosoftProfile {
  oid: string;
  /** Directory (tenant) id the user signed in from, from the ID token's `tid` claim. */
  tenantId: string | null;
  email: string;
  firstName: string;
  lastName: string;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Multi-tenant authorities accept accounts from ANY Entra tenant. Combined with
// email-based account linking that allows account takeover (a foreign tenant can
// set an arbitrary `mail` attribute), so they are rejected outright.
const MULTI_TENANT_AUTHORITIES = new Set(["common", "organizations", "consumers"]);

let warnedMultiTenant = false;

export function getMicrosoftSsoConfig() {
  const clientId = process.env.AZURE_AD_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET?.trim() ?? "";
  const tenantId = process.env.AZURE_AD_TENANT_ID?.trim() ?? "";

  const multiTenant = MULTI_TENANT_AUTHORITIES.has(tenantId.toLowerCase());
  if (multiTenant && !warnedMultiTenant) {
    warnedMultiTenant = true;
    console.warn(
      `[RizLife SSO] AZURE_AD_TENANT_ID="${tenantId}" is a multi-tenant authority; Microsoft SSO is disabled. ` +
        "Set it to the APC tenant ID (GUID) or primary domain."
    );
  }

  return {
    configured: Boolean(clientId && clientSecret && tenantId) && !multiTenant,
    clientId,
    clientSecret,
    tenantId,
  };
}

export function isMicrosoftSsoConfigured(): boolean {
  return getMicrosoftSsoConfig().configured;
}

/** OAuth `state` + PKCE verifier for one sign-in attempt. */
export function createMicrosoftSsoAttempt(portal: PortalKey) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  return {
    state: `${portal}:${nonce}`,
    codeVerifier,
    codeChallenge: crypto.createHash("sha256").update(codeVerifier).digest("base64url"),
  };
}

export function buildMicrosoftAuthUrl(params: {
  redirectUri: string;
  state: string;
  codeChallenge: string;
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
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });

  return `https://login.microsoftonline.com/${encodeURIComponent(
    tenantId
  )}/oauth2/v2.0/authorize?${query.toString()}`;
}

/**
 * Reads claims from an ID token received directly from the token endpoint over TLS
 * (back channel), where OIDC Core §3.1.3.7 allows skipping signature validation.
 */
function readIdTokenClaims(idToken: string | undefined): Record<string, unknown> {
  if (!idToken) return {};
  try {
    const payload = idToken.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  } catch {
    return {};
  }
}

export async function exchangeMicrosoftCode(params: {
  code: string;
  redirectUri: string;
  codeVerifier: string;
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
    code_verifier: params.codeVerifier,
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

  const tokenData = (await tokenRes.json()) as { access_token?: string; id_token?: string };
  if (!tokenData.access_token) {
    throw new Error("Microsoft token response missing access_token.");
  }

  const claims = readIdTokenClaims(tokenData.id_token);
  const tid = typeof claims.tid === "string" ? claims.tid : null;
  if (GUID.test(tenantId) && tid?.toLowerCase() !== tenantId.toLowerCase()) {
    throw new Error(
      `Microsoft sign-in came from tenant ${tid ?? "(unknown)"}, expected ${tenantId}.`
    );
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

  if (typeof claims.oid === "string" && claims.oid !== me.id) {
    throw new Error("Microsoft ID token and Graph profile refer to different users.");
  }

  const email = (me.mail || me.userPrincipalName || "").trim().toLowerCase();
  if (!email) {
    throw new Error("Microsoft profile did not return an email address.");
  }

  return {
    oid: me.id,
    tenantId: tid,
    email,
    firstName: me.givenName?.trim() || me.displayName?.split(" ")[0] || "APC",
    lastName: me.surname?.trim() || me.displayName?.split(" ").slice(-1)[0] || "User",
  };
}
