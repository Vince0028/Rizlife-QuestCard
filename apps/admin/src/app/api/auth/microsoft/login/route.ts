import { NextRequest, NextResponse } from "next/server";
import { getMicrosoftLoginRedirectUrl } from "@rizlife/shared/portal-auth";

export async function GET(req: NextRequest) {
  const result = getMicrosoftLoginRedirectUrl(req.nextUrl.origin, "admin");
  if (!result.ok || !result.url) {
    return NextResponse.redirect(new URL("/login?error=sso_not_configured", req.url));
  }
  return NextResponse.redirect(result.url);
}
