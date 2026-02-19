export type CashDirection = "in" | "out";
export type ReconciliationStatus = "unmatched" | "matched";

export interface CashRegisterRow {
  id: string;
  transactionId: string;
  branch: string;
  agent: string;
  date: string;
  direction: CashDirection;
  amount: number;
  currency: string;
  status: string;
}

export interface PosTerminalSummaryRow {
  terminalId: string;
  branch: string;
  transactions: number;
  grossAmount: number;
  settledAmount: number;
  pendingAmount: number;
  chargebackRisk: number;
}

export interface BankAccountRow {
  accountId: string;
  bankName: string;
  branch: string;
  iban: string;
  currency: string;
  ledgerBalance: number;
  statementBalance: number;
  availableBalance: number;
  lastSyncAt: string;
}

export interface SystemBankRow {
  id: string;
  reference: string;
  accountId: string;
  branch: string;
  date: string;
  description: string;
  direction: CashDirection;
  amount: number;
  currency: string;
}

export interface StatementBankRow {
  id: string;
  statementReference: string;
  accountId: string;
  date: string;
  description: string;
  direction: CashDirection;
  amount: number;
  currency: string;
}

export interface ReconciliationMatch {
  id: string;
  systemRowId: string;
  statementRowId: string;
  matchedAt: string;
  delta: number;
}

export interface TreasuryMetrics {
  cashIn: number;
  cashOut: number;
  cashNet: number;
  posPending: number;
  bankVariance: number;
  unmatchedSystem: number;
  unmatchedStatement: number;
}

export interface TreasuryDataset {
  cashRows: CashRegisterRow[];
  posSummaries: PosTerminalSummaryRow[];
  bankAccounts: BankAccountRow[];
  systemBankRows: SystemBankRow[];
  statementBankRows: StatementBankRow[];
  suggestedMatches: ReconciliationMatch[];
  metrics: TreasuryMetrics;
}
