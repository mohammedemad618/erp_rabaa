import type { Transaction } from "@/modules/transactions/types";
import type { HourBucket, ReportTransactionRow, ReportingDataset } from "../types";

const REFUND_STATUSES = new Set(["refunded", "voided"]);
const OUTSTANDING_STATUSES = new Set([
  "pending_approval",
  "approved",
  "pending_payment",
]);

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toHourBucket(dateIso: string): HourBucket {
  const hour = new Date(dateIso).getUTCHours();
  if (hour <= 5) {
    return "00_05";
  }
  if (hour <= 11) {
    return "06_11";
  }
  if (hour <= 17) {
    return "12_17";
  }
  return "18_23";
}

function costFactor(paymentMethod: Transaction["paymentMethod"]): number {
  if (paymentMethod === "cash") {
    return 0.83;
  }
  if (paymentMethod === "card") {
    return 0.8;
  }
  return 0.78;
}

function toRow(transaction: Transaction): ReportTransactionRow {
  const refunded = REFUND_STATUSES.has(transaction.status);
  const sign = refunded ? -1 : 1;
  const revenueSigned = roundMoney(sign * transaction.salesAmount);
  const costSigned = roundMoney(revenueSigned * costFactor(transaction.paymentMethod));
  const grossSigned = roundMoney(sign * transaction.totalAmount);
  const marginSigned = roundMoney(revenueSigned - costSigned);

  return {
    id: `rep-${transaction.id}`,
    transactionId: transaction.id,
    date: transaction.createdAt,
    dayKey: transaction.createdAt.slice(0, 10),
    weekday: new Date(transaction.createdAt).getUTCDay(),
    hourBucket: toHourBucket(transaction.createdAt),
    airline: transaction.airline,
    agent: transaction.agent,
    branch: transaction.branch,
    status: transaction.status,
    paymentMethod: transaction.paymentMethod,
    grossSigned,
    revenueSigned,
    costSigned,
    marginSigned,
    outstanding: OUTSTANDING_STATUSES.has(transaction.status),
    refunded,
  };
}

export function buildReportingDataset(transactions: Transaction[]): ReportingDataset {
  const rows = transactions.map(toRow).sort((a, b) => a.date.localeCompare(b.date));
  const min = rows[0]?.date ?? new Date().toISOString();
  const max = rows[rows.length - 1]?.date ?? min;

  return {
    rows,
    branches: Array.from(new Set(rows.map((row) => row.branch))).sort((a, b) =>
      a.localeCompare(b),
    ),
    airlines: Array.from(new Set(rows.map((row) => row.airline))).sort((a, b) =>
      a.localeCompare(b),
    ),
    agents: Array.from(new Set(rows.map((row) => row.agent))).sort((a, b) =>
      a.localeCompare(b),
    ),
    dateBounds: { min, max },
  };
}
