import { NextResponse } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { getTravelTripClosureReadiness } from "@/services/travel-request-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await context.params;
  if (!requestId) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "requestId is required.",
      },
      { status: 400 },
    );
  }

  const guard = await requireApiPermission("travel.view");
  if (!guard.ok) {
    return guard.response;
  }

  const result = getTravelTripClosureReadiness(requestId);
  if (!result.ok) {
    const statusByCode: Record<typeof result.error.code, number> = {
      request_not_found: 404,
      validation_failed: 422,
    };

    return NextResponse.json(
      {
        code: result.error.code,
        message: result.error.message,
      },
      { status: statusByCode[result.error.code] ?? 400 },
    );
  }

  return NextResponse.json(result.result, { status: 200 });
}
