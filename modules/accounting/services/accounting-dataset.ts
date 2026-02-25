import type { Transaction, TransactionStatus } from "@/modules/transactions/types";
import type {
  AccountingDataset,
  AccountCategory,
  BalanceSheetRow,
  JournalEntryState,
  JournalRow,
  ProfitLossGroupRow,
  TrialBalanceRow,
} from "../types";

const NON_POSTED_STATUSES: TransactionStatus[] = [
  "draft",
  "ocr_reviewed",
  "pending_approval",
];

const SETTLEMENT_ACCOUNT_BY_PAYMENT = {
  cash: "Cash",
  card: "POS Receivable",
  bank: "Bank Clearing",
} as const;

const ACCOUNT_CATEGORY: Record<string, AccountCategory> = {
  Cash: "asset",
  "POS Receivable": "asset",
  "Bank Clearing": "asset",
  "Ticket Revenue": "revenue",
  "Hotel Revenue": "revenue",
  "Car Rental Revenue": "revenue",
  "Visa Service Revenue": "revenue",
  "Insurance Commission": "revenue",
  "Tour Package Revenue": "revenue",
  "Transfer Revenue": "revenue",
  "Tax Payable": "liability",
  "Cost of Service": "expense",
  "Accrued Payables": "liability",
  "Sales Returns": "expense",
  "Voided Tickets Reserve": "expense",
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function mapEntryState(status: TransactionStatus): JournalEntryState {
  if (NON_POSTED_STATUSES.includes(status)) {
    return "draft";
  }
  if (status === "refunded" || status === "voided") {
    return "reversed";
  }
  return "posted";
}

function isPostedState(state: JournalEntryState): boolean {
  return state !== "draft";
}

function getAccountCategory(account: string): AccountCategory {
  if (ACCOUNT_CATEGORY[account]) return ACCOUNT_CATEGORY[account];
  if (account.includes("Revenue") || account.includes("Commission")) return "revenue";
  return "asset";
}

function directionalNet(
  category: AccountCategory,
  debit: number,
  credit: number,
): number {
  if (category === "asset" || category === "expense") {
    return debit - credit;
  }
  return credit - debit;
}

export function buildAccountingDataset(transactions: Transaction[]): AccountingDataset {
  const journalRows: JournalRow[] = [];
  let rowCounter = 0;

  for (const transaction of transactions) {
    const state = mapEntryState(transaction.status);
    const settlementAccount =
      SETTLEMENT_ACCOUNT_BY_PAYMENT[transaction.paymentMethod] ?? "Cash";

    const revenueAccountLine = transaction.accountingPreview.find(
      (line) => line.side === "credit" && line.account !== "Tax Payable",
    );
    const revenueAccount = revenueAccountLine?.account ?? "Ticket Revenue";

    const lines: Array<{
      account: string;
      debit: number;
      credit: number;
    }> = [
      {
        account: settlementAccount,
        debit: roundMoney(transaction.totalAmount),
        credit: 0,
      },
      {
        account: revenueAccount,
        debit: 0,
        credit: roundMoney(transaction.salesAmount),
      },
      {
        account: "Tax Payable",
        debit: 0,
        credit: roundMoney(transaction.taxAmount),
      },
    ];

    if (isPostedState(state)) {
      const costOfService = roundMoney(transaction.salesAmount * 0.18);
      lines.push({
        account: "Cost of Service",
        debit: costOfService,
        credit: 0,
      });
      lines.push({
        account: "Accrued Payables",
        debit: 0,
        credit: costOfService,
      });
    }

    if (transaction.status === "refunded") {
      lines.push({
        account: "Sales Returns",
        debit: roundMoney(transaction.totalAmount),
        credit: 0,
      });
      lines.push({
        account: settlementAccount,
        debit: 0,
        credit: roundMoney(transaction.totalAmount),
      });
    }

    if (transaction.status === "voided") {
      lines.push({
        account: "Voided Tickets Reserve",
        debit: roundMoney(transaction.totalAmount),
        credit: 0,
      });
      lines.push({
        account: settlementAccount,
        debit: 0,
        credit: roundMoney(transaction.totalAmount),
      });
    }

    const entryId = `JE-${transaction.id}`;
    for (const line of lines) {
      rowCounter += 1;
      journalRows.push({
        id: `jr-${rowCounter}`,
        entryId,
        date: transaction.createdAt,
        reference: transaction.id,
        branch: transaction.branch,
        airline: transaction.airline,
        agent: transaction.agent,
        account: line.account,
        category: getAccountCategory(line.account),
        debit: line.debit,
        credit: line.credit,
        currency: transaction.currency,
        state,
      });
    }
  }

  const postedRows = journalRows.filter((row) => isPostedState(row.state));
  const postedEntryIds = new Set(
    postedRows.map((row) => row.entryId),
  );
  const draftEntryIds = new Set(
    journalRows.filter((row) => row.state === "draft").map((row) => row.entryId),
  );

  const totalDebit = roundMoney(
    postedRows.reduce((sum, row) => sum + row.debit, 0),
  );
  const totalCredit = roundMoney(
    postedRows.reduce((sum, row) => sum + row.credit, 0),
  );

  const trialMap = new Map<
    string,
    {
      category: AccountCategory;
      debit: number;
      credit: number;
    }
  >();

  for (const row of postedRows) {
    const existing = trialMap.get(row.account);
    if (!existing) {
      trialMap.set(row.account, {
        category: row.category,
        debit: row.debit,
        credit: row.credit,
      });
      continue;
    }
    existing.debit = roundMoney(existing.debit + row.debit);
    existing.credit = roundMoney(existing.credit + row.credit);
  }

  const trialBalance: TrialBalanceRow[] = Array.from(trialMap.entries())
    .map(([account, value]) => ({
      account,
      category: value.category,
      debit: value.debit,
      credit: value.credit,
      net: roundMoney(directionalNet(value.category, value.debit, value.credit)),
    }))
    .sort((a, b) => a.account.localeCompare(b.account));

  const pnlByBranch = new Map<
    string,
    {
      revenue: number;
      expense: number;
    }
  >();

  const pnlByAirline = new Map<
    string,
    {
      revenue: number;
      expense: number;
    }
  >();

  for (const row of postedRows) {
    const deltaRevenue =
      row.category === "revenue" ? roundMoney(row.credit - row.debit) : 0;
    const deltaExpense =
      row.category === "expense" ? roundMoney(row.debit - row.credit) : 0;

    const branchAgg = pnlByBranch.get(row.branch) ?? { revenue: 0, expense: 0 };
    branchAgg.revenue = roundMoney(branchAgg.revenue + deltaRevenue);
    branchAgg.expense = roundMoney(branchAgg.expense + deltaExpense);
    pnlByBranch.set(row.branch, branchAgg);

    const airlineAgg = pnlByAirline.get(row.airline) ?? { revenue: 0, expense: 0 };
    airlineAgg.revenue = roundMoney(airlineAgg.revenue + deltaRevenue);
    airlineAgg.expense = roundMoney(airlineAgg.expense + deltaExpense);
    pnlByAirline.set(row.airline, airlineAgg);
  }

  const mapToPnlRows = (
    input: Map<string, { revenue: number; expense: number }>,
  ): ProfitLossGroupRow[] => {
    return Array.from(input.entries())
      .map(([key, value]) => {
        const revenue = roundMoney(value.revenue);
        const expense = roundMoney(value.expense);
        return {
          key,
          revenue,
          expense,
          net: roundMoney(revenue - expense),
        };
      })
      .sort((a, b) => b.net - a.net);
  };

  const byBranch = mapToPnlRows(pnlByBranch);
  const byAirline = mapToPnlRows(pnlByAirline);

  const revenue = roundMoney(byBranch.reduce((sum, row) => sum + row.revenue, 0));
  const expense = roundMoney(byBranch.reduce((sum, row) => sum + row.expense, 0));
  const netIncome = roundMoney(revenue - expense);
  const margin = revenue > 0 ? roundMoney((netIncome / revenue) * 100) : 0;

  const assetRows: BalanceSheetRow[] = trialBalance
    .filter((row) => row.category === "asset")
    .map((row) => ({
      account: row.account,
      category: "asset",
      balance: row.net,
    }));

  const liabilityRows: BalanceSheetRow[] = trialBalance
    .filter((row) => row.category === "liability")
    .map((row) => ({
      account: row.account,
      category: "liability",
      balance: row.net,
    }));

  const assets = roundMoney(assetRows.reduce((sum, row) => sum + row.balance, 0));
  const liabilities = roundMoney(
    liabilityRows.reduce((sum, row) => sum + row.balance, 0),
  );
  const equity = roundMoney(assets - liabilities);

  const balanceSheetRows: BalanceSheetRow[] = [
    ...assetRows,
    ...liabilityRows,
    {
      account: "Retained Earnings (Current)",
      category: "equity",
      balance: equity,
    },
  ];

  const accounts = Array.from(new Set(journalRows.map((row) => row.account))).sort(
    (a, b) => a.localeCompare(b),
  );
  const branches = Array.from(new Set(journalRows.map((row) => row.branch))).sort(
    (a, b) => a.localeCompare(b),
  );
  const accountCategories = Object.fromEntries(
    accounts.map((account) => [account, getAccountCategory(account)]),
  );

  return {
    journalRows,
    accounts,
    branches,
    accountCategories,
    trialBalance,
    metrics: {
      postedEntries: postedEntryIds.size,
      draftEntries: draftEntryIds.size,
      totalDebit,
      totalCredit,
      imbalance: roundMoney(Math.abs(totalDebit - totalCredit)),
    },
    profitLoss: {
      revenue,
      expense,
      netIncome,
      margin,
      byBranch,
      byAirline,
    },
    balanceSheet: {
      assets,
      liabilities,
      equity,
      rows: balanceSheetRows,
    },
  };
}
