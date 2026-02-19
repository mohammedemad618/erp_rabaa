import type { TransactionStatus } from "@/modules/transactions/types";

export type BspStatus = "reported" | "under_review" | "disputed";

export type MismatchType =
  | "missing_in_bsp"
  | "extra_in_bsp"
  | "amount_mismatch"
  | "tax_mismatch"
  | "status_mismatch";

export type MismatchSeverity = "low" | "medium" | "high";

export interface SystemSaleRow {
  transactionId: string;
  ticketNumber: string;
  pnr: string;
  airline: string;
  branch: string;
  issuedAt: string;
  status: TransactionStatus;
  totalAmount: number;
  taxAmount: number;
  currency: string;
}

export interface BspStatementRow {
  statementId: string;
  transactionId?: string;
  ticketNumber: string;
  pnr: string;
  airline: string;
  settlementDate: string;
  reportedTotal: number;
  reportedTax: number;
  reportedStatus: BspStatus;
  currency: string;
}

export interface BspMismatchRow {
  id: string;
  type: MismatchType;
  severity: MismatchSeverity;
  airline: string;
  ticketNumber: string;
  pnr: string;
  systemAmount: number;
  bspAmount: number;
  delta: number;
  description: string;
}

export interface AirlineReconciliationSummary {
  airline: string;
  systemCount: number;
  statementCount: number;
  mismatchCount: number;
  variance: number;
}

export interface SettlementTimelinePoint {
  key: string;
  date: string;
  airline: string;
  systemAmount: number;
  bspAmount: number;
  delta: number;
}

export interface BspMetrics {
  systemSales: number;
  statementSales: number;
  mismatches: number;
  variance: number;
}

export interface BspDataset {
  systemRows: SystemSaleRow[];
  statementRows: BspStatementRow[];
  mismatches: BspMismatchRow[];
  airlineSummaries: AirlineReconciliationSummary[];
  timeline: SettlementTimelinePoint[];
  metrics: BspMetrics;
}
