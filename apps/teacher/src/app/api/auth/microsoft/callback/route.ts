import { NextRequest, NextResponse } from "next/server";
import { getCookieOptions } from "@rizlife/shared/auth";
import { performMicrosoftCallback } from "@rizlife/shared/portal-auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const result = await performMicrosoftCallback({
    code,
    origin: req.nextUrl.origin,
    portal: "teacher",
  });

  const res = NextResponse.redirect(new URL(result.redirectPath, req.url));
  if (result.tokenToSet) {
    res.cookies.set(result.cookieName, result.tokenToSet, getCookieOptions());
  }
  return res;
}
