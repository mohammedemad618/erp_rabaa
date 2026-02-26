import type { Transaction } from "@/modules/transactions/types";
import type { Customer } from "@/modules/customers/types";
import type { AnyServiceBooking } from "@/modules/services/types";
import type { TravelRequest } from "@/modules/travel/types";
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

function normalizeCustomerName(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "").trim();
}

function toCustomerKey(name: string, phone: string): string {
  return `${normalizeCustomerName(name)}||${normalizePhone(phone)}`;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

export function buildCrmDataset(
  transactions: Transaction[],
  serviceBookings: AnyServiceBooking[] = [],
  travelRequests: TravelRequest[] = [],
  knownCustomers: Customer[] = [],
): CrmDataset {
  const byCustomer = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const key = toCustomerKey(transaction.customerName, transaction.customerPhone);
    const existing = byCustomer.get(key);
    if (!existing) {
      byCustomer.set(key, [transaction]);
      continue;
    }
    existing.push(transaction);
  }

  const knownCustomerById = new Map<string, Customer>();
  const knownCustomerByKey = new Map<string, Customer>();
  for (const customer of knownCustomers) {
    knownCustomerById.set(customer.id, customer);
    knownCustomerByKey.set(toCustomerKey(customer.name, customer.phone), customer);
  }

  const servicesByCustomerName = new Map<string, AnyServiceBooking[]>();
  const servicesByCustomerId = new Map<string, AnyServiceBooking[]>();
  for (const booking of serviceBookings) {
    const key = normalizeCustomerName(booking.customerName);
    const existing = servicesByCustomerName.get(key);
    if (!existing) {
      servicesByCustomerName.set(key, [booking]);
    } else {
      existing.push(booking);
    }
    if (booking.customerId) {
      const byId = servicesByCustomerId.get(booking.customerId);
      if (!byId) {
        servicesByCustomerId.set(booking.customerId, [booking]);
      } else {
        byId.push(booking);
      }
    }
  }

  const travelByEmployeeName = new Map<string, TravelRequest[]>();
  const travelByCustomerId = new Map<string, TravelRequest[]>();
  for (const request of travelRequests) {
    const key = normalizeCustomerName(request.employeeName);
    const existing = travelByEmployeeName.get(key);
    if (!existing) {
      travelByEmployeeName.set(key, [request]);
    } else {
      existing.push(request);
    }
    if (request.customerId) {
      const byId = travelByCustomerId.get(request.customerId);
      if (!byId) {
        travelByCustomerId.set(request.customerId, [request]);
      } else {
        byId.push(request);
      }
    }
  }

  const referenceDateMs = transactions.reduce((max, transaction) => {
    return Math.max(max, new Date(transaction.createdAt).getTime());
  }, Date.now());

  const customers: CustomerProfile[] = Array.from(byCustomer.entries()).map(
    ([key, customerTransactions]) => {
      const [normalizedName, normalizedPhone] = key.split("||");
      const matchedKnownCustomer = knownCustomerByKey.get(key);
      const sorted = [...customerTransactions].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      );
      const name =
        matchedKnownCustomer?.name ??
        sorted[0]?.customerName ??
        normalizedName;
      const phone =
        matchedKnownCustomer?.phone ??
        sorted[0]?.customerPhone ??
        normalizedPhone;

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

      const customerServices = uniqueById([
        ...(matchedKnownCustomer?.id
          ? servicesByCustomerId.get(matchedKnownCustomer.id) ?? []
          : []),
        ...(servicesByCustomerName.get(normalizeCustomerName(name)) ?? []),
      ]);
      const customerTravel = uniqueById([
        ...(matchedKnownCustomer?.id
          ? travelByCustomerId.get(matchedKnownCustomer.id) ?? []
          : []),
        ...(travelByEmployeeName.get(normalizeCustomerName(name)) ?? []),
      ]);
      const serviceRevenue = customerServices.reduce((sum, b) => sum + b.totalAmount, 0);
      const travelRevenue = customerTravel.reduce((sum, request) => sum + request.estimatedCost, 0);

      return {
        id: matchedKnownCustomer?.id ?? toCustomerId(name, phone),
        name,
        phone,
        email: matchedKnownCustomer?.email ?? customerServices[0]?.customerEmail,
        preferredAirline: preferredAirline(sorted),
        branches: Array.from(new Set(sorted.map((item) => item.branch))),
        segment: matchedKnownCustomer?.segment ?? determineSegment(totalSales + serviceRevenue + travelRevenue),
        totalBookings: sorted.length + customerServices.length + customerTravel.length,
        totalSales: roundMoney(totalSales + serviceRevenue + travelRevenue),
        paidAmount,
        outstandingAmount,
        refundedAmount,
        averageTicket: roundMoney(
          (totalSales + serviceRevenue + travelRevenue) / Math.max(sorted.length + customerServices.length + customerTravel.length, 1),
        ),
        lastBookingAt: sorted[0]?.createdAt ?? matchedKnownCustomer?.createdAt ?? new Date(referenceDateMs).toISOString(),
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
        serviceBookings: customerServices,
        travelRequests: customerTravel,
      };
    },
  );

  const customerProfileById = new Map<string, CustomerProfile>();
  for (const profile of customers) {
    customerProfileById.set(profile.id, profile);
  }
  for (const customer of knownCustomers) {
    const existing = customerProfileById.get(customer.id);
    if (existing) {
      if (!existing.email) existing.email = customer.email;
      existing.segment = customer.segment;
      continue;
    }

    const customerServices = uniqueById([
      ...(servicesByCustomerId.get(customer.id) ?? []),
      ...(servicesByCustomerName.get(normalizeCustomerName(customer.name)) ?? []),
    ]);
    const customerTravel = uniqueById([
      ...(travelByCustomerId.get(customer.id) ?? []),
      ...(travelByEmployeeName.get(normalizeCustomerName(customer.name)) ?? []),
    ]);
    const serviceRevenue = customerServices.reduce((sum, booking) => sum + booking.totalAmount, 0);
    const travelRevenue = customerTravel.reduce((sum, request) => sum + request.estimatedCost, 0);
    const totalRevenue = roundMoney(serviceRevenue + travelRevenue);
    const totalBookings = customerServices.length + customerTravel.length;
    const creditLimit = buildCreditLimit(customer.name);
    const latestActivity = [
      customer.createdAt,
      ...customerServices.map((booking) => booking.createdAt),
      ...customerTravel.map((request) => request.updatedAt),
    ].sort((a, b) => b.localeCompare(a))[0] ?? customer.createdAt;

    customerProfileById.set(customer.id, {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      preferredAirline: "-",
      branches: [],
      segment: customer.segment,
      totalBookings,
      totalSales: totalRevenue,
      paidAmount: 0,
      outstandingAmount: 0,
      refundedAmount: 0,
      averageTicket: totalBookings > 0 ? roundMoney(totalRevenue / totalBookings) : 0,
      lastBookingAt: latestActivity,
      credit: {
        limit: creditLimit,
        exposure: 0,
        available: creditLimit,
        utilization: 0,
        riskLevel: "low",
      },
      aging: buildAging([], referenceDateMs),
      timeline: [],
      serviceBookings: customerServices,
      travelRequests: customerTravel,
    });
  }

  const sortedCustomers = Array.from(customerProfileById.values()).sort((a, b) => b.totalSales - a.totalSales);
  const totalOutstanding = roundMoney(
    sortedCustomers.reduce((sum, customer) => sum + customer.outstandingAmount, 0),
  );
  const totalSales = roundMoney(
    sortedCustomers.reduce((sum, customer) => sum + customer.totalSales, 0),
  );
  const highRisk = sortedCustomers.filter(
    (customer) => customer.credit.riskLevel === "high",
  ).length;

  const totalServiceRevenue = roundMoney(
    serviceBookings.reduce((sum, b) => sum + b.totalAmount, 0),
  );

  return {
    customers: sortedCustomers,
    totals: {
      customers: sortedCustomers.length,
      outstanding: totalOutstanding,
      sales: totalSales,
      highRisk,
      totalServiceRevenue,
      totalTravelRequests: travelRequests.length,
    },
  };
}
