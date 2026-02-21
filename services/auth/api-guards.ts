import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_SESSION_COOKIE } from "@/services/auth/constants";
import type { AuthPermission } from "@/services/auth/rbac";
import { hasPermission } from "@/services/auth/rbac";
import { verifySessionToken } from "@/services/auth/session";
import type { SessionPayload } from "@/services/auth/types";

interface ApiPermissionResult {
  ok: true;
  user: SessionPayload;
}

interface ApiPermissionFailure {
  ok: false;
  response: NextResponse;
}

export type ApiPermissionGuardResult = ApiPermissionResult | ApiPermissionFailure;

export async function requireApiPermission(
  permission: AuthPermission,
): Promise<ApiPermissionGuardResult> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  const user = token ? verifySessionToken(token) : null;

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: "unauthorized",
          message: "Authentication required.",
        },
        { status: 401 },
      ),
    };
  }

  if (!hasPermission(user.role, permission)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: "forbidden",
          message: "You do not have permission to perform this action.",
        },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    user,
  };
}
