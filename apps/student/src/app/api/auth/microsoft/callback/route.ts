import { NextRequest, NextResponse } from "next/server";
import { getCookieOptions } from "@rizlife/shared/auth";
import {
  MICROSOFT_SSO_STATE_COOKIES,
  performMicrosoftCallback,
} from "@rizlife/shared/portal-auth";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const result = await performMicrosoftCallback({
    code: searchParams.get("code"),
    state: searchParams.get("state"),
    providerError: searchParams.get("error"),
    stateCookieValue: req.cookies.get(MICROSOFT_SSO_STATE_COOKIES.student)?.value,
    origin: req.nextUrl.origin,
    portal: "student",
  });

  const res = NextResponse.redirect(new URL(result.redirectPath, req.url));
  const { name, value, options } = result.clearStateCookie;
  res.cookies.set(name, value, options);
  if (result.tokenToSet) {
    res.cookies.set(result.cookieName, result.tokenToSet, getCookieOptions());
  }
  return res;
}
