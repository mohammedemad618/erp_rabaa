import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_SESSION_COOKIE } from "@/services/auth/constants";
import { getRolePermissions } from "@/services/auth/rbac";
import {
  createSessionToken,
  getSessionCookieOptions,
} from "@/services/auth/session";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { authenticateUser } from "@/services/auth/user-directory";

interface LoginRequestBody {
  email?: string;
  password?: string;
}

export async function POST(request: NextRequest) {
  const parsedBody = await parseJsonBodySafe<LoginRequestBody>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "Email and password are required.",
      },
      { status: 422 },
    );
  }

  const user = await authenticateUser(email, password);
  if (!user) {
    return NextResponse.json(
      {
        code: "invalid_credentials",
        message: "Invalid email or password.",
      },
      { status: 401 },
    );
  }

  const token = createSessionToken(user);
  const response = NextResponse.json(
    {
      authenticated: true,
      user,
      permissions: getRolePermissions(user.role),
    },
    { status: 200 },
  );
  response.cookies.set(AUTH_SESSION_COOKIE, token, getSessionCookieOptions());
  return response;
}
