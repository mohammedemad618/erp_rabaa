import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_SESSION_COOKIE } from "@/services/auth/constants";
import { getRolePermissions } from "@/services/auth/rbac";
import { verifySessionToken } from "@/services/auth/session";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  const user = token ? verifySessionToken(token) : null;

  if (!user) {
    return NextResponse.json(
      {
        authenticated: false,
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user,
      permissions: getRolePermissions(user.role),
    },
    { status: 200 },
  );
}
