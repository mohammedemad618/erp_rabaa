import { evaluateTravelPolicy } from "@/modules/travel/policy/travel-policy-engine";
import type {
  CreateTravelRequestInput,
  TravelExpenseClaim,
  TravelActorRole,
  TravelAuditEvent,
  TravelRequest,
} from "@/modules/travel/types";
import {
  applyTransitionToApprovalRoute,
  buildInitialApprovalRoute,
  getTravelTransitionOption,
  type TravelTransitionId,
} from "@/modules/travel/workflow/travel-approval-engine";

interface SeedTransition {
  id: TravelTransitionId;
  actorRole: TravelActorRole;
  actorName: string;
  note?: string;
}

interface RequestSeed extends Omit<CreateTravelRequestInput, "departureDate" | "returnDate"> {
  id: string;
  createdOffsetDays: number;
  departureOffsetDays: number;
  returnOffsetDays: number;
  transitions: SeedTransition[];
}

const BASE_DATE = new Date("2026-02-20T09:00:00.000Z");

function atDayOffset(dayOffset: number, hour = 9): string {
  const date = new Date(BASE_DATE);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function createAuditEvent(
  requestId: string,
  index: number,
  at: string,
  actorRole: TravelActorRole,
  actorName: string,
  action: string,
  toStatus: TravelRequest["status"],
  fromStatus: TravelRequest["status"] | null,
  note?: string,
): TravelAuditEvent {
  return {
    id: `${requestId}-AUD-${String(index).padStart(3, "0")}`,
    at,
    actorRole,
    actorName,
    action,
    fromStatus,
    toStatus,
    note,
  };
}

function initialFinanceSyncState(): TravelRequest["financeSync"] {
  return {
    status: "not_synced",
    attemptCount: 0,
    ledgerLines: [],
  };
}

function buildSeedExpense(request: TravelRequest, nowAt: string): TravelExpenseClaim {
  return {
    id: `${request.id}-EXP-001`,
    category: "hotel",
    amount: Math.round(request.estimatedCost * 0.28 * 100) / 100,
    currency: request.currency,
    expenseDate: nowAt,
    merchant: "Enterprise Hotel Group",
    description: "Hotel stay for business trip",
    status: "submitted",
    submittedBy: request.employeeName,
    submittedAt: nowAt,
    receipt: {
      fileName: `${request.id.toLowerCase()}-hotel-receipt.pdf`,
      mimeType: "application/pdf",
      sizeInBytes: 248120,
      uploadedAt: nowAt,
    },
  };
}

function buildRequestFromSeed(seed: RequestSeed): TravelRequest {
  const createdAt = atDayOffset(seed.createdOffsetDays, 9);
  const departureDate = atDayOffset(seed.departureOffsetDays, 8);
  const returnDate = atDayOffset(seed.returnOffsetDays, 20);
  const policyEvaluation = evaluateTravelPolicy({
    employeeGrade: seed.employeeGrade,
    tripType: seed.tripType,
    departureDate,
    returnDate,
    travelClass: seed.travelClass,
    estimatedCost: seed.estimatedCost,
    currency: seed.currency,
    now: new Date(createdAt),
  });

  let request: TravelRequest = {
    id: seed.id,
    employeeName: seed.employeeName,
    employeeEmail: seed.employeeEmail,
    employeeGrade: seed.employeeGrade,
    department: seed.department,
    costCenter: seed.costCenter,
    tripType: seed.tripType,
    origin: seed.origin,
    destination: seed.destination,
    departureDate,
    returnDate,
    purpose: seed.purpose,
    travelClass: seed.travelClass,
    estimatedCost: seed.estimatedCost,
    currency: seed.currency,
    status: "draft",
    approvalRoute: buildInitialApprovalRoute(),
    policyEvaluation,
    booking: null,
    expenses: [],
    financeSync: initialFinanceSyncState(),
    closure: null,
    createdAt,
    updatedAt: createdAt,
    createdBy: seed.employeeName,
    updatedBy: seed.employeeName,
    version: 1,
    auditTrail: [
      createAuditEvent(
        seed.id,
        1,
        createdAt,
        "employee",
        seed.employeeName,
        "create_request",
        "draft",
        null,
        "Request created as draft.",
      ),
    ],
  };

  let auditIndex = request.auditTrail.length + 1;

  seed.transitions.forEach((transition, transitionIndex) => {
    const option = getTravelTransitionOption(transition.id, {
      request,
      actorRole: transition.actorRole,
    });

    if (!option.allowed) {
      return;
    }

    const transitionTime = new Date(createdAt);
    transitionTime.setHours(transitionTime.getHours() + 2 + transitionIndex * 2);
    const at = transitionTime.toISOString();
    const fromStatus = request.status;
    const toStatus = option.to;

    request = {
      ...request,
      status: toStatus,
      approvalRoute: applyTransitionToApprovalRoute({
        route: request.approvalRoute,
        transitionId: transition.id,
        actorName: transition.actorName,
        at,
        note: transition.note,
      }),
      updatedAt: at,
      updatedBy: transition.actorName,
      version: request.version + 1,
      auditTrail: [
        ...request.auditTrail,
        createAuditEvent(
          seed.id,
          auditIndex++,
          at,
          transition.actorRole,
          transition.actorName,
          transition.id,
          toStatus,
          fromStatus,
          transition.note,
        ),
      ],
    };
  });

  if (request.status === "booked") {
    const bookingAt =
      request.auditTrail.find((event) => event.action === "confirm_booking")?.at ?? request.updatedAt;
    request = {
      ...request,
      booking: {
        vendor: request.tripType === "international" ? "Global Travel GDS" : "Local Travel Hub",
        bookingReference: `BK-${request.id.replace("TRV-", "")}`,
        ticketNumber: `ETKT-${request.id.replace("TRV-", "")}`,
        bookedAt: bookingAt,
        totalBookedCost: Math.round(request.estimatedCost * 0.94 * 100) / 100,
        currency: request.currency,
        bookedBy: "Travel Desk 01",
      },
      expenses: [buildSeedExpense(request, bookingAt)],
    };
  }

  if (request.id === "TRV-1006" && request.expenses.length) {
    const syncAt = atDayOffset(seed.departureOffsetDays + 1, 18);
    const reviewedExpense: TravelExpenseClaim = {
      ...request.expenses[0],
      status: "approved",
      reviewedBy: "Finance Controller",
      reviewedAt: syncAt,
      reviewNote: "Approved under standard travel expense policy.",
      syncedAt: syncAt,
      syncedBatchId: "TRV-BATCH-1006-001",
    };

    request = {
      ...request,
      expenses: [reviewedExpense],
      financeSync: {
        status: "succeeded",
        attemptCount: 1,
        lastAttemptAt: syncAt,
        lastBatchId: "TRV-BATCH-1006-001",
        ledgerLines: [
          {
            id: "TRV-1006-GL-0001",
            expenseId: reviewedExpense.id,
            glAccount: "610200",
            costCenter: request.costCenter,
            amount: reviewedExpense.amount,
            currency: reviewedExpense.currency,
            memo: `${request.id} hotel ${reviewedExpense.merchant}`,
          },
        ],
      },
      updatedAt: syncAt,
      updatedBy: "Finance Controller",
      version: request.version + 1,
      auditTrail: [
        ...request.auditTrail,
        createAuditEvent(
          request.id,
          auditIndex++,
          syncAt,
          "finance",
          "Finance Controller",
          "finance_sync_succeeded",
          request.status,
          request.status,
          "Batch TRV-BATCH-1006-001 synchronized (1 line).",
        ),
      ],
    };

    const closeAt = atDayOffset(seed.returnOffsetDays + 2, 10);
    const totalApprovedAmount = request.expenses
      .filter((expense) => expense.status === "approved")
      .reduce((sum, expense) => sum + expense.amount, 0);
    const totalSettledAmount = request.expenses
      .filter((expense) => expense.status === "approved" && expense.syncedAt)
      .reduce((sum, expense) => sum + expense.amount, 0);
    const roundedApprovedAmount = Math.round(totalApprovedAmount * 100) / 100;
    const roundedSettledAmount = Math.round(totalSettledAmount * 100) / 100;
    const bookedCost = request.booking?.totalBookedCost ?? 0;

    request = {
      ...request,
      status: "closed",
      closure: {
        closedAt: closeAt,
        closedBy: "Finance Controller",
        closureNote: "Trip closed after financial settlement completion.",
        totalExpenses: request.expenses.length,
        totalApprovedAmount: roundedApprovedAmount,
        totalSettledAmount: roundedSettledAmount,
        varianceFromBookedCost: Math.round((roundedSettledAmount - bookedCost) * 100) / 100,
        varianceFromEstimatedCost:
          Math.round((roundedSettledAmount - request.estimatedCost) * 100) / 100,
        financeBatchId: request.financeSync.lastBatchId,
        financeAttemptCount: request.financeSync.attemptCount,
      },
      approvalRoute: request.approvalRoute.map((step) =>
        step.id === "settlement_closure"
          ? {
              ...step,
              status: "approved",
              actorName: "Finance Controller",
              actedAt: closeAt,
              note: "Trip closed after successful financial settlement.",
            }
          : step,
      ),
      updatedAt: closeAt,
      updatedBy: "Finance Controller",
      version: request.version + 1,
      auditTrail: [
        ...request.auditTrail,
        createAuditEvent(
          request.id,
          auditIndex++,
          closeAt,
          "finance",
          "Finance Controller",
          "close_trip",
          "closed",
          "booked",
          "Trip closed after financial settlement completion.",
        ),
      ],
    };
  }

  return request;
}

const SEEDS: RequestSeed[] = [
  {
    id: "TRV-1001",
    employeeName: "Aisha Rahman",
    employeeEmail: "aisha.rahman@enterprise.local",
    employeeGrade: "staff",
    department: "Sales",
    costCenter: "CC-SALES-001",
    tripType: "domestic",
    origin: "Riyadh",
    destination: "Jeddah",
    purpose: "Client renewal workshop",
    travelClass: "economy",
    estimatedCost: 1800,
    currency: "SAR",
    createdOffsetDays: -6,
    departureOffsetDays: 5,
    returnOffsetDays: 7,
    transitions: [],
  },
  {
    id: "TRV-1002",
    employeeName: "Omar Nasser",
    employeeEmail: "omar.nasser@enterprise.local",
    employeeGrade: "manager",
    department: "Operations",
    costCenter: "CC-OPS-009",
    tripType: "international",
    origin: "Riyadh",
    destination: "Dubai",
    purpose: "Supplier negotiation meeting",
    travelClass: "premium_economy",
    estimatedCost: 6200,
    currency: "SAR",
    createdOffsetDays: -5,
    departureOffsetDays: 14,
    returnOffsetDays: 18,
    transitions: [
      { id: "submit_request", actorRole: "employee", actorName: "Omar Nasser" },
    ],
  },
  {
    id: "TRV-1003",
    employeeName: "Nour Al-Harbi",
    employeeEmail: "nour.harbi@enterprise.local",
    employeeGrade: "staff",
    department: "Customer Care",
    costCenter: "CC-CUST-014",
    tripType: "domestic",
    origin: "Riyadh",
    destination: "Dammam",
    purpose: "Branch onboarding support",
    travelClass: "economy",
    estimatedCost: 1600,
    currency: "SAR",
    createdOffsetDays: -8,
    departureOffsetDays: 6,
    returnOffsetDays: 8,
    transitions: [
      { id: "submit_request", actorRole: "employee", actorName: "Nour Al-Harbi" },
      { id: "approve_manager", actorRole: "manager", actorName: "Faisal Manager" },
    ],
  },
  {
    id: "TRV-1004",
    employeeName: "Khalid Hassan",
    employeeEmail: "khalid.hassan@enterprise.local",
    employeeGrade: "director",
    department: "Finance",
    costCenter: "CC-FIN-002",
    tripType: "international",
    origin: "Riyadh",
    destination: "Cairo",
    purpose: "Regional budget review",
    travelClass: "business",
    estimatedCost: 10500,
    currency: "SAR",
    createdOffsetDays: -9,
    departureOffsetDays: 12,
    returnOffsetDays: 16,
    transitions: [
      { id: "submit_request", actorRole: "employee", actorName: "Khalid Hassan" },
      { id: "approve_manager", actorRole: "manager", actorName: "Executive Office" },
      {
        id: "start_travel_review",
        actorRole: "travel_desk",
        actorName: "Travel Desk 01",
      },
    ],
  },
  {
    id: "TRV-1005",
    employeeName: "Sara Mostafa",
    employeeEmail: "sara.mostafa@enterprise.local",
    employeeGrade: "manager",
    department: "Marketing",
    costCenter: "CC-MKT-005",
    tripType: "international",
    origin: "Riyadh",
    destination: "Istanbul",
    purpose: "Campaign partner alignment",
    travelClass: "premium_economy",
    estimatedCost: 7400,
    currency: "SAR",
    createdOffsetDays: -10,
    departureOffsetDays: 13,
    returnOffsetDays: 19,
    transitions: [
      { id: "submit_request", actorRole: "employee", actorName: "Sara Mostafa" },
      { id: "approve_manager", actorRole: "manager", actorName: "CPO Office" },
      {
        id: "start_travel_review",
        actorRole: "travel_desk",
        actorName: "Travel Desk 02",
      },
      { id: "approve_finance", actorRole: "finance", actorName: "Finance Controller" },
    ],
  },
  {
    id: "TRV-1006",
    employeeName: "Rami Alsaeed",
    employeeEmail: "rami.alsaeed@enterprise.local",
    employeeGrade: "director",
    department: "Strategy",
    costCenter: "CC-STR-003",
    tripType: "international",
    origin: "Riyadh",
    destination: "London",
    purpose: "Partnership review and board prep",
    travelClass: "business",
    estimatedCost: 13600,
    currency: "SAR",
    createdOffsetDays: -14,
    departureOffsetDays: 10,
    returnOffsetDays: 18,
    transitions: [
      { id: "submit_request", actorRole: "employee", actorName: "Rami Alsaeed" },
      { id: "approve_manager", actorRole: "manager", actorName: "COO Office" },
      {
        id: "start_travel_review",
        actorRole: "travel_desk",
        actorName: "Travel Desk 01",
      },
      { id: "approve_finance", actorRole: "finance", actorName: "Finance Controller" },
      { id: "confirm_booking", actorRole: "travel_desk", actorName: "Travel Desk 01" },
    ],
  },
  {
    id: "TRV-1007",
    employeeName: "Lina Yahya",
    employeeEmail: "lina.yahya@enterprise.local",
    employeeGrade: "staff",
    department: "Support",
    costCenter: "CC-SUP-011",
    tripType: "domestic",
    origin: "Riyadh",
    destination: "Tabuk",
    purpose: "Field support",
    travelClass: "economy",
    estimatedCost: 3200,
    currency: "SAR",
    createdOffsetDays: -7,
    departureOffsetDays: 4,
    returnOffsetDays: 9,
    transitions: [
      { id: "submit_request", actorRole: "employee", actorName: "Lina Yahya" },
      {
        id: "reject_manager",
        actorRole: "manager",
        actorName: "Support Manager",
        note: "Trip timing overlaps with critical on-site support week.",
      },
    ],
  },
  {
    id: "TRV-1008",
    employeeName: "Mahmoud Adel",
    employeeEmail: "mahmoud.adel@enterprise.local",
    employeeGrade: "manager",
    department: "HR",
    costCenter: "CC-HR-004",
    tripType: "international",
    origin: "Riyadh",
    destination: "Amman",
    purpose: "Recruitment event",
    travelClass: "premium_economy",
    estimatedCost: 7100,
    currency: "SAR",
    createdOffsetDays: -8,
    departureOffsetDays: 11,
    returnOffsetDays: 15,
    transitions: [
      { id: "submit_request", actorRole: "employee", actorName: "Mahmoud Adel" },
      { id: "approve_manager", actorRole: "manager", actorName: "HR Director" },
      {
        id: "start_travel_review",
        actorRole: "travel_desk",
        actorName: "Travel Desk 02",
      },
      {
        id: "reject_finance",
        actorRole: "finance",
        actorName: "Finance Controller",
        note: "Budget freeze for this cost center in current quarter.",
      },
    ],
  },
  {
    id: "TRV-1009",
    employeeName: "Dina Saleh",
    employeeEmail: "dina.saleh@enterprise.local",
    employeeGrade: "manager",
    department: "IT",
    costCenter: "CC-IT-013",
    tripType: "international",
    origin: "Riyadh",
    destination: "Berlin",
    purpose: "System integration workshop",
    travelClass: "premium_economy",
    estimatedCost: 6900,
    currency: "SAR",
    createdOffsetDays: -4,
    departureOffsetDays: 17,
    returnOffsetDays: 22,
    transitions: [
      { id: "submit_request", actorRole: "employee", actorName: "Dina Saleh" },
      { id: "approve_manager", actorRole: "manager", actorName: "CTO Office" },
      {
        id: "cancel_request",
        actorRole: "employee",
        actorName: "Dina Saleh",
        note: "Workshop moved to virtual format.",
      },
    ],
  },
  {
    id: "TRV-1010",
    employeeName: "Huda Kareem",
    employeeEmail: "huda.kareem@enterprise.local",
    employeeGrade: "staff",
    department: "Sales",
    costCenter: "CC-SALES-017",
    tripType: "international",
    origin: "Riyadh",
    destination: "Paris",
    purpose: "Emergency customer escalation",
    travelClass: "business",
    estimatedCost: 9800,
    currency: "SAR",
    createdOffsetDays: -2,
    departureOffsetDays: 1,
    returnOffsetDays: 6,
    transitions: [],
  },
];

export function generateMockTravelRequests(): TravelRequest[] {
  return SEEDS.map((seed) => buildRequestFromSeed(seed)).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}
