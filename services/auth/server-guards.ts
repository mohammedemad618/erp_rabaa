import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_SESSION_COOKIE } from "@/services/auth/constants";
import type { AuthPermission } from "@/services/auth/rbac";
import { hasPermission } from "@/services/auth/rbac";
import { verifySessionToken } from "@/services/auth/session";
import type { SessionPayload } from "@/services/auth/types";

function loginPath(locale: string, nextPath?: string): string {
  if (!nextPath) {
    return `/${locale}/login`;
  }
  return `/${locale}/login?next=${encodeURIComponent(nextPath)}`;
}

export async function getCurrentSessionUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function requireAuthenticatedUser(
  locale: string,
  nextPath?: string,
): Promise<SessionPayload> {
  const user = await getCurrentSessionUser();
  if (!user) {
    redirect(loginPath(locale, nextPath));
  }
  return user;
}

export async function requirePermission(
  locale: string,
  permission: AuthPermission,
  nextPath?: string,
): Promise<SessionPayload> {
  const user = await requireAuthenticatedUser(locale, nextPath);
  if (!hasPermission(user.role, permission)) {
    redirect(`/${locale}/forbidden`);
  }
  return user;
}
