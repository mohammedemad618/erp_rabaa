import { NextResponse } from "next/server";
import { AUTH_SESSION_COOKIE } from "@/services/auth/constants";
import { getSessionCookieOptions } from "@/services/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set(AUTH_SESSION_COOKIE, "", getSessionCookieOptions(0));
  return response;
}
