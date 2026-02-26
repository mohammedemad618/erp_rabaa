import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { mapEnterpriseRoleToTravelActorRole } from "@/services/auth/role-mapping";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { reviewTravelExpense } from "@/services/travel-request-store";

interface DecisionBody {
  decision?: "approve" | "reject";
  note?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string; expenseId: string }> },
) {
  const { requestId, expenseId } = await context.params;
  if (!requestId || !expenseId) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "requestId and expenseId are required.",
      },
      { status: 400 },
    );
  }

  const guard = await requireApiPermission("travel.expense.review");
  if (!guard.ok) {
    return guard.response;
  }

  const actorRole = mapEnterpriseRoleToTravelActorRole(guard.user.role);
  if (!actorRole) {
    return NextResponse.json(
      {
        code: "forbidden",
        message: "Your role is not allowed to review expense claims.",
      },
      { status: 403 },
    );
  }

  const parsedBody = await parseJsonBodySafe<DecisionBody>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  if (!body.decision) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "decision is required.",
      },
      { status: 422 },
    );
  }

  const result = await reviewTravelExpense({
    requestId,
    expenseId,
    actorRole,
    actorName: guard.user.name,
    decision: body.decision,
    note: body.note,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.error.code, number> = {
      request_not_found: 404,
      expense_not_found: 404,
      expense_not_pending: 409,
      role_not_allowed: 403,
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
