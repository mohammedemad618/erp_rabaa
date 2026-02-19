export type TransactionStatus =
  | "draft"
  | "ocr_reviewed"
  | "pending_approval"
  | "approved"
  | "pending_payment"
  | "paid"
  | "receipt_issued"
  | "refunded"
  | "voided";

export type PaymentMethod = "cash" | "card" | "bank";

export interface AccountingLine {
  id: string;
  side: "debit" | "credit";
  account: string;
  amount: number;
  currency: string;
}

export interface ApprovalStep {
  id: string;
  actor: string;
  status: "pending" | "approved" | "rejected";
  at?: string;
  note?: string;
}

export interface AuditMetadata {
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  version: number;
}

export interface Transaction {
  id: string;
  pnr: string;
  ticketNumber: string;
  customerName: string;
  customerPhone: string;
  airline: string;
  branch: string;
  salesAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  status: TransactionStatus;
  approvalState: "not_required" | "pending" | "approved" | "rejected";
  agent: string;
  createdAt: string;
  issuedAt: string;
  accountingPreview: AccountingLine[];
  approvalTimeline: ApprovalStep[];
  auditMetadata: AuditMetadata;
}

export const transactionStatusOrder: TransactionStatus[] = [
  "draft",
  "ocr_reviewed",
  "pending_approval",
  "approved",
  "pending_payment",
  "paid",
  "receipt_issued",
  "refunded",
  "voided",
];
