/**
 * Edge middleware shared by the three portals: validates the portal's own session
 * cookie, sends signed-out users to /login (401 JSON for /api/*), clears invalid
 * cookies, and forces /change-password while `mustChangePassword` is set.
 *
 * Each app keeps a literal `export const config = { matcher }` in its own
 * src/middleware.ts, since Next.js reads that statically.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { PORTAL_COOKIES, getClearCookieOptions, verifySessionToken } from "./auth";
import type { PortalKey } from "./types";

const ALWAYS_PUBLIC_PREFIXES = ["/_next", "/favicon", "/api/auth/"];
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence for state-changing API calls (including login/logout): a browser always
 * sends `Origin` on cross-origin POST/PATCH/DELETE, so it must name this host. Requests
 * without `Origin` (curl, server-to-server) are allowed unless the browser marks them
 * `Sec-Fetch-Site: cross-site`. The SameSite=Lax session cookie is the second layer.
 */
export function isCrossSiteApiWrite(req: NextRequest): boolean {
  if (SAFE_METHODS.has(req.method) || !req.nextUrl.pathname.startsWith("/api/")) {
    return false;
  }
  const origin = req.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return true; // "null" or garbage
    }
    const ownHosts = [
      req.headers.get("x-forwarded-host"),
      req.headers.get("host"),
      req.nextUrl.host,
    ].filter(Boolean);
    return !ownHosts.includes(originHost);
  }
  return req.headers.get("sec-fetch-site") === "cross-site";
}

export function createPortalMiddleware(
  portal: PortalKey,
  options: { publicPrefixes?: string[] } = {}
) {
  const publicPrefixes = [...ALWAYS_PUBLIC_PREFIXES, ...(options.publicPrefixes ?? [])];
  const cookieName = PORTAL_COOKIES[portal];

  return async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (isCrossSiteApiWrite(req)) {
      return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
    }

    if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) {
      return NextResponse.next();
    }

    const token = req.cookies.get(cookieName)?.value;
    const session = await verifySessionToken(token, portal);

    if (pathname === "/login") {
      if (session) {
        return NextResponse.redirect(
          new URL(session.mustChangePassword ? "/change-password" : "/dashboard", req.url)
        );
      }
      return NextResponse.next();
    }

    if (!session) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", req.url);
      if (token) loginUrl.searchParams.set("error", "unauthorized");
      const res = NextResponse.redirect(loginUrl);
      if (token) res.cookies.set(cookieName, "", getClearCookieOptions());
      return res;
    }

    if (
      session.mustChangePassword &&
      pathname !== "/change-password" &&
      !pathname.startsWith("/api/")
    ) {
      return NextResponse.redirect(new URL("/change-password", req.url));
    }

    return NextResponse.next();
  };
}
