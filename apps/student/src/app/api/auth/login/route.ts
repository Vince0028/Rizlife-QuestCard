import { NextRequest, NextResponse } from "next/server";
import { PORTAL_COOKIES, getCookieOptions } from "@rizlife/shared/auth";
import { performPortalLogin } from "@rizlife/shared/portal-auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = await performPortalLogin(body, "student");
  const res = NextResponse.json(result.body, { status: result.status });

  if (result.tokenToSet) {
    res.cookies.set(PORTAL_COOKIES.student, result.tokenToSet, getCookieOptions());
  }
  return res;
}
