import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { applySalesTransition } from "@/services/transaction-store";
import type { SalesTransitionId } from "@/modules/sales/workflow/sales-state-machine";

interface TransitionRequestBody {
  transitionId?: SalesTransitionId;
  pinToken?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await context.params;
  if (!orderId) {
    return NextResponse.json(
      {
        code: "invalid_order_id",
        message: "Order id is required.",
      },
      { status: 400 },
    );
  }

  const body = (await request.json()) as TransitionRequestBody;
  if (!body.transitionId) {
    return NextResponse.json(
      {
        code: "invalid_transition",
        message: "transitionId is required.",
      },
      { status: 400 },
    );
  }

  const result = applySalesTransition({
    orderId,
    transitionId: body.transitionId,
    pinToken: body.pinToken,
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.error.code, number> = {
      order_not_found: 404,
      transition_not_allowed: 409,
      pin_required: 428,
      invalid_pin: 401,
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
