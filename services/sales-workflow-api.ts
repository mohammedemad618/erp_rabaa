import type { SalesTransitionId } from "@/modules/sales/workflow/sales-state-machine";
import type { Transaction } from "@/modules/transactions/types";

interface TransitionSalesOrderInput {
  orderId: string;
  transitionId: SalesTransitionId;
  pinToken?: string;
}

interface TransitionSalesOrderResponse {
  orderId: string;
  fromState: Transaction["status"];
  toState: Transaction["status"];
  approvalState: Transaction["approvalState"];
  requiresPin: boolean;
  at: string;
  transaction: Transaction;
}

interface ApiErrorPayload {
  code?: string;
  message?: string;
}

export async function transitionSalesOrder(
  input: TransitionSalesOrderInput,
): Promise<TransitionSalesOrderResponse> {
  const response = await fetch(`/api/sales/orders/${input.orderId}/transition`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transitionId: input.transitionId,
      pinToken: input.pinToken,
    }),
  });

  const payload = (await response.json()) as
    | TransitionSalesOrderResponse
    | ApiErrorPayload;

  if (!response.ok) {
    const message =
      (payload as ApiErrorPayload).message ??
      "Unable to execute workflow transition.";
    throw new Error(message);
  }

  return payload as TransitionSalesOrderResponse;
}
