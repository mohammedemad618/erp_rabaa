import { generateMockTravelRequests } from "@/modules/travel/data/mock-travel-requests";
import { evaluateTravelPolicy } from "@/modules/travel/policy/travel-policy-engine";
import { buildTravelInsights, type TravelInsights } from "@/modules/travel/services/travel-insights";
import { getActiveTravelPolicy } from "@/services/travel-policy-store";
import type {
  CreateTravelRequestInput,
  TravelClosureReadiness,
  TravelClosureReadinessCheck,
  EmployeeGrade,
  TravelActorRole,
  TravelAuditEvent,
  TravelExpenseCategory,
  TravelExpenseClaim,
  TravelExpenseStatus,
  TravelClass,
  TravelFinanceSyncState,
  TravelLedgerLine,
  TravelRequest,
  TravelRequestStatus,
  TravelTripClosureRecord,
  TripType,
} from "@/modules/travel/types";
import {
  applyTransitionToApprovalRoute,
  buildInitialApprovalRoute,
  getTravelTransitionOption,
  type TravelTransitionId,
} from "@/modules/travel/workflow/travel-approval-engine";

const VALID_GRADES = new Set<EmployeeGrade>(["staff", "manager", "director", "executive"]);
const VALID_TRIP_TYPES = new Set<TripType>(["domestic", "international"]);
const VALID_CLASSES = new Set<TravelClass>([
  "economy",
  "premium_economy",
  "business",
  "first",
]);
const VALID_EXPENSE_CATEGORIES = new Set<TravelExpenseCategory>([
  "flight",
  "hotel",
  "ground_transport",
  "meals",
  "visa",
  "other",
]);

const GL_ACCOUNT_BY_EXPENSE_CATEGORY: Record<TravelExpenseCategory, string> = {
  flight: "610100",
  hotel: "610200",
  ground_transport: "610300",
  meals: "610400",
  visa: "610500",
  other: "610900",
};

interface CreateTravelRequestPayload extends CreateTravelRequestInput {
  actorRole: TravelActorRole;
  actorName: string;
}

interface ApplyTravelTransitionInput {
  requestId: string;
  transitionId: TravelTransitionId;
  actorRole: TravelActorRole;
  actorName: string;
  note?: string;
}

interface CreateTravelRequestSuccess {
  ok: true;
  result: TravelRequest;
}

interface CreateTravelRequestFailure {
  ok: false;
  error: {
    code: "validation_failed";
    message: string;
  };
}

interface ApplyTravelTransitionSuccess {
  ok: true;
  result: {
    request: TravelRequest;
    fromStatus: TravelRequestStatus;
    toStatus: TravelRequestStatus;
    transitionId: TravelTransitionId;
    at: string;
  };
}

interface ApplyTravelTransitionFailure {
  ok: false;
  error: {
    code:
      | "request_not_found"
      | "transition_not_allowed"
      | "validation_failed"
      | "note_required";
    message: string;
  };
}

export type CreateTravelRequestResult = CreateTravelRequestSuccess | CreateTravelRequestFailure;

export type ApplyTravelTransitionResult =
  | ApplyTravelTransitionSuccess
  | ApplyTravelTransitionFailure;

interface AutoApproveTravelRequestsInput {
  actorRole: TravelActorRole;
  actorName: string;
  maxEstimatedCost?: number;
}

interface AutoApproveTravelRequestsSuccess {
  ok: true;
  result: {
    scanned: number;
    updated: number;
    skipped: number;
    touchedRequestIds: string[];
  };
}

interface AutoApproveTravelRequestsFailure {
  ok: false;
  error: {
    code: "role_not_allowed" | "validation_failed";
    message: string;
  };
}

export type AutoApproveTravelRequestsResult =
  | AutoApproveTravelRequestsSuccess
  | AutoApproveTravelRequestsFailure;

interface UpsertTravelBookingInput {
  requestId: string;
  actorRole: TravelActorRole;
  actorName: string;
  vendor: string;
  bookingReference: string;
  ticketNumber?: string;
  bookedAt?: string;
  totalBookedCost: number;
  currency: string;
}

interface UpsertTravelBookingSuccess {
  ok: true;
  result: {
    request: TravelRequest;
    at: string;
  };
}

interface UpsertTravelBookingFailure {
  ok: false;
  error: {
    code: "request_not_found" | "role_not_allowed" | "invalid_state" | "validation_failed";
    message: string;
  };
}

export type UpsertTravelBookingResult = UpsertTravelBookingSuccess | UpsertTravelBookingFailure;

interface SubmitTravelExpenseInput {
  requestId: string;
  actorRole: TravelActorRole;
  actorName: string;
  category: TravelExpenseCategory;
  amount: number;
  currency: string;
  expenseDate: string;
  merchant: string;
  description: string;
  receiptFileName: string;
  receiptMimeType: string;
  receiptSizeInBytes: number;
}

interface SubmitTravelExpenseSuccess {
  ok: true;
  result: {
    request: TravelRequest;
    expense: TravelExpenseClaim;
    at: string;
  };
}

interface SubmitTravelExpenseFailure {
  ok: false;
  error: {
    code: "request_not_found" | "role_not_allowed" | "invalid_state" | "validation_failed";
    message: string;
  };
}

export type SubmitTravelExpenseResult = SubmitTravelExpenseSuccess | SubmitTravelExpenseFailure;

interface ReviewTravelExpenseInput {
  requestId: string;
  expenseId: string;
  actorRole: TravelActorRole;
  actorName: string;
  decision: "approve" | "reject";
  note?: string;
}

interface ReviewTravelExpenseSuccess {
  ok: true;
  result: {
    request: TravelRequest;
    expense: TravelExpenseClaim;
    at: string;
  };
}

interface ReviewTravelExpenseFailure {
  ok: false;
  error: {
    code:
      | "request_not_found"
      | "expense_not_found"
      | "expense_not_pending"
      | "role_not_allowed"
      | "validation_failed"
      | "note_required";
    message: string;
  };
}

export type ReviewTravelExpenseResult = ReviewTravelExpenseSuccess | ReviewTravelExpenseFailure;

interface SyncTravelFinanceInput {
  requestId: string;
  actorRole: TravelActorRole;
  actorName: string;
}

interface SyncTravelFinanceSuccess {
  ok: true;
  result: {
    request: TravelRequest;
    batchId: string;
    syncedExpenses: number;
    ledgerLines: TravelLedgerLine[];
    at: string;
  };
}

interface SyncTravelFinanceFailure {
  ok: false;
  error: {
    code:
      | "request_not_found"
      | "role_not_allowed"
      | "validation_failed"
      | "no_expenses_to_sync"
      | "already_synced"
      | "sync_failed";
    message: string;
  };
}

export type SyncTravelFinanceResult = SyncTravelFinanceSuccess | SyncTravelFinanceFailure;

interface GetTravelTripClosureReadinessSuccess {
  ok: true;
  result: {
    requestId: string;
    readiness: TravelClosureReadiness;
  };
}

interface GetTravelTripClosureReadinessFailure {
  ok: false;
  error: {
    code: "request_not_found" | "validation_failed";
    message: string;
  };
}

export type GetTravelTripClosureReadinessResult =
  | GetTravelTripClosureReadinessSuccess
  | GetTravelTripClosureReadinessFailure;

let travelRequestState: TravelRequest[] | null = null;

function cloneAuditEvent(event: TravelAuditEvent): TravelAuditEvent {
  return { ...event };
}

function cloneTravelRequest(request: TravelRequest): TravelRequest {
  return {
    ...request,
    approvalRoute: request.approvalRoute.map((step) => ({ ...step })),
    policyEvaluation: {
      ...request.policyEvaluation,
      findings: request.policyEvaluation.findings.map((finding) => ({ ...finding })),
    },
    booking: request.booking ? { ...request.booking } : null,
    expenses: request.expenses.map((expense) => ({
      ...expense,
      receipt: { ...expense.receipt },
    })),
    financeSync: {
      ...request.financeSync,
      ledgerLines: request.financeSync.ledgerLines.map((line) => ({ ...line })),
    },
    closure: request.closure ? { ...request.closure } : null,
    auditTrail: request.auditTrail.map((event) => cloneAuditEvent(event)),
  };
}

function ensureState(): TravelRequest[] {
  if (!travelRequestState) {
    travelRequestState = generateMockTravelRequests();
  }
  return travelRequestState;
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nextRequestId(rows: TravelRequest[]): string {
  const max = rows.reduce((highest, row) => {
    const match = /^TRV-(\d+)$/i.exec(row.id);
    if (!match) {
      return highest;
    }
    const numeric = Number(match[1]);
    return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest;
  }, 1000);
  return `TRV-${String(max + 1).padStart(4, "0")}`;
}

function nextExpenseId(request: TravelRequest): string {
  const max = request.expenses.reduce((highest, expense) => {
    const match = new RegExp(`^${request.id}-EXP-(\\d+)$`, "i").exec(expense.id);
    if (!match) {
      return highest;
    }
    const numeric = Number(match[1]);
    return Number.isFinite(numeric) ? Math.max(highest, numeric) : highest;
  }, 0);
  return `${request.id}-EXP-${String(max + 1).padStart(3, "0")}`;
}

function nextBatchId(request: TravelRequest): string {
  const numeric = request.financeSync.attemptCount + 1;
  return `TRV-BATCH-${request.id.replace("TRV-", "")}-${String(numeric).padStart(3, "0")}`;
}

function createInitialFinanceSyncState(): TravelFinanceSyncState {
  return {
    status: "not_synced",
    attemptCount: 0,
    ledgerLines: [],
  };
}

function createAuditEvent(
  request: TravelRequest,
  action: string,
  at: string,
  actorRole: TravelActorRole,
  actorName: string,
  toStatus: TravelRequestStatus,
  fromStatus: TravelRequestStatus | null,
  note?: string,
): TravelAuditEvent {
  return {
    id: `${request.id}-AUD-${String(request.auditTrail.length + 1).padStart(3, "0")}`,
    at,
    actorRole,
    actorName,
    action,
    fromStatus,
    toStatus,
    note,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildTripClosureReadiness(
  request: TravelRequest,
  now: Date = new Date(),
): TravelClosureReadiness {
  const checkedAt = now.toISOString();
  const pendingExpenses = request.expenses.filter((expense) => expense.status === "submitted");
  const approvedExpenses = request.expenses.filter((expense) => expense.status === "approved");
  const approvedUnsyncedExpenses = approvedExpenses.filter((expense) => !expense.syncedAt);
  const rejectedExpenses = request.expenses.filter((expense) => expense.status === "rejected");

  const totalApprovedAmount = roundMoney(
    approvedExpenses.reduce((sum, expense) => sum + expense.amount, 0),
  );
  const totalApprovedSyncedAmount = roundMoney(
    approvedExpenses
      .filter((expense) => expense.syncedAt)
      .reduce((sum, expense) => sum + expense.amount, 0),
  );

  const returnDateMs = new Date(request.returnDate).getTime();
  const checks: TravelClosureReadinessCheck[] = [
    {
      code: "trip_completed",
      passed: Number.isFinite(returnDateMs) && returnDateMs <= now.getTime(),
      message: "Trip cannot be closed before the return date.",
    },
    {
      code: "booking_recorded",
      passed: !!request.booking,
      message: "Booking details must be recorded before closing.",
    },
    {
      code: "expenses_reviewed",
      passed: pendingExpenses.length === 0,
      message: "All pending expense claims must be reviewed before closing.",
    },
    {
      code: "approved_expenses_synced",
      passed: approvedUnsyncedExpenses.length === 0,
      message: "Approved expenses must be synchronized before closing.",
    },
    {
      code: "finance_sync_not_failed",
      passed: request.financeSync.status !== "failed" && request.financeSync.status !== "pending",
      message: "Finance synchronization has not completed successfully.",
    },
  ];

  return {
    checkedAt,
    ready: checks.every((check) => check.passed),
    requiresFinanceSync: approvedExpenses.length > 0,
    pendingExpenses: pendingExpenses.length,
    approvedExpenses: approvedExpenses.length,
    approvedUnsyncedExpenses: approvedUnsyncedExpenses.length,
    rejectedExpenses: rejectedExpenses.length,
    totalExpenses: request.expenses.length,
    totalApprovedAmount,
    totalApprovedSyncedAmount,
    financeSyncStatus: request.financeSync.status,
    checks,
  };
}

function buildTripClosureRecord(
  request: TravelRequest,
  at: string,
  actorName: string,
  note?: string,
): TravelTripClosureRecord {
  const readiness = buildTripClosureReadiness(request, new Date(at));
  const totalSettledAmount = readiness.totalApprovedSyncedAmount;
  const bookedCost = request.booking?.totalBookedCost ?? 0;

  return {
    closedAt: at,
    closedBy: actorName.trim(),
    closureNote: note?.trim() || undefined,
    totalExpenses: readiness.totalExpenses,
    totalApprovedAmount: readiness.totalApprovedAmount,
    totalSettledAmount,
    varianceFromBookedCost: roundMoney(totalSettledAmount - bookedCost),
    varianceFromEstimatedCost: roundMoney(totalSettledAmount - request.estimatedCost),
    financeBatchId: request.financeSync.lastBatchId,
    financeAttemptCount: request.financeSync.attemptCount,
  };
}

function validateCreatePayload(input: CreateTravelRequestPayload): string | null {
  if (!isNonEmptyText(input.actorName)) {
    return "Actor name is required.";
  }

  const textFields: Array<[string, unknown]> = [
    ["employeeName", input.employeeName],
    ["employeeEmail", input.employeeEmail],
    ["department", input.department],
    ["costCenter", input.costCenter],
    ["origin", input.origin],
    ["destination", input.destination],
    ["departureDate", input.departureDate],
    ["returnDate", input.returnDate],
    ["purpose", input.purpose],
    ["currency", input.currency],
  ];

  for (const [field, value] of textFields) {
    if (!isNonEmptyText(value)) {
      return `${field} is required.`;
    }
  }

  if (!VALID_GRADES.has(input.employeeGrade)) {
    return "employeeGrade is invalid.";
  }
  if (!VALID_TRIP_TYPES.has(input.tripType)) {
    return "tripType is invalid.";
  }
  if (!VALID_CLASSES.has(input.travelClass)) {
    return "travelClass is invalid.";
  }
  if (!Number.isFinite(input.estimatedCost) || input.estimatedCost <= 0) {
    return "estimatedCost must be greater than zero.";
  }

  return null;
}

function isValidDateInput(value: string): boolean {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp);
}

function isRoleAllowedForBooking(role: TravelActorRole): boolean {
  return role === "travel_desk" || role === "admin";
}

function isRoleAllowedForExpenseSubmission(role: TravelActorRole): boolean {
  return role === "employee" || role === "admin";
}

function isRoleAllowedForExpenseReview(role: TravelActorRole): boolean {
  return role === "finance" || role === "admin";
}

function isRoleAllowedForFinanceSync(role: TravelActorRole): boolean {
  return role === "finance" || role === "admin";
}

function shouldSimulateSyncFailure(totalAmount: number, attemptCount: number): boolean {
  return attemptCount === 1 && totalAmount >= 10000;
}

function reevaluatePolicy(request: TravelRequest, now: Date): TravelRequest {
  const activePolicy = getActiveTravelPolicy(now);
  return {
    ...request,
    policyEvaluation: evaluateTravelPolicy({
      employeeGrade: request.employeeGrade,
      tripType: request.tripType,
      departureDate: request.departureDate,
      returnDate: request.returnDate,
      travelClass: request.travelClass,
      estimatedCost: request.estimatedCost,
      currency: request.currency,
      now,
    }, activePolicy),
  };
}

export function listTravelRequests(): TravelRequest[] {
  return ensureState()
    .map((request) => cloneTravelRequest(request))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function createTravelRequest(
  payload: CreateTravelRequestPayload,
): CreateTravelRequestResult {
  const validationError = validateCreatePayload(payload);
  if (validationError) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: validationError,
      },
    };
  }

  const rows = ensureState();
  const now = new Date();
  const at = now.toISOString();
  const activePolicy = getActiveTravelPolicy(now);
  const policyEvaluation = evaluateTravelPolicy({
    employeeGrade: payload.employeeGrade,
    tripType: payload.tripType,
    departureDate: payload.departureDate,
    returnDate: payload.returnDate,
    travelClass: payload.travelClass,
    estimatedCost: payload.estimatedCost,
    currency: payload.currency,
    now,
  }, activePolicy);

  const created: TravelRequest = {
    id: nextRequestId(rows),
    employeeName: payload.employeeName.trim(),
    employeeEmail: payload.employeeEmail.trim(),
    employeeGrade: payload.employeeGrade,
    department: payload.department.trim(),
    costCenter: payload.costCenter.trim(),
    tripType: payload.tripType,
    origin: payload.origin.trim(),
    destination: payload.destination.trim(),
    departureDate: payload.departureDate,
    returnDate: payload.returnDate,
    purpose: payload.purpose.trim(),
    travelClass: payload.travelClass,
    estimatedCost: Math.round(payload.estimatedCost * 100) / 100,
    currency: payload.currency.trim().toUpperCase(),
    status: "draft",
    approvalRoute: buildInitialApprovalRoute(),
    policyEvaluation,
    booking: null,
    expenses: [],
    financeSync: createInitialFinanceSyncState(),
    closure: null,
    createdAt: at,
    updatedAt: at,
    createdBy: payload.actorName.trim(),
    updatedBy: payload.actorName.trim(),
    version: 1,
    auditTrail: [],
  };

  created.auditTrail.push(
    createAuditEvent(
      created,
      "create_request",
      at,
      payload.actorRole,
      payload.actorName.trim(),
      "draft",
      null,
      "Request created as draft.",
    ),
  );

  rows.unshift(created);
  return {
    ok: true,
    result: cloneTravelRequest(created),
  };
}

export function applyTravelRequestTransition(
  input: ApplyTravelTransitionInput,
): ApplyTravelTransitionResult {
  if (!isNonEmptyText(input.requestId)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "requestId is required.",
      },
    };
  }
  if (!isNonEmptyText(input.actorName)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "actorName is required.",
      },
    };
  }

  const rows = ensureState();
  const index = rows.findIndex((row) => row.id === input.requestId);
  if (index < 0) {
    return {
      ok: false,
      error: {
        code: "request_not_found",
        message: "Travel request was not found.",
      },
    };
  }

  const current = rows[index];
  if (!current) {
    return {
      ok: false,
      error: {
        code: "request_not_found",
        message: "Travel request was not found.",
      },
    };
  }

  const now = new Date();
  const at = now.toISOString();
  let workingRequest = current;
  if (input.transitionId === "submit_request") {
    workingRequest = reevaluatePolicy(current, now);
  }

  const transition = getTravelTransitionOption(input.transitionId, {
    request: workingRequest,
    actorRole: input.actorRole,
  });

  if (!transition.allowed) {
    const messages: Record<NonNullable<typeof transition.blockedReason>, string> = {
      role_not_allowed: "Current role is not allowed to execute this transition.",
      state_not_allowed: "Transition is not valid for the current request status.",
      policy_blocked: "Policy violations must be resolved before submitting this request.",
      trip_not_completed: "Trip cannot be closed before the return date.",
      booking_not_recorded: "Booking details must be recorded before closing.",
      expenses_pending: "All pending expense claims must be reviewed before closing.",
      finance_sync_incomplete: "Approved expenses must be synchronized before closing.",
    };
    return {
      ok: false,
      error: {
        code: "transition_not_allowed",
        message: messages[transition.blockedReason ?? "state_not_allowed"],
      },
    };
  }

  if (transition.requiresNote && !isNonEmptyText(input.note)) {
    return {
      ok: false,
      error: {
        code: "note_required",
        message: "A note is required for this action.",
      },
    };
  }

  let closure: TravelTripClosureRecord | null = workingRequest.closure;
  if (input.transitionId === "close_trip") {
    const readiness = buildTripClosureReadiness(workingRequest, now);
    if (!readiness.ready) {
      const failedCheck = readiness.checks.find((check) => !check.passed);
      return {
        ok: false,
        error: {
          code: "transition_not_allowed",
          message: failedCheck?.message ?? "Trip cannot be closed yet.",
        },
      };
    }
    closure = buildTripClosureRecord(
      workingRequest,
      at,
      input.actorName,
      input.note,
    );
  }

  const nextStatus = transition.to;
  const updated: TravelRequest = {
    ...workingRequest,
    status: nextStatus,
    approvalRoute: applyTransitionToApprovalRoute({
      route: workingRequest.approvalRoute,
      transitionId: input.transitionId,
      actorName: input.actorName.trim(),
      at,
      note: input.note?.trim(),
    }),
    closure,
    updatedAt: at,
    updatedBy: input.actorName.trim(),
    version: workingRequest.version + 1,
    auditTrail: [
      ...workingRequest.auditTrail,
      createAuditEvent(
        workingRequest,
        input.transitionId,
        at,
        input.actorRole,
        input.actorName.trim(),
        nextStatus,
        workingRequest.status,
        input.note?.trim(),
      ),
    ],
  };

  rows[index] = updated;

  return {
    ok: true,
    result: {
      request: cloneTravelRequest(updated),
      fromStatus: workingRequest.status,
      toStatus: nextStatus,
      transitionId: input.transitionId,
      at,
    },
  };
}

const AUTO_APPROVAL_STEPS_BY_STATUS: Partial<
  Record<TravelRequestStatus, TravelTransitionId>
> = {
  submitted: "approve_manager",
  manager_approved: "start_travel_review",
  travel_review: "approve_finance",
  finance_approved: "confirm_booking",
};

function isAutoApprovalEligibleRequest(request: TravelRequest, maxEstimatedCost: number): boolean {
  if (request.policyEvaluation.level !== "compliant") {
    return false;
  }
  if (request.estimatedCost > maxEstimatedCost) {
    return false;
  }
  return request.status in AUTO_APPROVAL_STEPS_BY_STATUS;
}

export function autoApproveTravelRequests(
  input: AutoApproveTravelRequestsInput,
): AutoApproveTravelRequestsResult {
  if (!isNonEmptyText(input.actorName)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "actorName is required.",
      },
    };
  }

  if (input.actorRole !== "admin") {
    return {
      ok: false,
      error: {
        code: "role_not_allowed",
        message: "Only admin can execute auto-approval.",
      },
    };
  }

  const rows = ensureState();
  const maxEstimatedCost =
    typeof input.maxEstimatedCost === "number" &&
    Number.isFinite(input.maxEstimatedCost) &&
    input.maxEstimatedCost > 0
      ? input.maxEstimatedCost
      : 5000;

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  const touchedRequestIds: string[] = [];

  for (const row of rows) {
    if (!isAutoApprovalEligibleRequest(row, maxEstimatedCost)) {
      continue;
    }
    scanned += 1;

    let advanced = false;
    let currentStatus = row.status;
    for (let guard = 0; guard < 4; guard += 1) {
      const transitionId = AUTO_APPROVAL_STEPS_BY_STATUS[currentStatus];
      if (!transitionId) {
        break;
      }

      const result = applyTravelRequestTransition({
        requestId: row.id,
        transitionId,
        actorRole: "admin",
        actorName: input.actorName,
        note: "Auto-approved by low-risk automation policy.",
      });

      if (!result.ok) {
        break;
      }

      advanced = true;
      currentStatus = result.result.toStatus;
      if (currentStatus === "booked") {
        break;
      }
    }

    if (advanced) {
      updated += 1;
      touchedRequestIds.push(row.id);
    } else {
      skipped += 1;
    }
  }

  return {
    ok: true,
    result: {
      scanned,
      updated,
      skipped,
      touchedRequestIds,
    },
  };
}

export function upsertTravelBooking(input: UpsertTravelBookingInput): UpsertTravelBookingResult {
  if (!isRoleAllowedForBooking(input.actorRole)) {
    return {
      ok: false,
      error: {
        code: "role_not_allowed",
        message: "Only travel desk or admin can manage booking details.",
      },
    };
  }

  const textFields: Array<[string, unknown]> = [
    ["requestId", input.requestId],
    ["actorName", input.actorName],
    ["vendor", input.vendor],
    ["bookingReference", input.bookingReference],
    ["currency", input.currency],
  ];

  for (const [field, value] of textFields) {
    if (!isNonEmptyText(value)) {
      return {
        ok: false,
        error: {
          code: "validation_failed",
          message: `${field} is required.`,
        },
      };
    }
  }

  if (!Number.isFinite(input.totalBookedCost) || input.totalBookedCost <= 0) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "totalBookedCost must be greater than zero.",
      },
    };
  }

  if (input.bookedAt && !isValidDateInput(input.bookedAt)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "bookedAt must be a valid date.",
      },
    };
  }

  const rows = ensureState();
  const index = rows.findIndex((row) => row.id === input.requestId);
  if (index < 0) {
    return {
      ok: false,
      error: {
        code: "request_not_found",
        message: "Travel request was not found.",
      },
    };
  }

  const current = rows[index];
  if (!current) {
    return {
      ok: false,
      error: {
        code: "request_not_found",
        message: "Travel request was not found.",
      },
    };
  }

  if (current.status !== "booked") {
    return {
      ok: false,
      error: {
        code: "invalid_state",
        message: "Booking details can only be recorded after request is booked.",
      },
    };
  }

  const at = input.bookedAt ? new Date(input.bookedAt).toISOString() : new Date().toISOString();
  const updated: TravelRequest = {
    ...current,
    booking: {
      vendor: input.vendor.trim(),
      bookingReference: input.bookingReference.trim(),
      ticketNumber: input.ticketNumber?.trim() || undefined,
      bookedAt: at,
      totalBookedCost: Math.round(input.totalBookedCost * 100) / 100,
      currency: input.currency.trim().toUpperCase(),
      bookedBy: input.actorName.trim(),
    },
    updatedAt: at,
    updatedBy: input.actorName.trim(),
    version: current.version + 1,
    auditTrail: [
      ...current.auditTrail,
      createAuditEvent(
        current,
        "record_booking",
        at,
        input.actorRole,
        input.actorName.trim(),
        current.status,
        current.status,
        `Booking reference ${input.bookingReference.trim()} updated.`,
      ),
    ],
  };

  rows[index] = updated;

  return {
    ok: true,
    result: {
      request: cloneTravelRequest(updated),
      at,
    },
  };
}

export function submitTravelExpense(input: SubmitTravelExpenseInput): SubmitTravelExpenseResult {
  if (!isRoleAllowedForExpenseSubmission(input.actorRole)) {
    return {
      ok: false,
      error: {
        code: "role_not_allowed",
        message: "Only employee or admin can submit travel expenses.",
      },
    };
  }

  const textFields: Array<[string, unknown]> = [
    ["requestId", input.requestId],
    ["actorName", input.actorName],
    ["currency", input.currency],
    ["expenseDate", input.expenseDate],
    ["merchant", input.merchant],
    ["description", input.description],
    ["receiptFileName", input.receiptFileName],
    ["receiptMimeType", input.receiptMimeType],
  ];

  for (const [field, value] of textFields) {
    if (!isNonEmptyText(value)) {
      return {
        ok: false,
        error: {
          code: "validation_failed",
          message: `${field} is required.`,
        },
      };
    }
  }

  if (!VALID_EXPENSE_CATEGORIES.has(input.category)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "category is invalid.",
      },
    };
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "amount must be greater than zero.",
      },
    };
  }

  if (!isValidDateInput(input.expenseDate)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "expenseDate must be a valid date.",
      },
    };
  }

  if (!Number.isFinite(input.receiptSizeInBytes) || input.receiptSizeInBytes <= 0) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "receiptSizeInBytes must be greater than zero.",
      },
    };
  }

  if (input.receiptSizeInBytes > 5 * 1024 * 1024) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "receiptSizeInBytes exceeds the 5 MB limit.",
      },
    };
  }

  const rows = ensureState();
  const index = rows.findIndex((row) => row.id === input.requestId);
  if (index < 0) {
    return {
      ok: false,
      error: {
        code: "request_not_found",
        message: "Travel request was not found.",
      },
    };
  }

  const current = rows[index];
  if (!current) {
    return {
      ok: false,
      error: {
        code: "request_not_found",
        message: "Travel request was not found.",
      },
    };
  }

  if (current.status !== "booked") {
    return {
      ok: false,
      error: {
        code: "invalid_state",
        message: "Expenses can only be submitted after booking confirmation.",
      },
    };
  }

  const at = new Date().toISOString();
  const expense: TravelExpenseClaim = {
    id: nextExpenseId(current),
    category: input.category,
    amount: Math.round(input.amount * 100) / 100,
    currency: input.currency.trim().toUpperCase(),
    expenseDate: new Date(input.expenseDate).toISOString(),
    merchant: input.merchant.trim(),
    description: input.description.trim(),
    status: "submitted",
    submittedBy: input.actorName.trim(),
    submittedAt: at,
    receipt: {
      fileName: input.receiptFileName.trim(),
      mimeType: input.receiptMimeType.trim().toLowerCase(),
      sizeInBytes: Math.round(input.receiptSizeInBytes),
      uploadedAt: at,
    },
  };

  const updated: TravelRequest = {
    ...current,
    expenses: [...current.expenses, expense],
    financeSync: {
      ...current.financeSync,
      status: "not_synced",
      lastError: undefined,
    },
    updatedAt: at,
    updatedBy: input.actorName.trim(),
    version: current.version + 1,
    auditTrail: [
      ...current.auditTrail,
      createAuditEvent(
        current,
        "submit_expense",
        at,
        input.actorRole,
        input.actorName.trim(),
        current.status,
        current.status,
        `Expense ${expense.id} submitted.`,
      ),
    ],
  };

  rows[index] = updated;

  return {
    ok: true,
    result: {
      request: cloneTravelRequest(updated),
      expense: { ...expense, receipt: { ...expense.receipt } },
      at,
    },
  };
}

export function reviewTravelExpense(input: ReviewTravelExpenseInput): ReviewTravelExpenseResult {
  if (!isRoleAllowedForExpenseReview(input.actorRole)) {
    return {
      ok: false,
      error: {
        code: "role_not_allowed",
        message: "Only finance or admin can review expense claims.",
      },
    };
  }

  if (!isNonEmptyText(input.requestId)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "requestId is required.",
      },
    };
  }

  if (!isNonEmptyText(input.expenseId)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "expenseId is required.",
      },
    };
  }

  if (!isNonEmptyText(input.actorName)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "actorName is required.",
      },
    };
  }

  if (input.decision === "reject" && !isNonEmptyText(input.note)) {
    return {
      ok: false,
      error: {
        code: "note_required",
        message: "A note is required when rejecting an expense claim.",
      },
    };
  }

  const rows = ensureState();
  const index = rows.findIndex((row) => row.id === input.requestId);
  if (index < 0) {
    return {
      ok: false,
      error: {
        code: "request_not_found",
        message: "Travel request was not found.",
      },
    };
  }

  const current = rows[index];
  if (!current) {
    return {
      ok: false,
      error: {
        code: "request_not_found",
        message: "Travel request was not found.",
      },
    };
  }

  const expenseIndex = current.expenses.findIndex((expense) => expense.id === input.expenseId);
  if (expenseIndex < 0) {
    return {
      ok: false,
      error: {
        code: "expense_not_found",
        message: "Expense claim was not found.",
      },
    };
  }

  const expense = current.expenses[expenseIndex];
  if (!expense) {
    return {
      ok: false,
      error: {
        code: "expense_not_found",
        message: "Expense claim was not found.",
      },
    };
  }

  if (expense.status !== "submitted") {
    return {
      ok: false,
      error: {
        code: "expense_not_pending",
        message: "Only submitted expense claims can be reviewed.",
      },
    };
  }

  const at = new Date().toISOString();
  const nextStatus: TravelExpenseStatus =
    input.decision === "approve" ? "approved" : "rejected";

  const reviewedExpense: TravelExpenseClaim = {
    ...expense,
    status: nextStatus,
    reviewedBy: input.actorName.trim(),
    reviewedAt: at,
    reviewNote: input.note?.trim(),
    ...(nextStatus === "approved"
      ? {
          syncedAt: undefined,
          syncedBatchId: undefined,
        }
      : {}),
  };

  const updatedExpenses = current.expenses.map((item, idx) =>
    idx === expenseIndex ? reviewedExpense : item,
  );

  const updated: TravelRequest = {
    ...current,
    expenses: updatedExpenses,
    financeSync:
      nextStatus === "approved"
        ? {
            ...current.financeSync,
            status: "not_synced",
            lastError: undefined,
          }
        : current.financeSync,
    updatedAt: at,
    updatedBy: input.actorName.trim(),
    version: current.version + 1,
    auditTrail: [
      ...current.auditTrail,
      createAuditEvent(
        current,
        input.decision === "approve" ? "approve_expense" : "reject_expense",
        at,
        input.actorRole,
        input.actorName.trim(),
        current.status,
        current.status,
        `${reviewedExpense.id}${input.note?.trim() ? `: ${input.note.trim()}` : ""}`,
      ),
    ],
  };

  rows[index] = updated;

  return {
    ok: true,
    result: {
      request: cloneTravelRequest(updated),
      expense: { ...reviewedExpense, receipt: { ...reviewedExpense.receipt } },
      at,
    },
  };
}

export function syncTravelFinance(input: SyncTravelFinanceInput): SyncTravelFinanceResult {
  if (!isRoleAllowedForFinanceSync(input.actorRole)) {
    return {
      ok: false,
      error: {
        code: "role_not_allowed",
        message: "Only finance or admin can execute ERP synchronization.",
      },
    };
  }

  if (!isNonEmptyText(input.requestId)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "requestId is required.",
      },
    };
  }

  if (!isNonEmptyText(input.actorName)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "actorName is required.",
      },
    };
  }

  const rows = ensureState();
  const index = rows.findIndex((row) => row.id === input.requestId);
  if (index < 0) {
    return {
      ok: false,
      error: {
        code: "request_not_found",
        message: "Travel request was not found.",
      },
    };
  }

  const current = rows[index];
  if (!current) {
    return {
      ok: false,
      error: {
        code: "request_not_found",
        message: "Travel request was not found.",
      },
    };
  }

  const approvedExpenses = current.expenses.filter((expense) => expense.status === "approved");
  if (!approvedExpenses.length) {
    return {
      ok: false,
      error: {
        code: "no_expenses_to_sync",
        message: "No approved expenses available for ERP synchronization.",
      },
    };
  }

  const unsyncedExpenses = approvedExpenses.filter((expense) => !expense.syncedAt);
  if (!unsyncedExpenses.length) {
    return {
      ok: false,
      error: {
        code: "already_synced",
        message: "All approved expenses are already synchronized.",
      },
    };
  }

  const at = new Date().toISOString();
  const nextAttemptCount = current.financeSync.attemptCount + 1;
  const totalAmount = unsyncedExpenses.reduce((sum, expense) => sum + expense.amount, 0);

  if (shouldSimulateSyncFailure(totalAmount, nextAttemptCount)) {
    const failed: TravelRequest = {
      ...current,
      financeSync: {
        ...current.financeSync,
        status: "failed",
        attemptCount: nextAttemptCount,
        lastAttemptAt: at,
        lastError: "ERP endpoint timeout. Retry synchronization.",
      },
      updatedAt: at,
      updatedBy: input.actorName.trim(),
      version: current.version + 1,
      auditTrail: [
        ...current.auditTrail,
        createAuditEvent(
          current,
          "finance_sync_failed",
          at,
          input.actorRole,
          input.actorName.trim(),
          current.status,
          current.status,
          "ERP endpoint timeout.",
        ),
      ],
    };

    rows[index] = failed;

    return {
      ok: false,
      error: {
        code: "sync_failed",
        message: "ERP synchronization failed. Retry is required.",
      },
    };
  }

  const batchId = nextBatchId(current);
  const ledgerLines: TravelLedgerLine[] = unsyncedExpenses.map((expense, indexInBatch) => ({
    id: `${current.id}-GL-${String(current.financeSync.ledgerLines.length + indexInBatch + 1).padStart(4, "0")}`,
    expenseId: expense.id,
    glAccount: GL_ACCOUNT_BY_EXPENSE_CATEGORY[expense.category],
    costCenter: current.costCenter,
    amount: expense.amount,
    currency: expense.currency,
    memo: `${current.id} ${expense.category} ${expense.merchant}`,
  }));

  const updatedExpenses = current.expenses.map((expense) => {
    if (!unsyncedExpenses.find((candidate) => candidate.id === expense.id)) {
      return expense;
    }
    return {
      ...expense,
      syncedAt: at,
      syncedBatchId: batchId,
    };
  });

  const success: TravelRequest = {
    ...current,
    expenses: updatedExpenses,
    financeSync: {
      ...current.financeSync,
      status: "succeeded",
      attemptCount: nextAttemptCount,
      lastAttemptAt: at,
      lastError: undefined,
      lastBatchId: batchId,
      ledgerLines: [...current.financeSync.ledgerLines, ...ledgerLines],
    },
    updatedAt: at,
    updatedBy: input.actorName.trim(),
    version: current.version + 1,
    auditTrail: [
      ...current.auditTrail,
      createAuditEvent(
        current,
        "finance_sync_succeeded",
        at,
        input.actorRole,
        input.actorName.trim(),
        current.status,
        current.status,
        `Batch ${batchId} synchronized (${ledgerLines.length} line(s)).`,
      ),
    ],
  };

  rows[index] = success;

  return {
    ok: true,
    result: {
      request: cloneTravelRequest(success),
      batchId,
      syncedExpenses: unsyncedExpenses.length,
      ledgerLines: ledgerLines.map((line) => ({ ...line })),
      at,
    },
  };
}

function escapeCsvCell(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replaceAll("\"", "\"\"")}"`;
  }
  return value;
}

export function exportTravelAuditCsv(): string {
  const headers = [
    "request_id",
    "event_id",
    "at",
    "actor_role",
    "actor_name",
    "action",
    "from_status",
    "to_status",
    "note",
  ];

  const lines: string[] = [headers.join(",")];
  const rows = listTravelRequests();

  for (const request of rows) {
    for (const event of request.auditTrail) {
      const line = [
        request.id,
        event.id,
        event.at,
        event.actorRole,
        event.actorName,
        event.action,
        event.fromStatus ?? "",
        event.toStatus,
        event.note ?? "",
      ].map((cell) => escapeCsvCell(String(cell)));
      lines.push(line.join(","));
    }
  }

  return `${lines.join("\n")}\n`;
}

export function getTravelInsights(): TravelInsights {
  return buildTravelInsights(listTravelRequests());
}

export function getTravelTripClosureReadiness(
  requestId: string,
): GetTravelTripClosureReadinessResult {
  if (!isNonEmptyText(requestId)) {
    return {
      ok: false,
      error: {
        code: "validation_failed",
        message: "requestId is required.",
      },
    };
  }

  const rows = ensureState();
  const request = rows.find((row) => row.id === requestId);
  if (!request) {
    return {
      ok: false,
      error: {
        code: "request_not_found",
        message: "Travel request was not found.",
      },
    };
  }

  return {
    ok: true,
    result: {
      requestId,
      readiness: buildTripClosureReadiness(request),
    },
  };
}
