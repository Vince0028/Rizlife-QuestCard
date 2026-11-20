import { NextResponse } from "next/server";
import { PORTAL_COOKIES, getClearCookieOptions } from "@rizlife/shared/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PORTAL_COOKIES.admin, "", getClearCookieOptions());
  return res;
}
