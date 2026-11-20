import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  PORTAL_COOKIES,
  getClearCookieOptions,
  verifySessionToken,
} from "@rizlife/shared/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/")
  ) {
    return NextResponse.next();
  }

  const cookieName = PORTAL_COOKIES.teacher;
  const token = req.cookies.get(cookieName)?.value;
  const session = await verifySessionToken(token, "teacher");

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
    if (token) {
      loginUrl.searchParams.set("error", "unauthorized");
    }
    const res = NextResponse.redirect(loginUrl);
    if (token) {
      res.cookies.set(cookieName, "", getClearCookieOptions());
    }
    return res;
  }

  if (session.mustChangePassword && pathname !== "/change-password" && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
