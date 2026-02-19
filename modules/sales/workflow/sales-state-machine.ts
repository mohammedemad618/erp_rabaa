import type { TransactionStatus } from "@/modules/transactions/types";

export type ApprovalState = "not_required" | "pending" | "approved" | "rejected";

export type SalesTransitionId =
  | "review_ocr"
  | "request_approval"
  | "approve_sale"
  | "queue_payment"
  | "capture_payment"
  | "issue_receipt"
  | "refund_sale"
  | "void_sale";

export type SalesTransitionRisk = "normal" | "high";

export type SalesTransitionBlockReason =
  | "approval_required"
  | "state_not_allowed";

export interface SalesTransitionRule {
  id: SalesTransitionId;
  from: TransactionStatus[];
  to: TransactionStatus;
  risk: SalesTransitionRisk;
  requiresApprovedState?: boolean;
}

export interface SalesTransitionInput {
  state: TransactionStatus;
  approvalState: ApprovalState;
}

export interface SalesTransitionOption {
  id: SalesTransitionId;
  to: TransactionStatus;
  risk: SalesTransitionRisk;
  requiresPin: boolean;
  allowed: boolean;
  blockedReason?: SalesTransitionBlockReason;
}

export interface SalesSlaStatus {
  targetHours: number;
  elapsedHours: number;
  level: "ok" | "warning" | "critical";
}

const SALES_TRANSITIONS: SalesTransitionRule[] = [
  {
    id: "review_ocr",
    from: ["draft"],
    to: "ocr_reviewed",
    risk: "normal",
  },
  {
    id: "request_approval",
    from: ["ocr_reviewed"],
    to: "pending_approval",
    risk: "normal",
  },
  {
    id: "approve_sale",
    from: ["pending_approval"],
    to: "approved",
    risk: "normal",
  },
  {
    id: "queue_payment",
    from: ["approved"],
    to: "pending_payment",
    risk: "normal",
    requiresApprovedState: true,
  },
  {
    id: "capture_payment",
    from: ["pending_payment"],
    to: "paid",
    risk: "normal",
    requiresApprovedState: true,
  },
  {
    id: "issue_receipt",
    from: ["paid"],
    to: "receipt_issued",
    risk: "normal",
    requiresApprovedState: true,
  },
  {
    id: "refund_sale",
    from: ["paid", "receipt_issued"],
    to: "refunded",
    risk: "high",
    requiresApprovedState: true,
  },
  {
    id: "void_sale",
    from: ["approved", "pending_payment"],
    to: "voided",
    risk: "high",
    requiresApprovedState: true,
  },
];

const SALES_SLA_HOURS: Record<TransactionStatus, number> = {
  draft: 2,
  ocr_reviewed: 1,
  pending_approval: 4,
  approved: 2,
  pending_payment: 12,
  paid: 1,
  receipt_issued: 24,
  refunded: 24,
  voided: 24,
};

function evaluateTransitionRule(
  rule: SalesTransitionRule,
  input: SalesTransitionInput,
): SalesTransitionOption {
  if (rule.requiresApprovedState && input.approvalState !== "approved") {
    return {
      id: rule.id,
      to: rule.to,
      risk: rule.risk,
      requiresPin: rule.risk === "high",
      allowed: false,
      blockedReason: "approval_required",
    };
  }

  return {
    id: rule.id,
    to: rule.to,
    risk: rule.risk,
    requiresPin: rule.risk === "high",
    allowed: true,
  };
}

export function getSalesTransitionRules(): SalesTransitionRule[] {
  return SALES_TRANSITIONS;
}

export function getSalesTransitionOptions(
  input: SalesTransitionInput,
): SalesTransitionOption[] {
  const candidateRules = SALES_TRANSITIONS.filter((rule) =>
    rule.from.includes(input.state),
  );

  return candidateRules.map((rule) => evaluateTransitionRule(rule, input));
}

export function getSalesTransitionOption(
  transitionId: SalesTransitionId,
  input: SalesTransitionInput,
): SalesTransitionOption {
  const rule = SALES_TRANSITIONS.find((item) => item.id === transitionId);
  if (!rule || !rule.from.includes(input.state)) {
    return {
      id: transitionId,
      to: input.state,
      risk: "normal",
      requiresPin: false,
      allowed: false,
      blockedReason: "state_not_allowed",
    };
  }

  return evaluateTransitionRule(rule, input);
}

export function getSlaTargetHours(state: TransactionStatus): number {
  return SALES_SLA_HOURS[state];
}

export function evaluateSalesSla(
  state: TransactionStatus,
  createdAt: string,
  now: Date = new Date(),
): SalesSlaStatus {
  const targetHours = getSlaTargetHours(state);
  const elapsedMs = Math.max(0, now.getTime() - new Date(createdAt).getTime());
  const elapsedHours = Math.round((elapsedMs / (1000 * 60 * 60)) * 10) / 10;
  const ratio = targetHours > 0 ? elapsedHours / targetHours : 0;

  const level = ratio >= 1
    ? state === "pending_approval" || state === "pending_payment"
      ? "critical"
      : "warning"
    : "ok";

  return { targetHours, elapsedHours, level };
}
