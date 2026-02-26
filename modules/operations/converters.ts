import type { Transaction } from "@/modules/transactions/types";
import type { TravelRequest } from "@/modules/travel/types";
import type { AnyServiceBooking } from "@/modules/services/types";
import { calculateNormalizedTotal } from "@/utils/pricing";
import type { OperationsListItem } from "./types";

export function transactionToOperationsItem(tx: Transaction): OperationsListItem {
  return {
    id: tx.id,
    type: "transaction",
    displayId: tx.id,
    customerOrEmployee: tx.customerName,
    amount: tx.totalAmount,
    currency: tx.currency,
    status: tx.status,
    statusDisplayKey: `transactions.statusValues.${tx.status}`,
    createdAt: tx.createdAt,
    raw: tx,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveTravelRequestAmount(
  request: TravelRequest,
  allServiceBookings: readonly AnyServiceBooking[] = [],
): number {
  const persistedServicesCost =
    typeof request.additionalServicesCost === "number" &&
    Number.isFinite(request.additionalServicesCost) &&
    request.additionalServicesCost >= 0
      ? request.additionalServicesCost
      : null;
  const baseEstimatedCost =
    typeof request.baseEstimatedCost === "number" &&
    Number.isFinite(request.baseEstimatedCost) &&
    request.baseEstimatedCost > 0
      ? request.baseEstimatedCost
      : persistedServicesCost !== null
        ? Math.max(0, request.estimatedCost - persistedServicesCost)
      : request.estimatedCost;

  if (persistedServicesCost !== null) {
    return roundMoney(baseEstimatedCost + persistedServicesCost);
  }

  if (!request.linkedServiceBookings.length) {
    return roundMoney(request.estimatedCost);
  }

  const linkedBookingSet = new Set(request.linkedServiceBookings);
  const linkedServices = allServiceBookings.filter((booking) =>
    linkedBookingSet.has(booking.id),
  );
  const additionalServicesCost = calculateNormalizedTotal(
    linkedServices.map((booking) => ({
      cost: booking.totalAmount,
      currency: booking.currency,
    })),
    { targetCurrency: request.currency },
  ).total;

  return roundMoney(baseEstimatedCost + additionalServicesCost);
}

export function travelRequestToOperationsItem(
  req: TravelRequest,
  allServiceBookings: readonly AnyServiceBooking[] = [],
): OperationsListItem {
  return {
    id: req.id,
    type: "travel_request",
    displayId: req.id,
    customerOrEmployee: req.employeeName,
    amount: resolveTravelRequestAmount(req, allServiceBookings),
    currency: req.currency,
    status: req.status,
    statusDisplayKey: `operations.travelStatus.${req.status}`,
    createdAt: req.createdAt,
    raw: req,
  };
}

export function mergeOperationsItems(
  transactions: Transaction[],
  travelRequests: TravelRequest[],
  allServiceBookings: readonly AnyServiceBooking[] = [],
): OperationsListItem[] {
  const txItems = transactions.map(transactionToOperationsItem);
  const travelItems = travelRequests.map((request) =>
    travelRequestToOperationsItem(request, allServiceBookings),
  );
  return [...txItems, ...travelItems].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}
