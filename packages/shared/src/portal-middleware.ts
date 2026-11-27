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

export function createPortalMiddleware(
  portal: PortalKey,
  options: { publicPrefixes?: string[] } = {}
) {
  const publicPrefixes = [...ALWAYS_PUBLIC_PREFIXES, ...(options.publicPrefixes ?? [])];
  const cookieName = PORTAL_COOKIES[portal];

  return async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

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
