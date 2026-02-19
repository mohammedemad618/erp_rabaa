export type AccountCategory =
  | "asset"
  | "liability"
  | "equity"
  | "revenue"
  | "expense";

export type JournalEntryState = "draft" | "posted" | "reversed";

export interface JournalRow {
  id: string;
  entryId: string;
  date: string;
  reference: string;
  branch: string;
  airline: string;
  agent: string;
  account: string;
  category: AccountCategory;
  debit: number;
  credit: number;
  currency: string;
  state: JournalEntryState;
}

export interface TrialBalanceRow {
  account: string;
  category: AccountCategory;
  debit: number;
  credit: number;
  net: number;
}

export interface BalanceSheetRow {
  account: string;
  category: "asset" | "liability" | "equity";
  balance: number;
}

export interface AccountingMetrics {
  postedEntries: number;
  draftEntries: number;
  totalDebit: number;
  totalCredit: number;
  imbalance: number;
}

export interface ProfitLossGroupRow {
  key: string;
  revenue: number;
  expense: number;
  net: number;
}

export interface ProfitLossSummary {
  revenue: number;
  expense: number;
  netIncome: number;
  margin: number;
  byBranch: ProfitLossGroupRow[];
  byAirline: ProfitLossGroupRow[];
}

export interface BalanceSheetSummary {
  assets: number;
  liabilities: number;
  equity: number;
  rows: BalanceSheetRow[];
}

export interface AccountingDataset {
  journalRows: JournalRow[];
  accounts: string[];
  branches: string[];
  accountCategories: Record<string, AccountCategory>;
  trialBalance: TrialBalanceRow[];
  metrics: AccountingMetrics;
  profitLoss: ProfitLossSummary;
  balanceSheet: BalanceSheetSummary;
}
