import type { TravelInsights } from "@/modules/travel/services/travel-insights";
import type {
  TravelPolicyEditableConfig,
  TravelPolicyVersionRecord,
} from "@/modules/travel/policy/types";
import type {
  CreateTravelRequestInput,
  EmployeeGrade,
  TravelClosureReadiness,
  TravelExpenseCategory,
  TravelExpenseClaim,
  TravelClass,
  TravelLedgerLine,
  TravelPolicyEvaluation,
  TravelRequest,
  TripType,
} from "@/modules/travel/types";
import type { TravelTransitionId } from "@/modules/travel/workflow/travel-approval-engine";

interface ApiErrorPayload {
  message?: string;
}

type CreateTravelRequestPayload = CreateTravelRequestInput;

interface ApplyTravelTransitionPayload {
  requestId: string;
  transitionId: TravelTransitionId;
  note?: string;
}

interface ApplyTravelTransitionResponse {
  request: TravelRequest;
  fromStatus: TravelRequest["status"];
  toStatus: TravelRequest["status"];
  transitionId: TravelTransitionId;
  at: string;
}

interface AutoApproveTravelRequestsPayload {
  maxEstimatedCost?: number;
}

interface AutoApproveTravelRequestsResponse {
  scanned: number;
  updated: number;
  skipped: number;
  touchedRequestIds: string[];
}

interface UpsertBookingPayload {
  requestId: string;
  vendor: string;
  bookingReference: string;
  ticketNumber?: string;
  bookedAt?: string;
  totalBookedCost: number;
  currency: string;
}

interface SubmitExpensePayload {
  requestId: string;
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

interface ReviewExpensePayload {
  requestId: string;
  expenseId: string;
  decision: "approve" | "reject";
  note?: string;
}

interface SyncFinancePayload {
  requestId: string;
}

interface ExpenseMutationResponse {
  request: TravelRequest;
  expense: TravelExpenseClaim;
  at: string;
}

interface FinanceSyncResponse {
  request: TravelRequest;
  batchId: string;
  syncedExpenses: number;
  ledgerLines: TravelLedgerLine[];
  at: string;
}

interface TripClosureReadinessResponse {
  requestId: string;
  readiness: TravelClosureReadiness;
}

interface CreatePolicyDraftPayload {
  config: TravelPolicyEditableConfig;
  note?: string;
}

interface ActivatePolicyVersionPayload {
  versionId: string;
  effectiveFrom?: string;
  note?: string;
}

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const raw = await response.text();
  let payload: unknown = null;
  if (raw.trim().length > 0) {
    try {
      payload = JSON.parse(raw) as T | ApiErrorPayload;
    } catch {
      payload = { message: raw.trim() } satisfies ApiErrorPayload;
    }
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as ApiErrorPayload).message === "string"
        ? (payload as ApiErrorPayload).message ?? fallbackMessage
        : fallbackMessage;
    throw new Error(message);
  }
  if (!payload) {
    throw new Error(fallbackMessage);
  }
  return payload as T;
}

export async function fetchTravelRequests(): Promise<TravelRequest[]> {
  const response = await fetch("/api/travel/requests", {
    method: "GET",
    cache: "no-store",
  });
  return parseApiResponse<TravelRequest[]>(
    response,
    "Unable to fetch travel requests.",
  );
}

export async function fetchTravelInsights(): Promise<TravelInsights> {
  const response = await fetch("/api/travel/insights/overview", {
    method: "GET",
    cache: "no-store",
  });
  return parseApiResponse<TravelInsights>(response, "Unable to fetch travel insights.");
}

export async function createTravelRequestApi(
  payload: CreateTravelRequestPayload,
): Promise<TravelRequest> {
  const response = await fetch("/api/travel/requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return parseApiResponse<TravelRequest>(
    response,
    "Unable to create travel request.",
  );
}

export async function transitionTravelRequest(
  payload: ApplyTravelTransitionPayload,
): Promise<ApplyTravelTransitionResponse> {
  const response = await fetch(`/api/travel/requests/${payload.requestId}/transition`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transitionId: payload.transitionId,
      note: payload.note,
    }),
  });

  return parseApiResponse<ApplyTravelTransitionResponse>(
    response,
    "Unable to execute travel workflow action.",
  );
}

export async function autoApproveTravelRequestsApi(
  payload: AutoApproveTravelRequestsPayload,
): Promise<AutoApproveTravelRequestsResponse> {
  const response = await fetch("/api/travel/requests/auto-approve", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<AutoApproveTravelRequestsResponse>(
    response,
    "Unable to run auto-approval.",
  );
}

export async function upsertTravelBookingApi(payload: UpsertBookingPayload): Promise<TravelRequest> {
  const response = await fetch(`/api/travel/requests/${payload.requestId}/booking`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      vendor: payload.vendor,
      bookingReference: payload.bookingReference,
      ticketNumber: payload.ticketNumber,
      bookedAt: payload.bookedAt,
      totalBookedCost: payload.totalBookedCost,
      currency: payload.currency,
    }),
  });

  const result = await parseApiResponse<{ request: TravelRequest }>(
    response,
    "Unable to save booking details.",
  );
  return result.request;
}

export async function submitTravelExpenseApi(
  payload: SubmitExpensePayload,
): Promise<ExpenseMutationResponse> {
  const response = await fetch(`/api/travel/requests/${payload.requestId}/expenses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      category: payload.category,
      amount: payload.amount,
      currency: payload.currency,
      expenseDate: payload.expenseDate,
      merchant: payload.merchant,
      description: payload.description,
      receiptFileName: payload.receiptFileName,
      receiptMimeType: payload.receiptMimeType,
      receiptSizeInBytes: payload.receiptSizeInBytes,
    }),
  });

  return parseApiResponse<ExpenseMutationResponse>(response, "Unable to submit travel expense.");
}

export async function reviewTravelExpenseApi(
  payload: ReviewExpensePayload,
): Promise<ExpenseMutationResponse> {
  const response = await fetch(
    `/api/travel/requests/${payload.requestId}/expenses/${payload.expenseId}/decision`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decision: payload.decision,
        note: payload.note,
      }),
    },
  );

  return parseApiResponse<ExpenseMutationResponse>(response, "Unable to review expense claim.");
}

export async function syncTravelFinanceApi(payload: SyncFinancePayload): Promise<FinanceSyncResponse> {
  const response = await fetch(`/api/travel/requests/${payload.requestId}/finance/sync`, {
    method: "POST",
  });

  return parseApiResponse<FinanceSyncResponse>(response, "Unable to synchronize ERP entries.");
}

export async function fetchTravelTripClosureReadinessApi(
  requestId: string,
): Promise<TripClosureReadinessResponse> {
  const response = await fetch(`/api/travel/requests/${requestId}/closure/readiness`, {
    method: "GET",
    cache: "no-store",
  });

  return parseApiResponse<TripClosureReadinessResponse>(
    response,
    "Unable to fetch trip closure readiness.",
  );
}

export async function fetchTravelAuditCsv(): Promise<string> {
  const response = await fetch("/api/travel/reports/audit", {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Unable to export travel audit report.");
  }
  return response.text();
}

interface PolicySimulationInput {
  employeeGrade: EmployeeGrade;
  tripType: TripType;
  departureDate: string;
  returnDate: string;
  travelClass: TravelClass;
  estimatedCost: number;
  currency: string;
  policyVersionId?: string;
}

export async function simulateTravelPolicy(
  input: PolicySimulationInput,
): Promise<TravelPolicyEvaluation> {
  const response = await fetch("/api/travel/policy/simulate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  return parseApiResponse<TravelPolicyEvaluation>(
    response,
    "Unable to simulate travel policy.",
  );
}

export async function fetchTravelPolicyVersionsApi(): Promise<TravelPolicyVersionRecord[]> {
  const response = await fetch("/api/travel/policy/versions", {
    method: "GET",
    cache: "no-store",
  });
  return parseApiResponse<TravelPolicyVersionRecord[]>(
    response,
    "Unable to fetch travel policy versions.",
  );
}

export async function fetchActiveTravelPolicyVersionApi(): Promise<TravelPolicyVersionRecord> {
  const response = await fetch("/api/travel/policy/active", {
    method: "GET",
    cache: "no-store",
  });
  return parseApiResponse<TravelPolicyVersionRecord>(
    response,
    "Unable to fetch active travel policy.",
  );
}

export async function createTravelPolicyDraftApi(
  payload: CreatePolicyDraftPayload,
): Promise<TravelPolicyVersionRecord> {
  const response = await fetch("/api/travel/policy/versions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseApiResponse<TravelPolicyVersionRecord>(
    response,
    "Unable to create policy draft.",
  );
}

export async function activateTravelPolicyVersionApi(
  payload: ActivatePolicyVersionPayload,
): Promise<TravelPolicyVersionRecord> {
  const response = await fetch(`/api/travel/policy/versions/${payload.versionId}/activate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      effectiveFrom: payload.effectiveFrom,
      note: payload.note,
    }),
  });

  return parseApiResponse<TravelPolicyVersionRecord>(
    response,
    "Unable to activate policy version.",
  );
}
