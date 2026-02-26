import prisma from "@/lib/prisma";
import { runMongoCommand, toMongoDate } from "@/lib/mongo-helper";
import { logger } from "@/lib/logger";
import { evaluateTravelPolicy } from "@/modules/travel/policy/travel-policy-engine";
import {
  buildTravelInsights,
  type TravelInsights,
} from "@/modules/travel/services/travel-insights";
import { getActiveTravelPolicy } from "@/services/travel-policy-store";
import { upsertTravelSettlementTransaction } from "@/services/transaction-store";
import type {
  CreateTravelRequestInput,
  TravelClosureReadiness,
  TravelClosureReadinessCheck,
  EmployeeGrade,
  TravelActorRole,
  TravelAuditEvent,
  TravelExpenseCategory,
  TravelExpenseClaim,
  TravelClass,
  TravelLedgerLine,
  TravelBookingRecord,
  TravelRequest,
  TravelRequestStatus,
  TravelTripClosureRecord,
  TripType,
} from "@/modules/travel/types";
import {
  applyTransitionToApprovalRoute,
  buildInitialApprovalRoute,
  getTravelTransitionOption,
  type TravelTransitionBlockReason,
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

let legacyTravelRequestDataNormalized = false;

async function ensureTravelRequestDataCompatibility(): Promise<void> {
  if (legacyTravelRequestDataNormalized) {
    return;
  }

  // Legacy records may contain approvalRoute entries with `id` instead of required `stepId`.
  // Prisma rejects those rows; reset corrupted approval routes to keep list/read flows operational.
  await runMongoCommand("travel_requests", "update", {
    updates: [
      {
        q: { "approvalRoute.stepId": null },
        u: { $set: { approvalRoute: [] } },
        multi: true,
      },
      {
        q: { "financeSync.ledgerLines.accountCode": null },
        u: { $set: { "financeSync.ledgerLines": [] } },
        multi: true,
      },
    ],
  });

  legacyTravelRequestDataNormalized = true;
}

interface CreateTravelRequestPayload extends CreateTravelRequestInput {
  actorRole: TravelActorRole;
  actorName: string;
  linkedServiceBookingIds?: string[];
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
      | "role_not_allowed" | "validation_failed"
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

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MongoDB helper to map Prisma model to Domain type
 */
function mapPrismaToTravelRequest(data: any): TravelRequest {
  const policyEvaluationRaw =
    data.policyEvaluation && typeof data.policyEvaluation === "object"
      ? data.policyEvaluation
      : null;
  const policyEvaluation = policyEvaluationRaw
    ? {
      policyVersion:
        typeof policyEvaluationRaw.policyId === "string"
          ? policyEvaluationRaw.policyId
          : "unknown",
      level:
        typeof policyEvaluationRaw.level === "string"
          ? (policyEvaluationRaw.level as any)
          : ("warning" as any),
      findings: Array.isArray(policyEvaluationRaw.findings) ? policyEvaluationRaw.findings : [],
      evaluatedAt:
        typeof policyEvaluationRaw.evaluatedAt === "string"
          ? policyEvaluationRaw.evaluatedAt
          : (
            (data.updatedAt instanceof Date ? data.updatedAt.toISOString() : data.updatedAt)
            ?? (data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt)
            ?? new Date().toISOString()
          ),
    }
    : {
      policyVersion: "unknown",
      level: "warning" as any,
      findings: [
        {
          code: "policy_evaluation_missing",
          level: "warning",
          message: "Policy evaluation data is missing for this travel request.",
        },
      ],
      evaluatedAt:
        (data.updatedAt instanceof Date ? data.updatedAt.toISOString() : data.updatedAt)
        ?? (data.createdAt instanceof Date ? data.createdAt.toISOString() : data.createdAt)
        ?? new Date().toISOString(),
    };

  const financeSync = data.financeSync
    ? {
      status: data.financeSync.status as any,
      attemptCount: data.financeSync.attemptCount ?? 0,
      lastAttemptAt: data.financeSync.lastAttemptAt ?? undefined,
      lastError: data.financeSync.lastError ?? data.financeSync.errorMessage ?? undefined,
      lastBatchId: data.financeSync.lastBatchId ?? undefined,
      ledgerLines: (Array.isArray(data.financeSync.ledgerLines) ? data.financeSync.ledgerLines : []).map(
        (line: any) => ({
          id: line.id,
          expenseId: typeof line.expenseId === "string" ? line.expenseId : "",
          glAccount: line.glAccount ?? line.accountCode ?? "610900",
          costCenter: line.costCenter ?? data.costCenter ?? "",
          amount:
            typeof line.amount === "number"
              ? line.amount
              : typeof line.debit === "number"
                ? line.debit
                : typeof line.credit === "number"
                  ? line.credit
                  : 0,
          currency: line.currency ?? data.currency ?? "SAR",
          memo: line.memo ?? line.description ?? "",
        }),
      ),
    }
    : {
      status: "not_synced" as any,
      attemptCount: 0,
      ledgerLines: [],
    };

  return {
    id: data.id,
    customerId: data.customerId ?? undefined,
    linkedServiceBookings: Array.isArray(data.linkedServiceBookings) ? data.linkedServiceBookings : [],
    employeeName: data.employeeName,
    employeeEmail: data.employeeEmail,
    employeeGrade: data.employeeGrade as any,
    department: data.department,
    costCenter: data.costCenter,
    tripType: data.tripType as any,
    origin: data.origin,
    destination: data.destination,
    departureDate: data.departureDate,
    returnDate: data.returnDate,
    purpose: data.purpose,
    travelClass: data.travelClass as any,
    baseEstimatedCost: data.baseEstimatedCost ?? undefined,
    additionalServicesCost: data.additionalServicesCost ?? undefined,
    estimatedCost: data.estimatedCost,
    currency: data.currency,
    status: data.status as any,
    approvalRoute: (Array.isArray(data.approvalRoute) ? data.approvalRoute : []).map((step: any) => ({
      id: step.stepId,
      role: step.role as any,
      status: step.status as any,
      actorName: step.actorName ?? undefined,
      actedAt: step.at ?? undefined,
      note: step.note ?? undefined,
    })),
    policyEvaluation,
    booking: data.booking ? { ...data.booking } : null,
    expenses: (Array.isArray(data.expenses) ? data.expenses : []).map((exp: any) => ({
      ...exp,
      status: exp.status as any,
    })),
    financeSync,
    closure: data.closure ? { ...data.closure } : null,
    createdAt:
      data.createdAt instanceof Date
        ? data.createdAt.toISOString()
        : (typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString()),
    updatedAt:
      data.updatedAt instanceof Date
        ? data.updatedAt.toISOString()
        : (typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString()),
    createdBy: data.createdBy,
    updatedBy: data.updatedBy,
    version: data.version,
    auditTrail: (Array.isArray(data.auditTrail) ? data.auditTrail : []).map((evt: any) => ({
      id: evt.id,
      at: evt.at,
      actorRole: evt.actorRole as any,
      actorName: evt.actorName,
      action: evt.action,
      fromStatus: evt.fromStatus as any,
      toStatus: evt.toStatus as any,
      note: evt.note ?? undefined,
    })),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function generateNextRequestId(): Promise<string> {
  const records = await prisma.travelRequest.findMany({ select: { id: true } });
  const max = records.reduce((highest, record) => {
    const match = /^TRV-(\d+)$/i.exec(record.id);
    if (!match) return highest;
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
  const pendingExpenses = request.expenses.filter((e) => e.status === "submitted");
  const approvedExpenses = request.expenses.filter((e) => e.status === "approved");
  const approvedUnsyncedExpenses = approvedExpenses.filter((e) => !e.syncedAt);
  const rejectedExpenses = request.expenses.filter((e) => e.status === "rejected");

  const totalApprovedAmount = roundMoney(approvedExpenses.reduce((s, e) => s + e.amount, 0));
  const totalApprovedSyncedAmount = roundMoney(
    approvedExpenses.filter((e) => e.syncedAt).reduce((s, e) => s + e.amount, 0),
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
    ready: checks.every((c) => c.passed),
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
  if (!isNonEmptyText(input.actorName)) return "Actor name is required.";
  const required: Array<
    | "employeeName"
    | "employeeEmail"
    | "department"
    | "costCenter"
    | "origin"
    | "destination"
    | "departureDate"
    | "returnDate"
    | "purpose"
    | "currency"
  > = [
    "employeeName", "employeeEmail", "department", "costCenter",
    "origin", "destination", "departureDate", "returnDate", "purpose", "currency"
  ];
  for (const f of required) {
    if (!isNonEmptyText(input[f])) return `${f} is required.`;
  }
  if (!VALID_GRADES.has(input.employeeGrade)) return "employeeGrade is invalid.";
  if (!VALID_TRIP_TYPES.has(input.tripType)) return "tripType is invalid.";
  if (!VALID_CLASSES.has(input.travelClass)) return "travelClass is invalid.";
  if (!Number.isFinite(input.estimatedCost) || input.estimatedCost <= 0) return "estimatedCost must be > 0.";
  return null;
}

async function reevaluatePolicy(request: TravelRequest, now: Date): Promise<TravelRequest> {
  const activePolicy = await getActiveTravelPolicy(now);
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

const AUTO_APPROVAL_STEPS_BY_STATUS: Record<string, TravelTransitionId> = {
  submitted: "approve_manager",
  // manager_approved: "approve_director", // Not supported in current workflow engine
  // director_approved: "approve_executive", // Not supported in current workflow engine
  // executive_approved: "approve_finance", // Not supported in current workflow engine
};

function isAutoApprovalEligibleRequest(request: TravelRequest, maxCost: number): boolean {
  return request.estimatedCost <= maxCost && request.policyEvaluation?.level === "compliant";
}

function isRoleAllowedForBooking(role: TravelActorRole): boolean {
  return role === "admin" || role === "agent" || role === "travel_desk";
}

function isRoleAllowedForExpenseSubmission(role: TravelActorRole): boolean {
  return role === "admin" || role === "agent" || role === "manager" || role === "employee";
}

function isRoleAllowedForExpenseReview(role: TravelActorRole): boolean {
  return role === "admin" || role === "finance";
}

function isRoleAllowedForFinanceSync(role: TravelActorRole): boolean {
  return role === "admin" || role === "finance";
}

function getTransitionBlockedMessage(reason?: TravelTransitionBlockReason): string {
  switch (reason) {
    case "role_not_allowed":
      return "Actor role is not allowed for this transition.";
    case "state_not_allowed":
      return "Action not allowed in current state.";
    case "policy_blocked":
      return "Request is blocked by policy and cannot proceed.";
    case "trip_not_completed":
      return "Trip not ready for closure: return date has not passed.";
    case "booking_not_recorded":
      return "Trip not ready for closure: booking details must be recorded first.";
    case "expenses_pending":
      return "Trip not ready for closure: pending expense claims must be reviewed.";
    case "finance_sync_incomplete":
      return "Trip not ready for closure: approved expenses must be synchronized first.";
    default:
      return "Action not allowed in current state.";
  }
}

async function updateTravelRequestRecord(
  requestId: string,
  setData: Record<string, unknown>,
): Promise<TravelRequest> {
  await runMongoCommand("travel_requests", "update", {
    updates: [
      {
        q: { _id: requestId },
        u: {
          $set: {
            ...setData,
            updatedAt: toMongoDate(new Date()),
          },
          $inc: { version: 1 },
        },
        multi: false,
      },
    ],
  });

  const updatedRecord = await prisma.travelRequest.findUniqueOrThrow({ where: { id: requestId } });
  return mapPrismaToTravelRequest(updatedRecord);
}

async function synchronizeTravelSettlement(
  request: TravelRequest,
  actorName: string,
  at: string,
): Promise<void> {
  if (request.status !== "booked") {
    return;
  }
  await upsertTravelSettlementTransaction({
    request,
    actorName,
    at,
  });
}

/**
 * Public Data Access
 */

export async function listTravelRequests(): Promise<TravelRequest[]> {
  await ensureTravelRequestDataCompatibility();
  const records = await prisma.travelRequest.findMany({
    orderBy: { updatedAt: "desc" },
  });
  return records.map(mapPrismaToTravelRequest);
}

export async function createTravelRequest(
  payload: CreateTravelRequestPayload,
): Promise<CreateTravelRequestResult> {
  const validationError = validateCreatePayload(payload);
  if (validationError) return { ok: false, error: { code: "validation_failed", message: validationError } };

  const now = new Date();
  const at = now.toISOString();
  const id = await generateNextRequestId();

  const baseEstimatedCost = roundMoney(payload.baseEstimatedCost ?? payload.estimatedCost);
  const additionalServicesCost = roundMoney(payload.additionalServicesCost ?? 0);
  const totalEstimatedCost = roundMoney(baseEstimatedCost + additionalServicesCost);

  const activePolicy = await getActiveTravelPolicy(now);
  const policyEvaluation = evaluateTravelPolicy({
    employeeGrade: payload.employeeGrade,
    tripType: payload.tripType,
    departureDate: payload.departureDate,
    returnDate: payload.returnDate,
    travelClass: payload.travelClass,
    estimatedCost: totalEstimatedCost,
    currency: payload.currency,
    now,
  }, activePolicy);

  const initialStatus: TravelRequestStatus = "draft";
  const initialApprovalRoute = buildInitialApprovalRoute();

  const auditEvent: TravelAuditEvent = {
    id: `${id}-AUD-001`,
    at,
    actorRole: payload.actorRole,
    actorName: payload.actorName.trim(),
    action: "create_request",
    fromStatus: null,
    toStatus: initialStatus,
    note: "Request created as draft.",
  };

  await runMongoCommand("travel_requests", "insert", {
    documents: [
      {
        _id: id,
        customerId:
          typeof payload.customerId === "string" && payload.customerId.trim().length > 0
            ? payload.customerId.trim()
            : null,
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
        baseEstimatedCost,
        additionalServicesCost,
        estimatedCost: totalEstimatedCost,
        currency: payload.currency.trim().toUpperCase(),
        status: initialStatus,
        approvalRoute: initialApprovalRoute.map((step) => ({
          stepId: step.id,
          role: step.role,
          status: step.status,
          actorName: step.actorName ?? null,
          at: step.actedAt ?? null,
          note: step.note ?? null,
        })),
        policyEvaluation: {
          policyId: policyEvaluation.policyVersion,
          level: policyEvaluation.level,
          evaluatedAt: policyEvaluation.evaluatedAt,
          findings: policyEvaluation.findings,
        },
        financeSync: {
          status: "not_synced",
          attemptCount: 0,
          ledgerLines: [],
        },
        createdBy: payload.actorName.trim(),
        updatedBy: payload.actorName.trim(),
        auditTrail: [auditEvent],
        linkedServiceBookings: payload.linkedServiceBookingIds ?? [],
        createdAt: toMongoDate(now),
        updatedAt: toMongoDate(now),
        version: 1,
      },
    ],
  });

  logger.info("Travel request created successfully", { requestId: id, actor: payload.actorName });

  try {
    const created = await prisma.travelRequest.findUniqueOrThrow({ where: { id } });
    return { ok: true, result: mapPrismaToTravelRequest(created) };
  } catch (error) {
    logger.error("Travel request persisted but read-back failed; returning fallback payload", {
      requestId: id,
      actor: payload.actorName,
      error,
    });
    return {
      ok: true,
      result: {
        id,
        customerId:
          typeof payload.customerId === "string" && payload.customerId.trim().length > 0
            ? payload.customerId.trim()
            : undefined,
        linkedServiceBookings: payload.linkedServiceBookingIds ?? [],
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
        baseEstimatedCost,
        additionalServicesCost,
        estimatedCost: totalEstimatedCost,
        currency: payload.currency.trim().toUpperCase(),
        status: initialStatus,
        approvalRoute: initialApprovalRoute,
        policyEvaluation,
        booking: null,
        expenses: [],
        financeSync: {
          status: "not_synced",
          attemptCount: 0,
          ledgerLines: [],
        },
        closure: null,
        createdAt: at,
        updatedAt: at,
        createdBy: payload.actorName.trim(),
        updatedBy: payload.actorName.trim(),
        version: 1,
        auditTrail: [auditEvent],
      },
    };
  }
}

export async function applyTravelRequestTransition(
  input: ApplyTravelTransitionInput,
): Promise<ApplyTravelTransitionResult> {
  const record = await prisma.travelRequest.findUnique({ where: { id: input.requestId } });
  if (!record) return { ok: false, error: { code: "request_not_found", message: "Not found." } };

  const current = mapPrismaToTravelRequest(record);
  const now = new Date();
  const at = now.toISOString();

  let workingRequest = current;
  if (input.transitionId === "submit_request") workingRequest = await reevaluatePolicy(current, now);

  const transition = getTravelTransitionOption(input.transitionId, {
    request: workingRequest,
    actorRole: input.actorRole,
  });

  if (!transition.allowed) {
    return {
      ok: false,
      error: {
        code: "transition_not_allowed",
        message: getTransitionBlockedMessage(transition.blockedReason),
      },
    };
  }

  if (transition.requiresNote && !isNonEmptyText(input.note)) {
    return { ok: false, error: { code: "note_required", message: "Note required." } };
  }

  let closure = workingRequest.closure;
  if (input.transitionId === "close_trip") {
    const readiness = buildTripClosureReadiness(workingRequest, now);
    if (!readiness.ready) {
      const firstFailedCheck = readiness.checks.find((check) => !check.passed);
      return {
        ok: false,
        error: {
          code: "transition_not_allowed",
          message: firstFailedCheck?.message ?? "Trip not ready for closure.",
        },
      };
    }
    closure = buildTripClosureRecord(workingRequest, at, input.actorName, input.note);
  }

  const nextStatus = transition.to;
  const auditEvent = createAuditEvent(
    workingRequest,
    input.transitionId,
    at,
    input.actorRole,
    input.actorName.trim(),
    nextStatus,
    workingRequest.status,
    input.note?.trim(),
  );

  const updated = await updateTravelRequestRecord(input.requestId, {
    status: nextStatus,
    approvalRoute: applyTransitionToApprovalRoute({
      route: workingRequest.approvalRoute,
      transitionId: input.transitionId,
      actorName: input.actorName.trim(),
      at,
      note: input.note?.trim(),
    }).map((step) => ({
      stepId: step.id,
      role: step.role,
      status: step.status,
      actorName: step.actorName || null,
      at: step.actedAt || null,
      note: step.note || null,
    })),
    updatedBy: input.actorName.trim(),
    closure,
    auditTrail: [...workingRequest.auditTrail, auditEvent],
  });
  if (input.transitionId === "confirm_booking") {
    await synchronizeTravelSettlement(updated, input.actorName.trim(), at);
  }

  return {
    ok: true,
    result: {
      request: updated,
      fromStatus: workingRequest.status,
      toStatus: nextStatus,
      transitionId: input.transitionId,
      at,
    },
  };
}

export async function autoApproveTravelRequests(
  input: AutoApproveTravelRequestsInput,
): Promise<AutoApproveTravelRequestsResult> {
  if (!isNonEmptyText(input.actorName)) return { ok: false, error: { code: "validation_failed", message: "actorName is required." } };
  if (input.actorRole !== "admin") return { ok: false, error: { code: "role_not_allowed", message: "Only admin can execute auto-approval." } };

  const maxEstimatedCost = typeof input.maxEstimatedCost === "number" && input.maxEstimatedCost > 0 ? input.maxEstimatedCost : 5000;
  const records = await prisma.travelRequest.findMany({
    where: { status: { in: Object.keys(AUTO_APPROVAL_STEPS_BY_STATUS) } },
  });

  let scanned = 0, updated = 0, skipped = 0;
  const touchedRequestIds: string[] = [];

  for (const record of records) {
    const row = mapPrismaToTravelRequest(record);
    if (!isAutoApprovalEligibleRequest(row, maxEstimatedCost)) continue;
    scanned++;

    let currentStatus = row.status;
    let advanced = false;
    for (let i = 0; i < 4; i++) {
      const transitionId = AUTO_APPROVAL_STEPS_BY_STATUS[currentStatus];
      if (!transitionId) break;

      const result = await applyTravelRequestTransition({
        requestId: row.id,
        transitionId,
        actorRole: "admin",
        actorName: input.actorName,
        note: "Auto-approved by policy.",
      });

      if (!result.ok) break;
      advanced = true;
      currentStatus = result.result.toStatus;
      if (currentStatus === "booked") break;
    }

    if (advanced) {
      updated++;
      touchedRequestIds.push(row.id);
    } else {
      skipped++;
    }
  }

  return { ok: true, result: { scanned, updated, skipped, touchedRequestIds } };
}

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

export async function upsertTravelBooking(
  input: UpsertTravelBookingInput,
): Promise<UpsertTravelBookingResult> {
  if (!isRoleAllowedForBooking(input.actorRole)) return { ok: false, error: { code: "role_not_allowed", message: "Forbidden." } };

  const record = await prisma.travelRequest.findUnique({ where: { id: input.requestId } });
  if (!record) return { ok: false, error: { code: "request_not_found", message: "Not found." } };

  const current = mapPrismaToTravelRequest(record);
  if (current.status !== "finance_approved" && current.status !== "booked") {
    return { ok: false, error: { code: "invalid_state", message: "Cannot book in current state." } };
  }

  const at = new Date().toISOString();
  const booking: TravelBookingRecord = {
    vendor: input.vendor.trim(),
    bookingReference: input.bookingReference.trim(),
    ticketNumber: input.ticketNumber?.trim(),
    bookedAt: input.bookedAt ?? at,
    totalBookedCost: roundMoney(input.totalBookedCost),
    currency: input.currency.trim().toUpperCase(),
    bookedBy: input.actorName.trim(),
  };

  const updated = await updateTravelRequestRecord(input.requestId, {
    status: "booked",
    booking,
    updatedBy: input.actorName.trim(),
    auditTrail: [
      ...current.auditTrail,
      createAuditEvent(
        current,
        "confirm_booking",
        at,
        input.actorRole,
        input.actorName,
        "booked",
        current.status,
        `Booking: ${booking.bookingReference}`,
      ),
    ],
  });
  await synchronizeTravelSettlement(updated, input.actorName.trim(), at);

  return { ok: true, result: { request: updated, at } };
}

export async function submitTravelExpense(
  input: SubmitTravelExpenseInput,
): Promise<SubmitTravelExpenseResult> {
  if (!isRoleAllowedForExpenseSubmission(input.actorRole)) return { ok: false, error: { code: "role_not_allowed", message: "Forbidden." } };
  if (!VALID_EXPENSE_CATEGORIES.has(input.category)) {
    return { ok: false, error: { code: "validation_failed", message: "category is invalid." } };
  }

  const record = await prisma.travelRequest.findUnique({ where: { id: input.requestId } });
  if (!record) return { ok: false, error: { code: "request_not_found", message: "Not found." } };

  const current = mapPrismaToTravelRequest(record);
  if (current.status !== "booked") {
    return { ok: false, error: { code: "invalid_state", message: "Cannot submit expenses now." } };
  }

  const at = new Date().toISOString();
  const expenseId = nextExpenseId(current);
  const expense: TravelExpenseClaim = {
    id: expenseId,
    category: input.category,
    amount: roundMoney(input.amount),
    currency: input.currency.trim().toUpperCase(),
    expenseDate: input.expenseDate,
    merchant: input.merchant.trim(),
    description: input.description.trim(),
    status: "submitted",
    submittedBy: input.actorName.trim(),
    submittedAt: at,
    receipt: {
      fileName: input.receiptFileName,
      mimeType: input.receiptMimeType,
      sizeInBytes: input.receiptSizeInBytes,
      uploadedAt: at,
    },
  };

  const updated = await updateTravelRequestRecord(input.requestId, {
    expenses: [...current.expenses, expense],
    updatedBy: input.actorName.trim(),
    auditTrail: [
      ...current.auditTrail,
      createAuditEvent(
        current,
        "submit_expense",
        at,
        input.actorRole,
        input.actorName,
        current.status,
        current.status,
        `Expense: ${expenseId}`,
      ),
    ],
  });

  return { ok: true, result: { request: updated, expense, at } };
}

export async function reviewTravelExpense(
  input: ReviewTravelExpenseInput,
): Promise<ReviewTravelExpenseResult> {
  if (!isRoleAllowedForExpenseReview(input.actorRole)) return { ok: false, error: { code: "role_not_allowed", message: "Forbidden." } };

  const record = await prisma.travelRequest.findUnique({ where: { id: input.requestId } });
  if (!record) return { ok: false, error: { code: "request_not_found", message: "Not found." } };

  const current = mapPrismaToTravelRequest(record);
  const expIdx = current.expenses.findIndex(e => e.id === input.expenseId);
  if (expIdx < 0) return { ok: false, error: { code: "expense_not_found", message: "Expense not found." } };
  if (current.expenses[expIdx].status !== "submitted") return { ok: false, error: { code: "expense_not_pending", message: "Already reviewed." } };
  if (input.decision === "reject" && !isNonEmptyText(input.note)) {
    return {
      ok: false,
      error: { code: "note_required", message: "A review note is required when rejecting an expense." },
    };
  }

  const at = new Date().toISOString();
  const updatedExpenses = [...current.expenses];
  updatedExpenses[expIdx] = {
    ...updatedExpenses[expIdx],
    status: input.decision === "approve" ? "approved" : "rejected",
    reviewedAt: at,
    reviewedBy: input.actorName.trim(),
    reviewNote: input.note?.trim(),
  };

  const updated = await updateTravelRequestRecord(input.requestId, {
    expenses: updatedExpenses,
    updatedBy: input.actorName.trim(),
    auditTrail: [
      ...current.auditTrail,
      createAuditEvent(
        current,
        `review_expense_${input.decision}`,
        at,
        input.actorRole,
        input.actorName,
        current.status,
        current.status,
        `Expense: ${input.expenseId}`,
      ),
    ],
  });

  return { ok: true, result: { request: updated, expense: updatedExpenses[expIdx], at } };
}

export async function syncTravelFinance(
  input: SyncTravelFinanceInput,
): Promise<SyncTravelFinanceResult> {
  if (!isRoleAllowedForFinanceSync(input.actorRole)) return { ok: false, error: { code: "role_not_allowed", message: "Forbidden." } };

  const record = await prisma.travelRequest.findUnique({ where: { id: input.requestId } });
  if (!record) return { ok: false, error: { code: "request_not_found", message: "Not found." } };

  const current = mapPrismaToTravelRequest(record);
  const pendingSync = current.expenses.filter(e => e.status === "approved" && !e.syncedAt);
  if (pendingSync.length === 0) return { ok: false, error: { code: "no_expenses_to_sync", message: "No approved unsynced expenses." } };

  const at = new Date().toISOString();
  const batchId = nextBatchId(current);
  
  const ledgerLines: TravelLedgerLine[] = pendingSync.map(exp => ({
    id: `${batchId}-${exp.id}`,
    expenseId: exp.id,
    glAccount: GL_ACCOUNT_BY_EXPENSE_CATEGORY[exp.category] || "610900",
    costCenter: current.costCenter,
    amount: exp.amount,
    currency: exp.currency,
    memo: `Travel Expense: ${exp.id} (${exp.merchant})`,
    postedAt: at
  }));
  const persistedLedgerLines = ledgerLines.map((line) => ({
    id: line.id,
    accountCode: line.glAccount,
    description: line.memo,
    debit: line.amount,
    credit: 0,
    currency: line.currency,
  }));
  const financeSyncFromRecord = record.financeSync as unknown;
  const existingPersistedLedgerLines =
    financeSyncFromRecord &&
      typeof financeSyncFromRecord === "object" &&
      "ledgerLines" in financeSyncFromRecord &&
      Array.isArray(
        (financeSyncFromRecord as { ledgerLines?: unknown }).ledgerLines,
      )
      ? (financeSyncFromRecord as { ledgerLines: typeof persistedLedgerLines }).ledgerLines
      : [];

  const updatedExpenses = current.expenses.map(exp => {
    if (exp.status === "approved" && !exp.syncedAt) {
      return { ...exp, syncedAt: at, financeBatchId: batchId };
    }
    return exp;
  });

  const financeSyncPayload = {
    status: "succeeded",
    lastAttemptAt: at,
    attemptCount: current.financeSync.attemptCount + 1,
    lastBatchId: batchId,
    ledgerLines: [...existingPersistedLedgerLines, ...persistedLedgerLines],
  };

  const updated = await updateTravelRequestRecord(input.requestId, {
    expenses: updatedExpenses,
    financeSync: financeSyncPayload,
    updatedBy: input.actorName.trim(),
    auditTrail: [
      ...current.auditTrail,
      createAuditEvent(
        current,
        "finance_sync",
        at,
        input.actorRole,
        input.actorName,
        current.status,
        current.status,
        `Batch: ${batchId}`,
      ),
    ],
  });

  return { ok: true, result: { request: updated, batchId, syncedExpenses: pendingSync.length, ledgerLines, at } };
}

export async function getTravelInsights(): Promise<TravelInsights> {
  const requests = await listTravelRequests();
  return buildTravelInsights(requests);
}

export async function exportTravelAuditCsv(): Promise<string> {
  const requests = await listTravelRequests();
  const header = "Request ID,Action,Actor,Role,From Status,To Status,Date,Note\n";
  const rows = requests.flatMap(req => 
    req.auditTrail.map(evt => 
      `"${req.id}","${evt.action}","${evt.actorName}","${evt.actorRole}","${evt.fromStatus ?? ""}","${evt.toStatus ?? ""}","${evt.at}","${evt.note ?? ""}"`
    )
  ).join("\n");
  return header + rows;
}

export async function getTravelTripClosureReadiness(
  requestId: string,
): Promise<GetTravelTripClosureReadinessResult> {
  const record = await prisma.travelRequest.findUnique({ where: { id: requestId } });
  if (!record) return { ok: false, error: { code: "request_not_found", message: "Not found." } };
  const request = mapPrismaToTravelRequest(record);
  return { ok: true, result: { requestId, readiness: buildTripClosureReadiness(request) } };
}
