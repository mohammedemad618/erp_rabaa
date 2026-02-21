import { NextResponse } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { getTravelInsights } from "@/services/travel-request-store";

export async function GET() {
  const guard = await requireApiPermission("travel.view");
  if (!guard.ok) {
    return guard.response;
  }
  return NextResponse.json(getTravelInsights(), { status: 200 });
}
