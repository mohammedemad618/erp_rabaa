import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { TravelExpenseCategory } from "@/modules/travel/types";
import { requireApiPermission } from "@/services/auth/api-guards";
import { mapEnterpriseRoleToTravelActorRole } from "@/services/auth/role-mapping";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { submitTravelExpense } from "@/services/travel-request-store";

interface ExpenseBody {
  category?: TravelExpenseCategory;
  amount?: number;
  currency?: string;
  expenseDate?: string;
  merchant?: string;
  description?: string;
  receiptFileName?: string;
  receiptMimeType?: string;
  receiptSizeInBytes?: number;
}

export async function POST(
  request: NextRequest,
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

  const guard = await requireApiPermission("travel.expense.submit");
  if (!guard.ok) {
    return guard.response;
  }

  const actorRole = mapEnterpriseRoleToTravelActorRole(guard.user.role);
  if (!actorRole) {
    return NextResponse.json(
      {
        code: "forbidden",
        message: "Your role is not allowed to submit expense claims.",
      },
      { status: 403 },
    );
  }

  const parsedBody = await parseJsonBodySafe<ExpenseBody>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  const result = submitTravelExpense({
    requestId,
    actorRole,
    actorName: guard.user.name,
    category: body.category ?? "other",
    amount: body.amount ?? Number.NaN,
    currency: body.currency ?? "",
    expenseDate: body.expenseDate ?? "",
    merchant: body.merchant ?? "",
    description: body.description ?? "",
    receiptFileName: body.receiptFileName ?? "",
    receiptMimeType: body.receiptMimeType ?? "",
    receiptSizeInBytes: body.receiptSizeInBytes ?? Number.NaN,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.error.code, number> = {
      request_not_found: 404,
      role_not_allowed: 403,
      invalid_state: 409,
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

  return NextResponse.json(result.result, { status: 201 });
}
