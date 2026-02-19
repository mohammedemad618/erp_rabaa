import type { SalesTransitionId } from "@/modules/sales/workflow/sales-state-machine";
import type { Transaction } from "../types";

interface ApplyWorkflowTransitionInput {
  transitionId: SalesTransitionId;
  toStatus: Transaction["status"];
  at: string;
}
const SYSTEM_ACTOR = "System User";

const transitionNote: Record<SalesTransitionId, string> = {
  review_ocr: "OCR review completed",
  request_approval: "Approval requested",
  approve_sale: "Sale approved",
  queue_payment: "Queued for payment",
  capture_payment: "Payment captured",
  issue_receipt: "Receipt issued",
  refund_sale: "Refund approved",
  void_sale: "Transaction voided",
};

function nextApprovalState(
  current: Transaction["approvalState"],
  nextStatus: Transaction["status"],
): Transaction["approvalState"] {
  if (nextStatus === "pending_approval") {
    return "pending";
  }
  if (nextStatus === "approved") {
    return "approved";
  }
  if (nextStatus === "voided") {
    return "rejected";
  }
  if (nextStatus === "draft" || nextStatus === "ocr_reviewed") {
    return "not_required";
  }
  return current;
}

export function applyTransactionWorkflowTransition(
  transaction: Transaction,
  input: ApplyWorkflowTransitionInput,
): Transaction {
  const approvalState = nextApprovalState(transaction.approvalState, input.toStatus);
  const actor = SYSTEM_ACTOR;
  const nextVersion = transaction.auditMetadata.version + 1;

  return {
    ...transaction,
    status: input.toStatus,
    approvalState,
    issuedAt: input.toStatus === "receipt_issued" ? input.at : transaction.issuedAt,
    approvalTimeline: [
      ...transaction.approvalTimeline,
      {
        id: `wf-${nextVersion}`,
        actor,
        status: "approved",
        at: input.at,
        note: transitionNote[input.transitionId],
      },
    ],
    auditMetadata: {
      ...transaction.auditMetadata,
      updatedBy: actor,
      updatedAt: input.at,
      version: nextVersion,
    },
  };
}
