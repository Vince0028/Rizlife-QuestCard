/**
 * Client-side fetch wrapper for the portals' own JSON APIs. It never throws:
 * - network failures and non-JSON bodies (e.g. a proxy's HTML 502 page) become an
 *   `ok: false` result instead of an unhandled rejection;
 * - every failed result carries a human-readable `data.error`, so callers can always do
 *   `if (!res.ok) showToast("err", res.data.error)`.
 */
// Response bodies are endpoint-specific JSON; callers narrow `data` themselves.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiData = { error?: string; [key: string]: any };

export interface ApiResult {
  ok: boolean;
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;
  data: ApiData;
}

function defaultErrorFor(status: number): string {
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 403) return "You don't have permission to do that.";
  if (status === 404) return "That item no longer exists. Refresh and try again.";
  if (status === 413) return "That file is too large to upload.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "The server had a problem. Please try again in a moment.";
  return `Request failed (HTTP ${status}).`;
}

export async function apiFetch(input: string, init?: RequestInit): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch {
    return {
      ok: false,
      status: 0,
      data: { error: "Network error. Check your connection and try again." },
    };
  }

  let data: ApiData = {};
  const text = await res.text().catch(() => "");
  if (text) {
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as ApiData;
    } catch {
      // Non-JSON body: keep `data` empty; the default error below explains the failure.
    }
  }
  if (!res.ok && typeof data.error !== "string") {
    data = { ...data, error: defaultErrorFor(res.status) };
  }
  // The session was revoked while the page was open (password reset, deactivation,
  // role change): clear the cookie and go to the login page.
  if (res.status === 401 && typeof window !== "undefined") {
    window.location.assign("/api/auth/session-ended");
  }
  // A temporary password must be changed before the API can be used.
  if (res.status === 403 && data.mustChangePassword === true && typeof window !== "undefined") {
    window.location.assign("/change-password");
  }
  return { ok: res.ok, status: res.status, data };
}
