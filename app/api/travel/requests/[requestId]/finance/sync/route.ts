import { NextResponse } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { mapEnterpriseRoleToTravelActorRole } from "@/services/auth/role-mapping";
import { syncTravelFinance } from "@/services/travel-request-store";

export async function POST(
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

  const guard = await requireApiPermission("travel.finance.sync");
  if (!guard.ok) {
    return guard.response;
  }

  const actorRole = mapEnterpriseRoleToTravelActorRole(guard.user.role);
  if (!actorRole) {
    return NextResponse.json(
      {
        code: "forbidden",
        message: "Your role is not allowed to synchronize ERP entries.",
      },
      { status: 403 },
    );
  }

  const result = await syncTravelFinance({
    requestId,
    actorRole,
    actorName: guard.user.name,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.error.code, number> = {
      request_not_found: 404,
      role_not_allowed: 403,
      validation_failed: 422,
      no_expenses_to_sync: 409,
      already_synced: 409,
      sync_failed: 502,
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
