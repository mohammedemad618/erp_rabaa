import type { PaymentMethod, TransactionStatus } from "@/modules/transactions/types";

export type CustomerRiskLevel = "low" | "medium" | "high";
export type CustomerSegment = "starter" | "growth" | "strategic";

export interface CustomerTimelineItem {
  id: string;
  transactionId: string;
  date: string;
  ticketNumber: string;
  pnr: string;
  airline: string;
  branch: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  agent: string;
}

export interface AgingBucket {
  bucket: "0_30" | "31_60" | "61_90" | "91_plus";
  label: string;
  amount: number;
  count: number;
}

export interface CreditIndicator {
  limit: number;
  exposure: number;
  available: number;
  utilization: number;
  riskLevel: CustomerRiskLevel;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  preferredAirline: string;
  branches: string[];
  segment: CustomerSegment;
  totalBookings: number;
  totalSales: number;
  paidAmount: number;
  outstandingAmount: number;
  refundedAmount: number;
  averageTicket: number;
  lastBookingAt: string;
  credit: CreditIndicator;
  aging: AgingBucket[];
  timeline: CustomerTimelineItem[];
}

export interface CrmDataset {
  customers: CustomerProfile[];
  totals: {
    customers: number;
    outstanding: number;
    sales: number;
    highRisk: number;
  };
}
