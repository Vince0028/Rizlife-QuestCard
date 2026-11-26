import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftLoginRedirectUrl } from "@rizlife/shared/portal-auth";

export async function GET(req: NextRequest) {
  const result = getMicrosoftLoginRedirectUrl(req.nextUrl.origin, "teacher");
  if (!result.ok || !result.url || !result.stateCookie) {
    return NextResponse.redirect(new URL("/login?error=sso_not_configured", req.url));
  }
  const res = NextResponse.redirect(result.url);
  const { name, value, options } = result.stateCookie;
  res.cookies.set(name, value, options);
  return res;
}
