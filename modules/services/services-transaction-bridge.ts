import type { Transaction, AccountingLine, ApprovalStep } from "@/modules/transactions/types";
import type { AnyServiceBooking, ServiceCategory } from "./types";
import { listBookings } from "./services-store";

const SERVICE_AIRLINE_MAP: Record<ServiceCategory, string> = {
  hotel: "Hotel Services",
  car_rental: "Car Rental",
  visa: "Visa Services",
  insurance: "Travel Insurance",
  tour: "Tour Packages",
  transfer: "Transfer Services",
};

const STATUS_MAP: Record<string, Transaction["status"]> = {
  pending: "pending_approval",
  confirmed: "approved",
  in_progress: "pending_payment",
  completed: "paid",
  cancelled: "voided",
  refunded: "refunded",
};

function buildServiceAccountingLines(
  salesAmount: number,
  taxAmount: number,
  currency: string,
  category: ServiceCategory,
): AccountingLine[] {
  const revenueAccount: Record<ServiceCategory, string> = {
    hotel: "Hotel Revenue",
    car_rental: "Car Rental Revenue",
    visa: "Visa Service Revenue",
    insurance: "Insurance Commission",
    tour: "Tour Package Revenue",
    transfer: "Transfer Revenue",
  };

  return [
    { id: "l1", side: "debit", account: "Cash", amount: salesAmount + taxAmount, currency },
    { id: "l2", side: "credit", account: revenueAccount[category], amount: salesAmount, currency },
    { id: "l3", side: "credit", account: "Tax Payable", amount: taxAmount, currency },
  ];
}

function buildServiceApprovalTimeline(status: string, at: string): ApprovalStep[] {
  const isComplete = status === "confirmed" || status === "completed" || status === "paid";
  return [
    { id: "s1", actor: "Booking System", status: "approved", at, note: "Service booking created" },
    { id: "s2", actor: "Service Coordinator", status: isComplete ? "approved" : "pending", at, note: "Service confirmation" },
    { id: "s3", actor: "Finance Manager", status: status === "refunded" ? "approved" : "pending", at, note: "Payment reconciliation" },
  ];
}

function bookingToTransaction(booking: AnyServiceBooking, index: number): Transaction {
  const txStatus = STATUS_MAP[booking.status] ?? "draft";
  const salesAmount = Math.round(booking.totalAmount * 0.85);
  const taxAmount = booking.totalAmount - salesAmount;

  return {
    id: `SVC-${booking.id}`,
    pnr: booking.id,
    ticketNumber: `SVC${booking.id.replace(/[^0-9]/g, "").padStart(10, "0")}`,
    customerName: booking.customerName,
    customerPhone: booking.customerPhone,
    airline: SERVICE_AIRLINE_MAP[booking.category],
    branch: index % 2 === 0 ? "Riyadh HQ" : "Jeddah Branch",
    salesAmount,
    taxAmount,
    totalAmount: booking.totalAmount,
    currency: booking.currency,
    paymentMethod: index % 3 === 0 ? "cash" : index % 3 === 1 ? "card" : "bank",
    status: txStatus,
    approvalState:
      txStatus === "pending_approval"
        ? "pending"
        : txStatus === "voided"
        ? "rejected"
        : txStatus === "draft"
        ? "not_required"
        : "approved",
    agent: "Service Desk",
    createdAt: booking.createdAt,
    issuedAt: booking.createdAt,
    accountingPreview: buildServiceAccountingLines(salesAmount, taxAmount, booking.currency, booking.category),
    approvalTimeline: buildServiceApprovalTimeline(booking.status, booking.createdAt),
    auditMetadata: {
      createdBy: "Service Desk",
      createdAt: booking.createdAt,
      updatedBy: "Service Desk",
      updatedAt: booking.updatedAt,
      version: 1,
    },
  };
}

export function getServiceTransactions(): Transaction[] {
  const bookings = listBookings();
  return bookings.map((b, i) => bookingToTransaction(b, i));
}
