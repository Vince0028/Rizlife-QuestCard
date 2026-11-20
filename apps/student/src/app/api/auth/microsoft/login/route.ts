import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftLoginRedirectUrl } from "@rizlife/shared/portal-auth";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const result = getMicrosoftLoginRedirectUrl(origin, "student");
  if (!result.ok || !result.url) {
    return NextResponse.redirect(new URL("/login?error=sso_not_configured", req.url));
  }
  return NextResponse.redirect(result.url);
}
