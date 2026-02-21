import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { autoApproveTravelRequests } from "@/services/travel-request-store";

interface AutoApproveBody {
  maxEstimatedCost?: number;
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("travel.auto_approve");
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = await parseJsonBodySafe<AutoApproveBody>(request, {
    required: false,
  });
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  const result = autoApproveTravelRequests({
    actorRole: "admin",
    actorName: guard.user.name,
    maxEstimatedCost: body.maxEstimatedCost,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.error.code, number> = {
      role_not_allowed: 403,
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
