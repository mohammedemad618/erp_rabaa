import { generateMockTransactions } from "@/modules/transactions/data/mock-transactions";
import { getServiceTransactions } from "@/modules/services/services-transaction-bridge";
import type { Transaction } from "@/modules/transactions/types";
import {
  getSalesTransitionOption,
  type SalesTransitionId,
} from "@/modules/sales/workflow/sales-state-machine";
import { applyTransactionWorkflowTransition } from "@/modules/transactions/utils/workflow-transition";

interface ApplySalesTransitionInput {
  orderId: string;
  transitionId: SalesTransitionId;
  pinToken?: string;
}

interface ApplySalesTransitionSuccess {
  ok: true;
  result: {
    orderId: string;
    fromState: Transaction["status"];
    toState: Transaction["status"];
    approvalState: Transaction["approvalState"];
    requiresPin: boolean;
    at: string;
    transaction: Transaction;
  };
}

interface ApplySalesTransitionFailure {
  ok: false;
  error: {
    code:
      | "order_not_found"
      | "transition_not_allowed"
      | "pin_required"
      | "invalid_pin";
    message: string;
  };
}

export type ApplySalesTransitionResult =
  | ApplySalesTransitionSuccess
  | ApplySalesTransitionFailure;

let transactionState: Transaction[] | null = null;

function ensureTransactionState(): Transaction[] {
  if (!transactionState) {
    const flightTransactions = generateMockTransactions(2500);
    const serviceTransactions = getServiceTransactions();
    transactionState = [...flightTransactions, ...serviceTransactions];
  }
  return transactionState;
}

function cloneTransactions(rows: Transaction[]): Transaction[] {
  return rows.map((row) => ({
    ...row,
    accountingPreview: row.accountingPreview.map((line) => ({ ...line })),
    approvalTimeline: row.approvalTimeline.map((step) => ({ ...step })),
    auditMetadata: { ...row.auditMetadata },
  }));
}

export function listTransactions(): Transaction[] {
  return cloneTransactions(ensureTransactionState());
}

export function applySalesTransition(
  input: ApplySalesTransitionInput,
): ApplySalesTransitionResult {
  const rows = ensureTransactionState();
  const index = rows.findIndex((row) => row.id === input.orderId);
  if (index < 0) {
    return {
      ok: false,
      error: {
        code: "order_not_found",
        message: "Sales order not found.",
      },
    };
  }

  const current = rows[index];
  if (!current) {
    return {
      ok: false,
      error: {
        code: "order_not_found",
        message: "Sales order not found.",
      },
    };
  }

  const transition = getSalesTransitionOption(input.transitionId, {
    state: current.status,
    approvalState: current.approvalState,
  });

  if (!transition.allowed) {
    return {
      ok: false,
      error: {
        code: "transition_not_allowed",
        message: "Transition is not allowed for the current state.",
      },
    };
  }

  if (transition.requiresPin && !input.pinToken) {
    return {
      ok: false,
      error: {
        code: "pin_required",
        message: "PIN token is required for this high-risk transition.",
      },
    };
  }

  if (transition.requiresPin && input.pinToken !== "1234") {
    return {
      ok: false,
      error: {
        code: "invalid_pin",
        message: "Invalid PIN token.",
      },
    };
  }

  const at = new Date().toISOString();
  const updated = applyTransactionWorkflowTransition(current, {
    transitionId: input.transitionId,
    toStatus: transition.to,
    at,
  });
  rows[index] = updated;

  return {
    ok: true,
    result: {
      orderId: updated.id,
      fromState: current.status,
      toState: updated.status,
      approvalState: updated.approvalState,
      requiresPin: transition.requiresPin,
      at,
      transaction: {
        ...updated,
        accountingPreview: updated.accountingPreview.map((line) => ({ ...line })),
        approvalTimeline: updated.approvalTimeline.map((step) => ({ ...step })),
        auditMetadata: { ...updated.auditMetadata },
      },
    },
  };
}
