import type { TransactionStatus } from "@/modules/transactions/types";
import {
  getSalesTransitionOption,
  type SalesTransitionBlockReason,
  type SalesTransitionId,
} from "@/modules/sales/workflow/sales-state-machine";
import type { PermissionResult, ProtectedAction } from "@/types/permissions";

interface PermissionInput {
  status: TransactionStatus;
  approvalState: "not_required" | "pending" | "approved" | "rejected";
}

const highRiskActions: ProtectedAction[] = [
  "refund",
  "void",
  "delete",
  "financial_override",
];

const actionToSalesTransition: Partial<Record<ProtectedAction, SalesTransitionId>> = {
  approve: "approve_sale",
  refund: "refund_sale",
  void: "void_sale",
};

function messageForSalesBlockReason(reason: SalesTransitionBlockReason): string {
  if (reason === "approval_required") {
    return "Transaction must be approved first.";
  }
  return "Action is not valid for the current workflow state.";
}

export function evaluatePermission(
  action: ProtectedAction,
  input: PermissionInput,
): PermissionResult {
  const transitionId = actionToSalesTransition[action];

  if (transitionId) {
    const workflowResult = getSalesTransitionOption(transitionId, {
      state: input.status,
      approvalState: input.approvalState,
    });

    if (!workflowResult.allowed) {
      return {
        allowed: false,
        reason: workflowResult.blockedReason
          ? messageForSalesBlockReason(workflowResult.blockedReason)
          : "Action is not valid for the current workflow state.",
      };
    }

    return {
      allowed: true,
      requiresPin: workflowResult.requiresPin,
    };
  }

  return {
    allowed: true,
    requiresPin: highRiskActions.includes(action),
  };
}
