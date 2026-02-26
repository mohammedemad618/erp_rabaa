import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { mapEnterpriseRoleToTravelActorRole } from "@/services/auth/role-mapping";
import type { TravelTransitionId } from "@/modules/travel/workflow/travel-approval-engine";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { applyTravelRequestTransition } from "@/services/travel-request-store";

interface TransitionBody {
  transitionId?: TravelTransitionId;
  note?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await context.params;
  if (!requestId) {
    return NextResponse.json(
      {
        code: "invalid_request_id",
        message: "requestId is required.",
      },
      { status: 400 },
    );
  }

  const guard = await requireApiPermission("travel.transition");
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = await parseJsonBodySafe<TransitionBody>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  const actorRole = mapEnterpriseRoleToTravelActorRole(guard.user.role);
  if (!actorRole) {
    return NextResponse.json(
      {
        code: "forbidden",
        message: "Your role is not allowed to transition travel requests.",
      },
      { status: 403 },
    );
  }

  if (!body.transitionId) {
    return NextResponse.json(
      {
        code: "invalid_transition",
        message: "transitionId is required.",
      },
      { status: 400 },
    );
  }

  const result = await applyTravelRequestTransition({
    requestId,
    transitionId: body.transitionId,
    actorRole,
    actorName: guard.user.name,
    note: body.note,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.error.code, number> = {
      request_not_found: 404,
      transition_not_allowed: 409,
      validation_failed: 422,
      note_required: 422,
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
