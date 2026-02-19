import type { PaymentMethod, TransactionStatus } from "@/modules/transactions/types";

export type DatePreset = "7d" | "30d" | "90d" | "all";
export type HourBucket = "00_05" | "06_11" | "12_17" | "18_23";
export type DrillType = "airline" | "agent";

export interface ReportTransactionRow {
  id: string;
  transactionId: string;
  date: string;
  dayKey: string;
  weekday: number;
  hourBucket: HourBucket;
  airline: string;
  agent: string;
  branch: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  grossSigned: number;
  revenueSigned: number;
  costSigned: number;
  marginSigned: number;
  outstanding: boolean;
  refunded: boolean;
}

export interface MarginRow {
  key: string;
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
  transactions: number;
}

export interface CashFlowPoint {
  date: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
}

export interface HeatmapCell {
  weekday: number;
  hourBucket: HourBucket;
  value: number;
  count: number;
}

export interface ReportingDataset {
  rows: ReportTransactionRow[];
  branches: string[];
  airlines: string[];
  agents: string[];
  dateBounds: {
    min: string;
    max: string;
  };
}
