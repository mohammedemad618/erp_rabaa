import { NextResponse } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { getTravelInsights } from "@/services/travel-request-store";

export async function GET() {
  try {
    const guard = await requireApiPermission("travel.view");
    if (!guard.ok) {
      return guard.response;
    }
    return NextResponse.json(await getTravelInsights(), { status: 200 });
  } catch (error) {
    console.error("[api/travel/insights/overview][GET] failed", error);
    return NextResponse.json(
      {
        code: "internal_error",
        message: "Unable to fetch travel insights.",
      },
      { status: 500 },
    );
  }
}
