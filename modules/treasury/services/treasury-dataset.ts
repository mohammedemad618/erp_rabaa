import type { Transaction } from "@/modules/transactions/types";
import type {
  BankAccountRow,
  CashDirection,
  CashRegisterRow,
  PosTerminalSummaryRow,
  ReconciliationMatch,
  StatementBankRow,
  SystemBankRow,
  TreasuryDataset,
} from "../types";

const CASH_ELIGIBLE_STATUSES = new Set([
  "approved",
  "pending_payment",
  "paid",
  "receipt_issued",
  "refunded",
  "voided",
]);

const BANK_ELIGIBLE_STATUSES = new Set([
  "pending_payment",
  "paid",
  "receipt_issued",
  "refunded",
  "voided",
]);

const ACCOUNT_MAP = {
  "Riyadh HQ": {
    accountId: "BA-RYD-001",
    bankName: "Saudi National Bank",
    iban: "SA1320000000608010167519",
  },
  "Jeddah Branch": {
    accountId: "BA-JED-001",
    bankName: "Al Rajhi Bank",
    iban: "SA0380000000608010167527",
  },
} as const;

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

function toSigned(direction: CashDirection, amount: number): number {
  return direction === "in" ? amount : -amount;
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function asDirection(transaction: Transaction): CashDirection {
  if (transaction.status === "refunded" || transaction.status === "voided") {
    return "out";
  }
  return "in";
}

function buildCashRows(transactions: Transaction[]): CashRegisterRow[] {
  return transactions
    .filter(
      (transaction) =>
        transaction.paymentMethod === "cash" &&
        CASH_ELIGIBLE_STATUSES.has(transaction.status),
    )
    .map((transaction) => ({
      id: `cash-${transaction.id}`,
      transactionId: transaction.id,
      branch: transaction.branch,
      agent: transaction.agent,
      date: transaction.createdAt,
      direction: asDirection(transaction),
      amount: roundMoney(transaction.totalAmount),
      currency: transaction.currency,
      status: transaction.status,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function buildPosSummaries(transactions: Transaction[]): PosTerminalSummaryRow[] {
  const terminalMap = new Map<
    string,
    {
      terminalId: string;
      branch: string;
      transactions: number;
      grossAmount: number;
      settledAmount: number;
      pendingAmount: number;
      chargebackRisk: number;
    }
  >();

  for (const transaction of transactions) {
    if (transaction.paymentMethod !== "card") {
      continue;
    }

    const branchCode = transaction.branch.includes("Riyadh") ? "RYD" : "JED";
    const terminalId = `POS-${branchCode}-${(hashString(transaction.id) % 4) + 1}`;
    const key = `${transaction.branch}-${terminalId}`;
    const current = terminalMap.get(key) ?? {
      terminalId,
      branch: transaction.branch,
      transactions: 0,
      grossAmount: 0,
      settledAmount: 0,
      pendingAmount: 0,
      chargebackRisk: 0,
    };

    const amount = roundMoney(transaction.totalAmount);
    current.transactions += 1;
    current.grossAmount = roundMoney(current.grossAmount + amount);

    if (transaction.status === "paid" || transaction.status === "receipt_issued") {
      current.settledAmount = roundMoney(current.settledAmount + amount);
    } else if (
      transaction.status === "pending_payment" ||
      transaction.status === "approved"
    ) {
      current.pendingAmount = roundMoney(current.pendingAmount + amount);
    }

    if (transaction.status === "refunded" || transaction.status === "voided") {
      current.chargebackRisk = roundMoney(current.chargebackRisk + amount);
    }

    terminalMap.set(key, current);
  }

  return Array.from(terminalMap.values()).sort((a, b) => b.grossAmount - a.grossAmount);
}

function buildSystemBankRows(transactions: Transaction[]): SystemBankRow[] {
  const rows: SystemBankRow[] = [];
  let counter = 1;

  for (const transaction of transactions) {
    if (!BANK_ELIGIBLE_STATUSES.has(transaction.status)) {
      continue;
    }
    if (transaction.paymentMethod !== "card" && transaction.paymentMethod !== "bank") {
      continue;
    }

    const accountInfo =
      ACCOUNT_MAP[transaction.branch as keyof typeof ACCOUNT_MAP] ?? ACCOUNT_MAP["Riyadh HQ"];
    const direction = asDirection(transaction);
    const methodLabel = transaction.paymentMethod === "card" ? "POS" : "BANK";

    rows.push({
      id: `sys-bank-${counter.toString().padStart(6, "0")}`,
      reference: transaction.id,
      accountId: accountInfo.accountId,
      branch: transaction.branch,
      date: transaction.createdAt,
      description: `${methodLabel} ${transaction.status.replace("_", " ")}`.toUpperCase(),
      direction,
      amount: roundMoney(transaction.totalAmount),
      currency: transaction.currency,
    });
    counter += 1;
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

function buildStatementRows(systemRows: SystemBankRow[]): StatementBankRow[] {
  const rows: StatementBankRow[] = [];
  let counter = 1;

  for (const row of systemRows) {
    const seed = hashString(row.reference);
    const mode = seed % 9;

    if (mode === 0) {
      continue;
    }

    let amount = row.amount;
    if (mode === 1 || mode === 5) {
      const variance = ((seed % 6) + 1) * (seed % 2 === 0 ? 3.5 : -2.75);
      amount = roundMoney(Math.max(1, amount + variance));
    }

    rows.push({
      id: `stmt-bank-${counter.toString().padStart(6, "0")}`,
      statementReference: `ST-${row.reference}`,
      accountId: row.accountId,
      date: addDays(row.date, (seed % 3) + 1),
      description:
        mode % 4 === 0 ? `${row.description} - BANK POST` : row.description,
      direction: row.direction,
      amount,
      currency: row.currency,
    });
    counter += 1;
  }

  for (let index = 0; index < 22; index += 1) {
    const source = systemRows[index * 31];
    if (!source) {
      break;
    }
    rows.push({
      id: `stmt-extra-${counter.toString().padStart(6, "0")}`,
      statementReference: `ST-EXTRA-${counter.toString().padStart(5, "0")}`,
      accountId: source.accountId,
      date: addDays(source.date, 2),
      description: index % 2 === 0 ? "BANK FEE" : "FX ADJUSTMENT",
      direction: "out",
      amount: roundMoney(8 + (index % 6) * 2.5),
      currency: source.currency,
    });
    counter += 1;
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

function buildSuggestedMatches(
  systemRows: SystemBankRow[],
  statementRows: StatementBankRow[],
): ReconciliationMatch[] {
  const matches: ReconciliationMatch[] = [];
  const usedStatementIds = new Set<string>();
  let counter = 1;

  for (const system of systemRows) {
    const candidate = statementRows.find((statement) => {
      if (usedStatementIds.has(statement.id)) {
        return false;
      }
      if (statement.accountId !== system.accountId) {
        return false;
      }
      if (statement.direction !== system.direction) {
        return false;
      }
      const sameRef =
        statement.statementReference.includes(system.reference) ||
        statement.description.includes(system.reference);
      const delta = Math.abs(statement.amount - system.amount);
      return sameRef && delta <= 1;
    });

    if (!candidate) {
      continue;
    }

    usedStatementIds.add(candidate.id);
    matches.push({
      id: `match-${counter.toString().padStart(6, "0")}`,
      systemRowId: system.id,
      statementRowId: candidate.id,
      matchedAt: addDays(system.date, 1),
      delta: roundMoney(
        toSigned(candidate.direction, candidate.amount) -
          toSigned(system.direction, system.amount),
      ),
    });
    counter += 1;
  }

  return matches;
}

function buildBankAccounts(
  systemRows: SystemBankRow[],
  statementRows: StatementBankRow[],
): BankAccountRow[] {
  const accountIds = new Set([
    ...systemRows.map((row) => row.accountId),
    ...statementRows.map((row) => row.accountId),
  ]);

  const accounts: BankAccountRow[] = [];
  for (const accountId of accountIds) {
    const systemForAccount = systemRows.filter((row) => row.accountId === accountId);
    const statementForAccount = statementRows.filter((row) => row.accountId === accountId);
    const branch = accountId.includes("RYD") ? "Riyadh HQ" : "Jeddah Branch";
    const accountInfo = ACCOUNT_MAP[branch as keyof typeof ACCOUNT_MAP];

    const opening = accountId.includes("RYD") ? 920000 : 510000;
    const ledgerBalance = roundMoney(
      opening +
        systemForAccount.reduce(
          (sum, row) => sum + toSigned(row.direction, row.amount),
          0,
        ),
    );
    const statementBalance = roundMoney(
      opening +
        statementForAccount.reduce(
          (sum, row) => sum + toSigned(row.direction, row.amount),
          0,
        ),
    );
    const reserve = accountId.includes("RYD") ? 22000 : 12000;
    const lastSync = statementForAccount[0]?.date ?? systemForAccount[0]?.date ?? new Date().toISOString();

    accounts.push({
      accountId,
      bankName: accountInfo.bankName,
      branch,
      iban: accountInfo.iban,
      currency: "SAR",
      ledgerBalance,
      statementBalance,
      availableBalance: roundMoney(statementBalance - reserve),
      lastSyncAt: lastSync,
    });
  }

  return accounts.sort((a, b) => a.accountId.localeCompare(b.accountId));
}

export function buildTreasuryDataset(transactions: Transaction[]): TreasuryDataset {
  const cashRows = buildCashRows(transactions);
  const posSummaries = buildPosSummaries(transactions);
  const systemBankRows = buildSystemBankRows(transactions);
  const statementBankRows = buildStatementRows(systemBankRows);
  const suggestedMatches = buildSuggestedMatches(systemBankRows, statementBankRows);
  const bankAccounts = buildBankAccounts(systemBankRows, statementBankRows);

  const matchedSystemIds = new Set(suggestedMatches.map((match) => match.systemRowId));
  const matchedStatementIds = new Set(
    suggestedMatches.map((match) => match.statementRowId),
  );

  const cashIn = roundMoney(
    cashRows
      .filter((row) => row.direction === "in")
      .reduce((sum, row) => sum + row.amount, 0),
  );
  const cashOut = roundMoney(
    cashRows
      .filter((row) => row.direction === "out")
      .reduce((sum, row) => sum + row.amount, 0),
  );

  const posPending = roundMoney(
    posSummaries.reduce((sum, row) => sum + row.pendingAmount, 0),
  );

  const ledgerTotal = roundMoney(
    bankAccounts.reduce((sum, account) => sum + account.ledgerBalance, 0),
  );
  const statementTotal = roundMoney(
    bankAccounts.reduce((sum, account) => sum + account.statementBalance, 0),
  );

  return {
    cashRows,
    posSummaries,
    bankAccounts,
    systemBankRows,
    statementBankRows,
    suggestedMatches,
    metrics: {
      cashIn,
      cashOut,
      cashNet: roundMoney(cashIn - cashOut),
      posPending,
      bankVariance: roundMoney(statementTotal - ledgerTotal),
      unmatchedSystem: systemBankRows.filter((row) => !matchedSystemIds.has(row.id)).length,
      unmatchedStatement: statementBankRows.filter((row) => !matchedStatementIds.has(row.id))
        .length,
    },
  };
}
