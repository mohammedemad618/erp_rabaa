import { NextResponse } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { getActiveTravelPolicyVersion } from "@/services/travel-policy-store";

export async function GET() {
  const guard = await requireApiPermission("travel.policy.view");
  if (!guard.ok) {
    return guard.response;
  }

  const activeVersion = getActiveTravelPolicyVersion();
  return NextResponse.json(activeVersion, { status: 200 });
}
