import type { Transaction } from "@/modules/transactions/types";
import type {
  CrmDataset,
  CustomerProfile,
  CustomerRiskLevel,
  CustomerSegment,
} from "../types";

const OPEN_STATUSES = new Set(["pending_approval", "approved", "pending_payment"]);
const PAID_STATUSES = new Set(["paid", "receipt_issued"]);
const REFUNDED_STATUSES = new Set(["refunded", "voided"]);

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildCreditLimit(name: string): number {
  return 12000 + (hashString(name) % 26000);
}

function determineSegment(totalSales: number): CustomerSegment {
  if (totalSales >= 36000) {
    return "strategic";
  }
  if (totalSales >= 15000) {
    return "growth";
  }
  return "starter";
}

function determineRisk(utilization: number): CustomerRiskLevel {
  if (utilization >= 90) {
    return "high";
  }
  if (utilization >= 70) {
    return "medium";
  }
  return "low";
}

function preferredAirline(transactions: Transaction[]): string {
  const counter = new Map<string, number>();
  for (const transaction of transactions) {
    counter.set(
      transaction.airline,
      (counter.get(transaction.airline) ?? 0) + 1,
    );
  }
  return (
    Array.from(counter.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-"
  );
}

function buildAging(
  transactions: Transaction[],
  referenceDateMs: number,
): CustomerProfile["aging"] {
  const buckets = [
    { bucket: "0_30", label: "0-30d", amount: 0, count: 0 },
    { bucket: "31_60", label: "31-60d", amount: 0, count: 0 },
    { bucket: "61_90", label: "61-90d", amount: 0, count: 0 },
    { bucket: "91_plus", label: "91+d", amount: 0, count: 0 },
  ] as CustomerProfile["aging"];

  for (const transaction of transactions) {
    if (!OPEN_STATUSES.has(transaction.status)) {
      continue;
    }
    const ageDays = Math.floor(
      (referenceDateMs - new Date(transaction.createdAt).getTime()) /
        (24 * 60 * 60 * 1000),
    );

    const amount = roundMoney(transaction.totalAmount);

    if (ageDays <= 30) {
      buckets[0].amount = roundMoney(buckets[0].amount + amount);
      buckets[0].count += 1;
      continue;
    }
    if (ageDays <= 60) {
      buckets[1].amount = roundMoney(buckets[1].amount + amount);
      buckets[1].count += 1;
      continue;
    }
    if (ageDays <= 90) {
      buckets[2].amount = roundMoney(buckets[2].amount + amount);
      buckets[2].count += 1;
      continue;
    }

    buckets[3].amount = roundMoney(buckets[3].amount + amount);
    buckets[3].count += 1;
  }

  return buckets;
}

function toCustomerId(name: string, phone: string): string {
  return `CUST-${hashString(`${name}-${phone}`).toString(16).toUpperCase()}`;
}

export function buildCrmDataset(transactions: Transaction[]): CrmDataset {
  const byCustomer = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const key = `${transaction.customerName}||${transaction.customerPhone}`;
    const existing = byCustomer.get(key);
    if (!existing) {
      byCustomer.set(key, [transaction]);
      continue;
    }
    existing.push(transaction);
  }

  const referenceDateMs = transactions.reduce((max, transaction) => {
    return Math.max(max, new Date(transaction.createdAt).getTime());
  }, 0);

  const customers: CustomerProfile[] = Array.from(byCustomer.entries()).map(
    ([key, customerTransactions]) => {
      const [name, phone] = key.split("||");
      const sorted = [...customerTransactions].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );

      const totalSales = roundMoney(
        sorted.reduce((sum, transaction) => sum + transaction.totalAmount, 0),
      );
      const paidAmount = roundMoney(
        sorted
          .filter((transaction) => PAID_STATUSES.has(transaction.status))
          .reduce((sum, transaction) => sum + transaction.totalAmount, 0),
      );
      const outstandingAmount = roundMoney(
        sorted
          .filter((transaction) => OPEN_STATUSES.has(transaction.status))
          .reduce((sum, transaction) => sum + transaction.totalAmount, 0),
      );
      const refundedAmount = roundMoney(
        sorted
          .filter((transaction) => REFUNDED_STATUSES.has(transaction.status))
          .reduce((sum, transaction) => sum + transaction.totalAmount, 0),
      );

      const creditLimit = buildCreditLimit(name);
      const utilization =
        creditLimit > 0
          ? roundMoney((outstandingAmount / creditLimit) * 100)
          : 0;
      const risk = determineRisk(utilization);

      return {
        id: toCustomerId(name, phone),
        name,
        phone,
        preferredAirline: preferredAirline(sorted),
        branches: Array.from(new Set(sorted.map((item) => item.branch))),
        segment: determineSegment(totalSales),
        totalBookings: sorted.length,
        totalSales,
        paidAmount,
        outstandingAmount,
        refundedAmount,
        averageTicket: roundMoney(totalSales / Math.max(sorted.length, 1)),
        lastBookingAt: sorted[0]?.createdAt ?? new Date(referenceDateMs).toISOString(),
        credit: {
          limit: creditLimit,
          exposure: outstandingAmount,
          available: roundMoney(Math.max(0, creditLimit - outstandingAmount)),
          utilization,
          riskLevel: risk,
        },
        aging: buildAging(sorted, referenceDateMs),
        timeline: sorted.map((transaction) => ({
          id: `tl-${transaction.id}`,
          transactionId: transaction.id,
          date: transaction.createdAt,
          ticketNumber: transaction.ticketNumber,
          pnr: transaction.pnr,
          airline: transaction.airline,
          branch: transaction.branch,
          amount: transaction.totalAmount,
          currency: transaction.currency,
          status: transaction.status,
          paymentMethod: transaction.paymentMethod,
          agent: transaction.agent,
        })),
      };
    },
  );

  const sortedCustomers = customers.sort((a, b) => b.totalSales - a.totalSales);
  const totalOutstanding = roundMoney(
    sortedCustomers.reduce((sum, customer) => sum + customer.outstandingAmount, 0),
  );
  const totalSales = roundMoney(
    sortedCustomers.reduce((sum, customer) => sum + customer.totalSales, 0),
  );
  const highRisk = sortedCustomers.filter(
    (customer) => customer.credit.riskLevel === "high",
  ).length;

  return {
    customers: sortedCustomers,
    totals: {
      customers: sortedCustomers.length,
      outstanding: totalOutstanding,
      sales: totalSales,
      highRisk,
    },
  };
}
