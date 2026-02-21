import type {
  TravelActorRole,
  TravelApprovalStep,
  TravelRequest,
  TravelRequestStatus,
} from "@/modules/travel/types";

export type TravelTransitionId =
  | "submit_request"
  | "approve_manager"
  | "reject_manager"
  | "start_travel_review"
  | "approve_finance"
  | "reject_finance"
  | "confirm_booking"
  | "close_trip"
  | "cancel_request";

export type TravelTransitionBlockReason =
  | "role_not_allowed"
  | "state_not_allowed"
  | "policy_blocked"
  | "trip_not_completed"
  | "booking_not_recorded"
  | "expenses_pending"
  | "finance_sync_incomplete";

interface TravelTransitionRule {
  id: TravelTransitionId;
  from: TravelRequestStatus[];
  to: TravelRequestStatus;
  allowedRoles: TravelActorRole[];
  requiresNote: boolean;
}

export interface TravelTransitionOption {
  id: TravelTransitionId;
  to: TravelRequestStatus;
  allowed: boolean;
  requiresNote: boolean;
  blockedReason?: TravelTransitionBlockReason;
}

export interface TravelTransitionInput {
  request: TravelRequest;
  actorRole: TravelActorRole;
}

const APPROVAL_ROUTE_TEMPLATE: Array<{ id: string; role: TravelActorRole }> = [
  { id: "manager_approval", role: "manager" },
  { id: "travel_desk_review", role: "travel_desk" },
  { id: "finance_approval", role: "finance" },
  { id: "booking_confirmation", role: "travel_desk" },
  { id: "settlement_closure", role: "finance" },
];

const TRAVEL_TRANSITIONS: TravelTransitionRule[] = [
  {
    id: "submit_request",
    from: ["draft"],
    to: "submitted",
    allowedRoles: ["employee", "admin"],
    requiresNote: false,
  },
  {
    id: "approve_manager",
    from: ["submitted"],
    to: "manager_approved",
    allowedRoles: ["manager", "admin"],
    requiresNote: false,
  },
  {
    id: "reject_manager",
    from: ["submitted"],
    to: "rejected",
    allowedRoles: ["manager", "admin"],
    requiresNote: true,
  },
  {
    id: "start_travel_review",
    from: ["manager_approved"],
    to: "travel_review",
    allowedRoles: ["travel_desk", "admin"],
    requiresNote: false,
  },
  {
    id: "approve_finance",
    from: ["travel_review"],
    to: "finance_approved",
    allowedRoles: ["finance", "admin"],
    requiresNote: false,
  },
  {
    id: "reject_finance",
    from: ["travel_review"],
    to: "rejected",
    allowedRoles: ["finance", "admin"],
    requiresNote: true,
  },
  {
    id: "confirm_booking",
    from: ["finance_approved"],
    to: "booked",
    allowedRoles: ["travel_desk", "admin"],
    requiresNote: false,
  },
  {
    id: "close_trip",
    from: ["booked"],
    to: "closed",
    allowedRoles: ["finance", "admin"],
    requiresNote: false,
  },
  {
    id: "cancel_request",
    from: ["submitted", "manager_approved", "travel_review", "finance_approved"],
    to: "cancelled",
    allowedRoles: ["employee", "manager", "travel_desk", "finance", "admin"],
    requiresNote: true,
  },
];

function evaluateTransitionRule(
  rule: TravelTransitionRule,
  input: TravelTransitionInput,
): TravelTransitionOption {
  if (!rule.from.includes(input.request.status)) {
    return {
      id: rule.id,
      to: rule.to,
      allowed: false,
      requiresNote: rule.requiresNote,
      blockedReason: "state_not_allowed",
    };
  }

  if (!rule.allowedRoles.includes(input.actorRole)) {
    return {
      id: rule.id,
      to: rule.to,
      allowed: false,
      requiresNote: rule.requiresNote,
      blockedReason: "role_not_allowed",
    };
  }

  if (rule.id === "submit_request" && input.request.policyEvaluation.level === "blocked") {
    return {
      id: rule.id,
      to: rule.to,
      allowed: false,
      requiresNote: rule.requiresNote,
      blockedReason: "policy_blocked",
    };
  }

  if (rule.id === "close_trip") {
    const returnAt = new Date(input.request.returnDate).getTime();
    if (!Number.isFinite(returnAt) || returnAt > Date.now()) {
      return {
        id: rule.id,
        to: rule.to,
        allowed: false,
        requiresNote: rule.requiresNote,
        blockedReason: "trip_not_completed",
      };
    }

    if (!input.request.booking) {
      return {
        id: rule.id,
        to: rule.to,
        allowed: false,
        requiresNote: rule.requiresNote,
        blockedReason: "booking_not_recorded",
      };
    }

    const hasPendingExpenses = input.request.expenses.some(
      (expense) => expense.status === "submitted",
    );
    if (hasPendingExpenses) {
      return {
        id: rule.id,
        to: rule.to,
        allowed: false,
        requiresNote: rule.requiresNote,
        blockedReason: "expenses_pending",
      };
    }

    const hasUnsyncedApprovedExpenses = input.request.expenses.some(
      (expense) => expense.status === "approved" && !expense.syncedAt,
    );
    if (
      hasUnsyncedApprovedExpenses ||
      input.request.financeSync.status === "failed" ||
      input.request.financeSync.status === "pending"
    ) {
      return {
        id: rule.id,
        to: rule.to,
        allowed: false,
        requiresNote: rule.requiresNote,
        blockedReason: "finance_sync_incomplete",
      };
    }
  }

  return {
    id: rule.id,
    to: rule.to,
    allowed: true,
    requiresNote: rule.requiresNote,
  };
}

function markStep(
  steps: TravelApprovalStep[],
  stepId: string,
  next: Partial<TravelApprovalStep>,
): TravelApprovalStep[] {
  return steps.map((step) => (step.id === stepId ? { ...step, ...next } : step));
}

function skipOpenSteps(steps: TravelApprovalStep[], note: string): TravelApprovalStep[] {
  return steps.map((step) => {
    if (step.status === "approved" || step.status === "rejected") {
      return step;
    }
    return {
      ...step,
      status: "skipped",
      note,
    };
  });
}

export function getTravelTransitionRules(): TravelTransitionRule[] {
  return TRAVEL_TRANSITIONS;
}

export function getTravelTransitionOption(
  transitionId: TravelTransitionId,
  input: TravelTransitionInput,
): TravelTransitionOption {
  const rule = TRAVEL_TRANSITIONS.find((item) => item.id === transitionId);
  if (!rule) {
    return {
      id: transitionId,
      to: input.request.status,
      allowed: false,
      requiresNote: false,
      blockedReason: "state_not_allowed",
    };
  }
  return evaluateTransitionRule(rule, input);
}

export function getTravelTransitionOptions(
  input: TravelTransitionInput,
): TravelTransitionOption[] {
  const candidateRules = TRAVEL_TRANSITIONS.filter((rule) =>
    rule.from.includes(input.request.status),
  );
  return candidateRules.map((rule) => evaluateTransitionRule(rule, input));
}

export function buildInitialApprovalRoute(): TravelApprovalStep[] {
  return APPROVAL_ROUTE_TEMPLATE.map((step) => ({
    id: step.id,
    role: step.role,
    status: "waiting",
  }));
}

interface ApplyRouteTransitionInput {
  route: TravelApprovalStep[];
  transitionId: TravelTransitionId;
  actorName: string;
  at: string;
  note?: string;
}

export function applyTransitionToApprovalRoute(
  input: ApplyRouteTransitionInput,
): TravelApprovalStep[] {
  let nextRoute = input.route.map((step) => ({ ...step }));

  switch (input.transitionId) {
    case "submit_request":
      nextRoute = markStep(nextRoute, "manager_approval", { status: "pending" });
      break;
    case "approve_manager":
      nextRoute = markStep(nextRoute, "manager_approval", {
        status: "approved",
        actorName: input.actorName,
        actedAt: input.at,
        note: input.note,
      });
      nextRoute = markStep(nextRoute, "travel_desk_review", { status: "pending" });
      break;
    case "reject_manager":
      nextRoute = markStep(nextRoute, "manager_approval", {
        status: "rejected",
        actorName: input.actorName,
        actedAt: input.at,
        note: input.note,
      });
      nextRoute = skipOpenSteps(nextRoute, "Route closed after manager rejection.");
      break;
    case "start_travel_review":
      nextRoute = markStep(nextRoute, "travel_desk_review", {
        status: "approved",
        actorName: input.actorName,
        actedAt: input.at,
        note: input.note,
      });
      nextRoute = markStep(nextRoute, "finance_approval", { status: "pending" });
      break;
    case "approve_finance":
      nextRoute = markStep(nextRoute, "finance_approval", {
        status: "approved",
        actorName: input.actorName,
        actedAt: input.at,
        note: input.note,
      });
      nextRoute = markStep(nextRoute, "booking_confirmation", { status: "pending" });
      break;
    case "reject_finance":
      nextRoute = markStep(nextRoute, "finance_approval", {
        status: "rejected",
        actorName: input.actorName,
        actedAt: input.at,
        note: input.note,
      });
      nextRoute = markStep(nextRoute, "booking_confirmation", {
        status: "skipped",
        note: "Booking cancelled after finance rejection.",
      });
      break;
    case "confirm_booking":
      nextRoute = markStep(nextRoute, "booking_confirmation", {
        status: "approved",
        actorName: input.actorName,
        actedAt: input.at,
        note: input.note,
      });
      nextRoute = markStep(nextRoute, "settlement_closure", { status: "pending" });
      break;
    case "close_trip":
      nextRoute = markStep(nextRoute, "settlement_closure", {
        status: "approved",
        actorName: input.actorName,
        actedAt: input.at,
        note: input.note,
      });
      break;
    case "cancel_request":
      nextRoute = skipOpenSteps(
        nextRoute,
        input.note || "Request cancelled before workflow completion.",
      );
      break;
    default:
      return nextRoute;
  }

  return nextRoute;
}
