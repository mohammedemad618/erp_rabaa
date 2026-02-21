import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_SESSION_COOKIE } from "@/services/auth/constants";

const LOCALE_PATTERN = /^\/(en|ar)(?:\/|$)/i;

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public") ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|woff|woff2)$/i.test(pathname)
  );
}

function extractLocale(pathname: string): string | null {
  const match = pathname.match(LOCALE_PATTERN);
  if (!match) {
    return null;
  }
  return match[1].toLowerCase();
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get(AUTH_SESSION_COOKIE)?.value;

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    if (!sessionToken) {
      return NextResponse.json(
        {
          code: "unauthorized",
          message: "Authentication required.",
        },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  const locale = extractLocale(pathname);
  if (!locale) {
    return NextResponse.next();
  }

  const isLoginRoute = pathname === `/${locale}/login` || pathname.startsWith(`/${locale}/login/`);
  if (!sessionToken && !isLoginRoute) {
    const loginUrl = new URL(`/${locale}/login`, request.url);
    const nextPath = `${pathname}${search}`;
    loginUrl.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
