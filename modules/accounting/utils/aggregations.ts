import type {
  AccountCategory,
  BalanceSheetRow,
  JournalRow,
  TrialBalanceRow,
} from "../types";

export type PeriodPreset = "all" | "7" | "30";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function toDirectionalNet(
  category: AccountCategory,
  debit: number,
  credit: number,
): number {
  if (category === "asset" || category === "expense") {
    return debit - credit;
  }
  return credit - debit;
}

export function isWithinPeriod(
  dateIso: string,
  period: PeriodPreset,
  nowMs: number,
): boolean {
  if (period === "all") {
    return true;
  }
  const days = period === "7" ? 7 : 30;
  const dateMs = new Date(dateIso).getTime();
  return nowMs - dateMs <= days * 24 * 60 * 60 * 1000;
}

export function aggregateTrialBalance(rows: JournalRow[]): TrialBalanceRow[] {
  const aggregate = new Map<
    string,
    {
      category: AccountCategory;
      debit: number;
      credit: number;
    }
  >();

  for (const row of rows) {
    const existing = aggregate.get(row.account);
    if (!existing) {
      aggregate.set(row.account, {
        category: row.category,
        debit: row.debit,
        credit: row.credit,
      });
      continue;
    }
    existing.debit = roundMoney(existing.debit + row.debit);
    existing.credit = roundMoney(existing.credit + row.credit);
  }

  return Array.from(aggregate.entries())
    .map(([account, value]) => ({
      account,
      category: value.category,
      debit: value.debit,
      credit: value.credit,
      net: roundMoney(toDirectionalNet(value.category, value.debit, value.credit)),
    }))
    .sort((a, b) => a.account.localeCompare(b.account));
}

export function aggregateProfitLoss(rows: JournalRow[]): {
  revenue: number;
  expense: number;
  netIncome: number;
  margin: number;
  byBranch: Array<{ key: string; revenue: number; expense: number; net: number }>;
  byAirline: Array<{ key: string; revenue: number; expense: number; net: number }>;
} {
  const branchMap = new Map<string, { revenue: number; expense: number }>();
  const airlineMap = new Map<string, { revenue: number; expense: number }>();

  for (const row of rows) {
    const deltaRevenue = row.category === "revenue" ? row.credit - row.debit : 0;
    const deltaExpense = row.category === "expense" ? row.debit - row.credit : 0;

    const byBranch = branchMap.get(row.branch) ?? { revenue: 0, expense: 0 };
    byBranch.revenue = roundMoney(byBranch.revenue + deltaRevenue);
    byBranch.expense = roundMoney(byBranch.expense + deltaExpense);
    branchMap.set(row.branch, byBranch);

    const byAirline = airlineMap.get(row.airline) ?? { revenue: 0, expense: 0 };
    byAirline.revenue = roundMoney(byAirline.revenue + deltaRevenue);
    byAirline.expense = roundMoney(byAirline.expense + deltaExpense);
    airlineMap.set(row.airline, byAirline);
  }

  const toRows = (input: Map<string, { revenue: number; expense: number }>) =>
    Array.from(input.entries())
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

  const byBranch = toRows(branchMap);
  const byAirline = toRows(airlineMap);
  const revenue = roundMoney(byBranch.reduce((sum, row) => sum + row.revenue, 0));
  const expense = roundMoney(byBranch.reduce((sum, row) => sum + row.expense, 0));
  const netIncome = roundMoney(revenue - expense);
  const margin = revenue > 0 ? roundMoney((netIncome / revenue) * 100) : 0;

  return {
    revenue,
    expense,
    netIncome,
    margin,
    byBranch,
    byAirline,
  };
}

export function aggregateBalanceSheet(
  trialBalanceRows: TrialBalanceRow[],
): {
  assets: number;
  liabilities: number;
  equity: number;
  rows: BalanceSheetRow[];
} {
  const assetRows: BalanceSheetRow[] = [];
  const liabilityRows: BalanceSheetRow[] = [];

  for (const row of trialBalanceRows) {
    if (row.category === "asset") {
      assetRows.push({
        account: row.account,
        category: "asset",
        balance: row.net,
      });
    }
    if (row.category === "liability") {
      liabilityRows.push({
        account: row.account,
        category: "liability",
        balance: row.net,
      });
    }
  }

  const assets = roundMoney(assetRows.reduce((sum, row) => sum + row.balance, 0));
  const liabilities = roundMoney(
    liabilityRows.reduce((sum, row) => sum + row.balance, 0),
  );
  const equity = roundMoney(assets - liabilities);

  return {
    assets,
    liabilities,
    equity,
    rows: [
      ...assetRows,
      ...liabilityRows,
      {
        account: "Retained Earnings (Filtered)",
        category: "equity",
        balance: equity,
      },
    ],
  };
}

export function sumDebit(rows: Array<{ debit: number }>): number {
  return roundMoney(rows.reduce((sum, row) => sum + row.debit, 0));
}

export function sumCredit(rows: Array<{ credit: number }>): number {
  return roundMoney(rows.reduce((sum, row) => sum + row.credit, 0));
}

export function absDiff(a: number, b: number): number {
  return roundMoney(Math.abs(a - b));
}
