import { NextRequest, NextResponse } from "next/server";
import { PORTAL_COOKIES, getCookieOptions } from "@rizlife/shared/auth";
import { performChangePassword } from "@rizlife/shared/portal-auth";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(PORTAL_COOKIES.student)?.value;
  const body = await req.json().catch(() => ({}));
  const result = await performChangePassword(token, "student", body);
  const res = NextResponse.json(result.body, { status: result.status });

  if (result.tokenToSet) {
    res.cookies.set(PORTAL_COOKIES.student, result.tokenToSet, getCookieOptions());
  }
  return res;
}
