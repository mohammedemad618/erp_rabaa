import assert from "node:assert/strict";
import test from "node:test";
import type { TravelActorRole } from "../modules/travel/types";
import {
  applyTravelRequestTransition,
  createTravelRequest,
  getTravelTripClosureReadiness,
  listTravelRequests,
  reviewTravelExpense,
  submitTravelExpense,
  syncTravelFinance,
  upsertTravelBooking,
} from "../services/travel-request-store";
import { listTransactions } from "../services/transaction-store";
import { buildAccountingDataset } from "../modules/accounting/services/accounting-dataset";
import { buildTravelInsights } from "../modules/travel/services/travel-insights";
import { buildTreasuryDataset } from "../modules/treasury/services/treasury-dataset";
import { getServiceCategoryBookingCounts } from "../modules/services/service-category-usage";
import { runMongoCommand } from "../lib/mongo-helper";
import { calculateNormalizedTotal } from "../utils/pricing";

type MaybePromise<T> = T | Promise<T>;

async function withMockedNow<T>(isoTimestamp: string, run: () => MaybePromise<T>): Promise<T> {
  const RealDate = Date;
  const fixedDate = new RealDate(isoTimestamp);

  class MockDate extends RealDate {
    constructor(...args: ConstructorParameters<typeof RealDate>) {
      if (args.length === 0) {
        super(fixedDate.toISOString());
        return;
      }
      super(...args);
    }

    static now(): number {
      return fixedDate.getTime();
    }
  }

  // Override global time source for deterministic workflow checks.
  globalThis.Date = MockDate as unknown as DateConstructor;
  try {
    return await run();
  } finally {
    globalThis.Date = RealDate;
  }
}

function addDays(isoTimestamp: string, days: number): string {
  const next = new Date(isoTimestamp);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

function assertCreateSuccess(
  result: Awaited<ReturnType<typeof createTravelRequest>>,
): { requestId: string; employeeName: string; departureDate: string; returnDate: string } {
  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return {
    requestId: result.result.id,
    employeeName: result.result.employeeName,
    departureDate: result.result.departureDate,
    returnDate: result.result.returnDate,
  };
}

async function applyTransitionOrThrow(
  requestId: string,
  transitionId:
    | "submit_request"
    | "approve_manager"
    | "start_travel_review"
    | "approve_finance"
    | "confirm_booking",
  actorRole: TravelActorRole,
  actorName: string,
): Promise<void> {
  const result = await applyTravelRequestTransition({
    requestId,
    transitionId,
    actorRole,
    actorName,
  });
  assert.equal(result.ok, true, result.ok ? undefined : result.error.message);
  if (!result.ok) {
    throw new Error(result.error.message);
  }
}

async function createAndBookRequest(nowIso: string): Promise<{
  requestId: string;
  employeeName: string;
  departureDate: string;
  returnDate: string;
}> {
  const created = await createTravelRequest({
    employeeName: `Integration Employee ${Math.random().toString(36).slice(2, 8)}`,
    employeeEmail: "integration.employee@enterprise.local",
    employeeGrade: "manager",
    department: "Operations",
    costCenter: "CC-OPS-009",
    tripType: "domestic",
    origin: "Riyadh",
    destination: "Jeddah",
    departureDate: addDays(nowIso, 5),
    returnDate: addDays(nowIso, 8),
    purpose: "Integration workflow validation",
    travelClass: "economy",
    estimatedCost: 1500,
    currency: "SAR",
    actorRole: "employee",
    actorName: "Integration Employee",
  });

  const seed = assertCreateSuccess(created);
  await applyTransitionOrThrow(seed.requestId, "submit_request", "employee", seed.employeeName);
  await applyTransitionOrThrow(seed.requestId, "approve_manager", "manager", "Integration Manager");
  await applyTransitionOrThrow(seed.requestId, "start_travel_review", "travel_desk", "Travel Desk User");
  await applyTransitionOrThrow(seed.requestId, "approve_finance", "finance", "Finance User");
  await applyTransitionOrThrow(seed.requestId, "confirm_booking", "travel_desk", "Travel Desk User");

  const bookingResult = await upsertTravelBooking({
    requestId: seed.requestId,
    actorRole: "travel_desk",
    actorName: "Travel Desk User",
    vendor: "Integration Vendor",
    bookingReference: `BK-${seed.requestId}`,
    ticketNumber: `ETKT-${seed.requestId}`,
    bookedAt: addDays(nowIso, 5),
    totalBookedCost: 1400,
    currency: "SAR",
  });
  assert.equal(bookingResult.ok, true, bookingResult.ok ? undefined : bookingResult.error.message);
  if (!bookingResult.ok) {
    throw new Error(bookingResult.error.message);
  }

  return seed;
}

test("closure readiness stays blocked when trip return date has not passed", async () => {
  const startNow = "2030-01-01T09:00:00.000Z";
  const scenario = await withMockedNow(startNow, () => createAndBookRequest(startNow));

  const readinessResult = await withMockedNow(startNow, () =>
    getTravelTripClosureReadiness(scenario.requestId),
  );
  assert.equal(readinessResult.ok, true, readinessResult.ok ? undefined : readinessResult.error.message);
  if (!readinessResult.ok) {
    throw new Error(readinessResult.error.message);
  }

  assert.equal(readinessResult.result.readiness.ready, false);
  const tripCheck = readinessResult.result.readiness.checks.find(
    (check) => check.code === "trip_completed",
  );
  assert.ok(tripCheck);
  assert.equal(tripCheck.passed, false);
});

test("listTravelRequests tolerates legacy null policyEvaluation records", async () => {
  const nowIso = "2030-06-01T09:00:00.000Z";
  const created = await withMockedNow(nowIso, () =>
    createTravelRequest({
      employeeName: `Integration Employee ${Math.random().toString(36).slice(2, 8)}`,
      employeeEmail: "integration.employee@enterprise.local",
      employeeGrade: "staff",
      department: "Operations",
      costCenter: "CC-OPS-LEGACY",
      tripType: "domestic",
      origin: "Riyadh",
      destination: "Dammam",
      departureDate: addDays(nowIso, 3),
      returnDate: addDays(nowIso, 5),
      purpose: "Legacy policy-evaluation compatibility test",
      travelClass: "economy",
      estimatedCost: 900,
      currency: "SAR",
      actorRole: "employee",
      actorName: "Integration Employee",
    }),
  );
  const seed = assertCreateSuccess(created);

  await runMongoCommand("travel_requests", "update", {
    updates: [
      {
        q: { _id: seed.requestId },
        u: { $set: { policyEvaluation: null } },
        multi: false,
      },
    ],
  });

  const requests = await listTravelRequests();
  const target = requests.find((request) => request.id === seed.requestId);
  assert.ok(target, "Expected request to remain readable even when policyEvaluation is null.");
  if (!target) {
    return;
  }
  assert.equal(typeof target.policyEvaluation.policyVersion, "string");
  assert.ok(target.policyEvaluation.findings.length > 0);
});

test("pricing engine normalizes multi-currency services into target currency", () => {
  const result = calculateNormalizedTotal(
    [
      { cost: 200, currency: "SAR" },
      { cost: 50, currency: "USD" },
      { cost: 10, currency: "UNKNOWN" },
    ],
    { targetCurrency: "SAR" },
  );

  assert.equal(result.targetCurrency, "SAR");
  assert.equal(result.total, 387.5);
  assert.equal(result.convertedCount, 2);
  assert.equal(result.skippedCount, 1);
});

test("close_trip is rejected when pending expenses still exist", async () => {
  const startNow = "2031-01-01T09:00:00.000Z";
  const scenario = await withMockedNow(startNow, () => createAndBookRequest(startNow));

  const submitExpenseResult = await withMockedNow(addDays(startNow, 6), () =>
    submitTravelExpense({
      requestId: scenario.requestId,
      actorRole: "employee",
      actorName: scenario.employeeName,
      category: "hotel",
      amount: 800,
      currency: "SAR",
      expenseDate: addDays(startNow, 6),
      merchant: "Hotel Integration",
      description: "Hotel for integration test",
      receiptFileName: "hotel.pdf",
      receiptMimeType: "application/pdf",
      receiptSizeInBytes: 2048,
    }),
  );
  assert.equal(
    submitExpenseResult.ok,
    true,
    submitExpenseResult.ok ? undefined : submitExpenseResult.error.message,
  );

  const closeResult = await withMockedNow(addDays(startNow, 12), () =>
    applyTravelRequestTransition({
      requestId: scenario.requestId,
      transitionId: "close_trip",
      actorRole: "finance",
      actorName: "Finance User",
    }),
  );

  assert.equal(closeResult.ok, false);
  if (closeResult.ok) {
    throw new Error("close_trip unexpectedly succeeded.");
  }
  assert.equal(closeResult.error.code, "transition_not_allowed");
  assert.match(closeResult.error.message, /pending expense/i);
});

test("close_trip succeeds after expense approval and ERP sync, and persists closure summary", async () => {
  const startNow = "2032-01-01T09:00:00.000Z";
  const scenario = await withMockedNow(startNow, () => createAndBookRequest(startNow));

  const submitExpenseResult = await withMockedNow(addDays(startNow, 6), () =>
    submitTravelExpense({
      requestId: scenario.requestId,
      actorRole: "employee",
      actorName: scenario.employeeName,
      category: "hotel",
      amount: 1200,
      currency: "SAR",
      expenseDate: addDays(startNow, 6),
      merchant: "Hotel Integration",
      description: "Approved expense for closure flow",
      receiptFileName: "approved-receipt.pdf",
      receiptMimeType: "application/pdf",
      receiptSizeInBytes: 3024,
    }),
  );
  assert.equal(
    submitExpenseResult.ok,
    true,
    submitExpenseResult.ok ? undefined : submitExpenseResult.error.message,
  );
  if (!submitExpenseResult.ok) {
    throw new Error(submitExpenseResult.error.message);
  }

  const reviewResult = await withMockedNow(addDays(startNow, 7), () =>
    reviewTravelExpense({
      requestId: scenario.requestId,
      expenseId: submitExpenseResult.result.expense.id,
      actorRole: "finance",
      actorName: "Finance User",
      decision: "approve",
    }),
  );
  assert.equal(reviewResult.ok, true, reviewResult.ok ? undefined : reviewResult.error.message);

  const syncResult = await withMockedNow(addDays(startNow, 8), () =>
    syncTravelFinance({
      requestId: scenario.requestId,
      actorRole: "finance",
      actorName: "Finance User",
    }),
  );
  assert.equal(syncResult.ok, true, syncResult.ok ? undefined : syncResult.error.message);

  const closeResult = await withMockedNow(addDays(startNow, 12), () =>
    applyTravelRequestTransition({
      requestId: scenario.requestId,
      transitionId: "close_trip",
      actorRole: "finance",
      actorName: "Finance User",
      note: "Closed by integration test after full settlement.",
    }),
  );
  assert.equal(closeResult.ok, true, closeResult.ok ? undefined : closeResult.error.message);
  if (!closeResult.ok) {
    throw new Error(closeResult.error.message);
  }

  const closedRequest = closeResult.result.request;
  assert.equal(closeResult.result.toStatus, "closed");
  assert.ok(closedRequest.closure);
  assert.equal(closedRequest.closure.totalExpenses, 1);
  assert.equal(closedRequest.closure.totalApprovedAmount, 1200);
  assert.equal(closedRequest.closure.totalSettledAmount, 1200);
  assert.equal(closedRequest.closure.financeAttemptCount >= 1, true);
  assert.ok(closedRequest.closure.financeBatchId);
  assert.match(closedRequest.closure.closedBy, /Finance User/i);
});

test("finance sync rejects unauthorized role", async () => {
  const startNow = "2033-01-01T09:00:00.000Z";
  const scenario = await withMockedNow(startNow, () => createAndBookRequest(startNow));

  const submitExpenseResult = await withMockedNow(addDays(startNow, 6), () =>
    submitTravelExpense({
      requestId: scenario.requestId,
      actorRole: "employee",
      actorName: scenario.employeeName,
      category: "meals",
      amount: 350,
      currency: "SAR",
      expenseDate: addDays(startNow, 6),
      merchant: "Integration Cafe",
      description: "Security test expense",
      receiptFileName: "meal-receipt.pdf",
      receiptMimeType: "application/pdf",
      receiptSizeInBytes: 1024,
    }),
  );
  assert.equal(
    submitExpenseResult.ok,
    true,
    submitExpenseResult.ok ? undefined : submitExpenseResult.error.message,
  );
  if (!submitExpenseResult.ok) {
    throw new Error(submitExpenseResult.error.message);
  }

  const reviewResult = await withMockedNow(addDays(startNow, 7), () =>
    reviewTravelExpense({
      requestId: scenario.requestId,
      expenseId: submitExpenseResult.result.expense.id,
      actorRole: "finance",
      actorName: "Finance User",
      decision: "approve",
    }),
  );
  assert.equal(reviewResult.ok, true, reviewResult.ok ? undefined : reviewResult.error.message);

  const unauthorizedSync = await withMockedNow(addDays(startNow, 8), () =>
    syncTravelFinance({
      requestId: scenario.requestId,
      actorRole: "employee",
      actorName: scenario.employeeName,
    }),
  );
  assert.equal(unauthorizedSync.ok, false);
  if (unauthorizedSync.ok) {
    throw new Error("Unauthorized sync unexpectedly succeeded.");
  }
  assert.equal(unauthorizedSync.error.code, "role_not_allowed");
});

test("booking update rejects unauthorized role", async () => {
  const startNow = "2034-01-01T09:00:00.000Z";
  const scenario = await withMockedNow(startNow, () => createAndBookRequest(startNow));

  const unauthorizedBooking = await withMockedNow(addDays(startNow, 5), () =>
    upsertTravelBooking({
      requestId: scenario.requestId,
      actorRole: "employee",
      actorName: scenario.employeeName,
      vendor: "Unauthorized Vendor",
      bookingReference: "UNAUTH-BK-001",
      ticketNumber: "UNAUTH-TKT-001",
      bookedAt: addDays(startNow, 5),
      totalBookedCost: 1300,
      currency: "SAR",
    }),
  );

  assert.equal(unauthorizedBooking.ok, false);
  if (unauthorizedBooking.ok) {
    throw new Error("Unauthorized booking update unexpectedly succeeded.");
  }
  assert.equal(unauthorizedBooking.error.code, "role_not_allowed");
});

test("expense rejection requires a note for auditability", async () => {
  const startNow = "2035-01-01T09:00:00.000Z";
  const scenario = await withMockedNow(startNow, () => createAndBookRequest(startNow));

  const submitExpenseResult = await withMockedNow(addDays(startNow, 6), () =>
    submitTravelExpense({
      requestId: scenario.requestId,
      actorRole: "employee",
      actorName: scenario.employeeName,
      category: "hotel",
      amount: 900,
      currency: "SAR",
      expenseDate: addDays(startNow, 6),
      merchant: "Auditability Hotel",
      description: "Expense to validate rejection note requirement",
      receiptFileName: "auditability-receipt.pdf",
      receiptMimeType: "application/pdf",
      receiptSizeInBytes: 2048,
    }),
  );
  assert.equal(
    submitExpenseResult.ok,
    true,
    submitExpenseResult.ok ? undefined : submitExpenseResult.error.message,
  );
  if (!submitExpenseResult.ok) {
    throw new Error(submitExpenseResult.error.message);
  }

  const rejectWithoutNote = await withMockedNow(addDays(startNow, 7), () =>
    reviewTravelExpense({
      requestId: scenario.requestId,
      expenseId: submitExpenseResult.result.expense.id,
      actorRole: "finance",
      actorName: "Finance User",
      decision: "reject",
    }),
  );

  assert.equal(rejectWithoutNote.ok, false);
  if (rejectWithoutNote.ok) {
    throw new Error("Expense rejection without note unexpectedly succeeded.");
  }
  assert.equal(rejectWithoutNote.error.code, "note_required");
});

test("booked travel request creates a pending financial transaction", async () => {
  const startNow = "2035-06-01T09:00:00.000Z";
  const scenario = await withMockedNow(startNow, () => createAndBookRequest(startNow));

  const transactions = await listTransactions();
  const posting = transactions.find((transaction) => transaction.id === `TRVTX-${scenario.requestId}`);

  assert.ok(posting, "Expected booked travel request to create a mirrored finance transaction.");
  if (!posting) {
    return;
  }
  assert.equal(posting.status, "pending_payment");
  assert.equal(posting.paymentMethod, "bank");
  assert.ok(posting.totalAmount > 0);
});

test("booked travel request is reflected in accounting and treasury datasets", async () => {
  const startNow = "2035-07-01T09:00:00.000Z";
  const scenario = await withMockedNow(startNow, () => createAndBookRequest(startNow));
  const transactionId = `TRVTX-${scenario.requestId}`;

  const transactions = await listTransactions();
  const accountingDataset = buildAccountingDataset(transactions);
  const treasuryDataset = buildTreasuryDataset(transactions);

  assert.ok(
    accountingDataset.journalRows.some((row) => row.reference === transactionId),
    "Expected booked travel request posting to appear in accounting journal rows.",
  );
  assert.ok(
    treasuryDataset.systemBankRows.some((row) => row.reference === transactionId),
    "Expected booked travel request posting to appear in treasury system bank rows.",
  );
});

test("confirm_booking creates finance posting even before booking details are saved", async () => {
  const startNow = "2035-08-01T09:00:00.000Z";
  const created = await withMockedNow(startNow, () =>
    createTravelRequest({
      employeeName: `Integration Employee ${Math.random().toString(36).slice(2, 8)}`,
      employeeEmail: "integration.employee@enterprise.local",
      employeeGrade: "manager",
      department: "Operations",
      costCenter: "CC-OPS-010",
      tripType: "domestic",
      origin: "Riyadh",
      destination: "Jeddah",
      departureDate: addDays(startNow, 4),
      returnDate: addDays(startNow, 7),
      purpose: "Booked-state finance bridge validation",
      travelClass: "economy",
      estimatedCost: 1800,
      currency: "SAR",
      actorRole: "employee",
      actorName: "Integration Employee",
    }),
  );

  const seed = assertCreateSuccess(created);
  await applyTransitionOrThrow(seed.requestId, "submit_request", "employee", seed.employeeName);
  await applyTransitionOrThrow(seed.requestId, "approve_manager", "manager", "Integration Manager");
  await applyTransitionOrThrow(seed.requestId, "start_travel_review", "travel_desk", "Travel Desk User");
  await applyTransitionOrThrow(seed.requestId, "approve_finance", "finance", "Finance User");
  await applyTransitionOrThrow(seed.requestId, "confirm_booking", "travel_desk", "Travel Desk User");

  const transactions = await listTransactions();
  const posting = transactions.find((transaction) => transaction.id === `TRVTX-${seed.requestId}`);

  assert.ok(
    posting,
    "Expected confirm_booking transition to create finance posting without explicit booking details.",
  );
  if (!posting) {
    return;
  }
  assert.equal(posting.status, "pending_payment");
  assert.equal(posting.paymentMethod, "bank");
  assert.equal(posting.totalAmount, 1800);
});

test("service category counters include linked service bookings for booked requests", async () => {
  const startNow = "2035-09-01T09:00:00.000Z";
  const before = await getServiceCategoryBookingCounts();

  const created = await withMockedNow(startNow, () =>
    createTravelRequest({
      employeeName: `Integration Employee ${Math.random().toString(36).slice(2, 8)}`,
      employeeEmail: "integration.employee@enterprise.local",
      employeeGrade: "manager",
      department: "Operations",
      costCenter: "CC-OPS-SVC",
      tripType: "domestic",
      origin: "Riyadh",
      destination: "Abha",
      departureDate: addDays(startNow, 3),
      returnDate: addDays(startNow, 6),
      purpose: "Service category usage integration test",
      travelClass: "economy",
      estimatedCost: 2100,
      currency: "SAR",
      linkedServiceBookingIds: ["HTL-COUNTER-001", "VIS-COUNTER-001"],
      actorRole: "employee",
      actorName: "Integration Employee",
    }),
  );

  const seed = assertCreateSuccess(created);
  await applyTransitionOrThrow(seed.requestId, "submit_request", "employee", seed.employeeName);
  await applyTransitionOrThrow(seed.requestId, "approve_manager", "manager", "Integration Manager");
  await applyTransitionOrThrow(seed.requestId, "start_travel_review", "travel_desk", "Travel Desk User");
  await applyTransitionOrThrow(seed.requestId, "approve_finance", "finance", "Finance User");
  await applyTransitionOrThrow(seed.requestId, "confirm_booking", "travel_desk", "Travel Desk User");

  const after = await getServiceCategoryBookingCounts();
  assert.ok(
    (after.hotel ?? 0) >= (before.hotel ?? 0) + 1,
    "Expected hotel category booking counter to increase for booked linked services.",
  );
  assert.ok(
    (after.visa ?? 0) >= (before.visa ?? 0) + 1,
    "Expected visa category booking counter to increase for booked linked services.",
  );
});

test("insights generation stays within acceptable performance envelope", async () => {
  const requests = await listTravelRequests();
  const now = new Date("2036-01-01T09:00:00.000Z");
  const startedAt = performance.now();
  for (let index = 0; index < 400; index += 1) {
    const snapshot = buildTravelInsights(requests, now);
    assert.equal(typeof snapshot.totalRequests, "number");
  }
  const elapsedMs = performance.now() - startedAt;
  assert.ok(
    elapsedMs < 3000,
    `Expected 400 insights computations < 3000ms, received ${elapsedMs.toFixed(2)}ms.`,
  );
});
