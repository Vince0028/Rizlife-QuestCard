import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftLoginRedirectUrl } from "@rizlife/shared/portal-auth";

export async function GET(req: NextRequest) {
  const result = await getMicrosoftLoginRedirectUrl(req.nextUrl.origin, "admin");
  if (!result.ok || !result.url || !result.stateCookie) {
    const error = result.error ?? "sso_not_configured";
    return NextResponse.redirect(new URL(`/login?error=${error}`, req.url));
  }
  const res = NextResponse.redirect(result.url);
  const { name, value, options } = result.stateCookie;
  res.cookies.set(name, value, options);
  return res;
}
