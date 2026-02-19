import type { Transaction } from "@/modules/transactions/types";
import type {
  AirlineReconciliationSummary,
  BspDataset,
  BspMismatchRow,
  BspStatementRow,
  BspStatus,
  MismatchSeverity,
  MismatchType,
  SettlementTimelinePoint,
  SystemSaleRow,
} from "../types";

const BSP_ELIGIBLE_STATUSES = new Set([
  "approved",
  "pending_payment",
  "paid",
  "receipt_issued",
  "refunded",
  "voided",
]);

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(dateIso: string, days: number): string {
  const date = new Date(dateIso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

function toBspStatus(status: Transaction["status"], mode: number): BspStatus {
  if (mode % 4 === 0) {
    return "under_review";
  }
  if (status === "voided" || status === "refunded") {
    return "disputed";
  }
  return "reported";
}

function createSystemRows(transactions: Transaction[]): SystemSaleRow[] {
  return transactions
    .filter((transaction) => BSP_ELIGIBLE_STATUSES.has(transaction.status))
    .map((transaction) => ({
      transactionId: transaction.id,
      ticketNumber: transaction.ticketNumber,
      pnr: transaction.pnr,
      airline: transaction.airline,
      branch: transaction.branch,
      issuedAt: transaction.issuedAt,
      status: transaction.status,
      totalAmount: roundMoney(transaction.totalAmount),
      taxAmount: roundMoney(transaction.taxAmount),
      currency: transaction.currency,
    }));
}

function createStatementRows(systemRows: SystemSaleRow[]): BspStatementRow[] {
  const statementRows: BspStatementRow[] = [];
  let statementCounter = 1;

  for (const row of systemRows) {
    const seed = hashString(row.ticketNumber);
    const mode = seed % 10;

    if (mode === 0) {
      continue;
    }

    let total = row.totalAmount;
    let tax = row.taxAmount;

    if (mode === 1 || mode === 6) {
      const variance = ((seed % 5) + 1) * (seed % 2 === 0 ? 12 : -9);
      total = roundMoney(total + variance);
    }
    if (mode === 2 || mode === 7) {
      const taxVariance = ((seed % 4) + 1) * (seed % 2 === 0 ? 4 : -3);
      tax = roundMoney(Math.max(0, tax + taxVariance));
      total = roundMoney(total + taxVariance);
    }

    statementRows.push({
      statementId: `BSP-${statementCounter.toString().padStart(6, "0")}`,
      transactionId: row.transactionId,
      ticketNumber: row.ticketNumber,
      pnr: row.pnr,
      airline: row.airline,
      settlementDate: addDays(row.issuedAt, (seed % 5) + 1),
      reportedTotal: total,
      reportedTax: tax,
      reportedStatus: toBspStatus(row.status, mode),
      currency: row.currency,
    });
    statementCounter += 1;
  }

  for (let index = 0; index < Math.min(18, Math.floor(systemRows.length / 100)); index += 1) {
    const row = systemRows[index * 45];
    if (!row) {
      continue;
    }
    statementRows.push({
      statementId: `BSP-X${statementCounter.toString().padStart(5, "0")}`,
      ticketNumber: `EXTRA${(index + 1).toString().padStart(8, "0")}`.slice(0, 13),
      pnr: `X${(10000 + index).toString().slice(-5)}`.slice(0, 6),
      airline: row.airline,
      settlementDate: addDays(row.issuedAt, 3),
      reportedTotal: roundMoney(row.totalAmount * 0.92),
      reportedTax: roundMoney(row.taxAmount * 0.9),
      reportedStatus: "disputed",
      currency: row.currency,
    });
    statementCounter += 1;
  }

  return statementRows;
}

function mapSeverity(type: MismatchType, delta: number): MismatchSeverity {
  const absDelta = Math.abs(delta);
  if (type === "missing_in_bsp" || type === "extra_in_bsp") {
    return "high";
  }
  if (absDelta > 60 || type === "status_mismatch") {
    return "high";
  }
  if (absDelta > 15 || type === "tax_mismatch") {
    return "medium";
  }
  return "low";
}

function detectMismatches(
  systemRows: SystemSaleRow[],
  statementRows: BspStatementRow[],
): BspMismatchRow[] {
  const mismatches: BspMismatchRow[] = [];
  const statementMap = new Map(statementRows.map((row) => [row.ticketNumber, row]));
  const matchedTicketNumbers = new Set<string>();

  let counter = 1;
  for (const systemRow of systemRows) {
    const statement = statementMap.get(systemRow.ticketNumber);
    if (!statement) {
      mismatches.push({
        id: `MM-${counter.toString().padStart(6, "0")}`,
        type: "missing_in_bsp",
        severity: "high",
        airline: systemRow.airline,
        ticketNumber: systemRow.ticketNumber,
        pnr: systemRow.pnr,
        systemAmount: systemRow.totalAmount,
        bspAmount: 0,
        delta: roundMoney(0 - systemRow.totalAmount),
        description: "System ticket not found in BSP statement.",
      });
      counter += 1;
      continue;
    }

    matchedTicketNumbers.add(statement.ticketNumber);

    const amountDelta = roundMoney(statement.reportedTotal - systemRow.totalAmount);
    if (Math.abs(amountDelta) > 0.99) {
      mismatches.push({
        id: `MM-${counter.toString().padStart(6, "0")}`,
        type: "amount_mismatch",
        severity: mapSeverity("amount_mismatch", amountDelta),
        airline: systemRow.airline,
        ticketNumber: systemRow.ticketNumber,
        pnr: systemRow.pnr,
        systemAmount: systemRow.totalAmount,
        bspAmount: statement.reportedTotal,
        delta: amountDelta,
        description: "Total sale amount differs between system and BSP.",
      });
      counter += 1;
    }

    const taxDelta = roundMoney(statement.reportedTax - systemRow.taxAmount);
    if (Math.abs(taxDelta) > 0.99) {
      mismatches.push({
        id: `MM-${counter.toString().padStart(6, "0")}`,
        type: "tax_mismatch",
        severity: mapSeverity("tax_mismatch", taxDelta),
        airline: systemRow.airline,
        ticketNumber: systemRow.ticketNumber,
        pnr: systemRow.pnr,
        systemAmount: systemRow.taxAmount,
        bspAmount: statement.reportedTax,
        delta: taxDelta,
        description: "Tax portion differs between system and BSP.",
      });
      counter += 1;
    }

    const expectedBspStatus: BspStatus =
      systemRow.status === "refunded" || systemRow.status === "voided"
        ? "disputed"
        : "reported";
    if (statement.reportedStatus !== expectedBspStatus) {
      mismatches.push({
        id: `MM-${counter.toString().padStart(6, "0")}`,
        type: "status_mismatch",
        severity: "high",
        airline: systemRow.airline,
        ticketNumber: systemRow.ticketNumber,
        pnr: systemRow.pnr,
        systemAmount: systemRow.totalAmount,
        bspAmount: statement.reportedTotal,
        delta: amountDelta,
        description: "BSP status is not aligned with system lifecycle.",
      });
      counter += 1;
    }
  }

  for (const statementRow of statementRows) {
    if (matchedTicketNumbers.has(statementRow.ticketNumber)) {
      continue;
    }
    mismatches.push({
      id: `MM-${counter.toString().padStart(6, "0")}`,
      type: "extra_in_bsp",
      severity: "high",
      airline: statementRow.airline,
      ticketNumber: statementRow.ticketNumber,
      pnr: statementRow.pnr,
      systemAmount: 0,
      bspAmount: statementRow.reportedTotal,
      delta: statementRow.reportedTotal,
      description: "BSP ticket has no matching system transaction.",
    });
    counter += 1;
  }

  return mismatches;
}

function summarizeByAirline(
  systemRows: SystemSaleRow[],
  statementRows: BspStatementRow[],
  mismatches: BspMismatchRow[],
): AirlineReconciliationSummary[] {
  const airlineMap = new Map<
    string,
    {
      systemCount: number;
      statementCount: number;
      mismatchCount: number;
      variance: number;
    }
  >();

  for (const row of systemRows) {
    const current = airlineMap.get(row.airline) ?? {
      systemCount: 0,
      statementCount: 0,
      mismatchCount: 0,
      variance: 0,
    };
    current.systemCount += 1;
    current.variance = roundMoney(current.variance - row.totalAmount);
    airlineMap.set(row.airline, current);
  }

  for (const row of statementRows) {
    const current = airlineMap.get(row.airline) ?? {
      systemCount: 0,
      statementCount: 0,
      mismatchCount: 0,
      variance: 0,
    };
    current.statementCount += 1;
    current.variance = roundMoney(current.variance + row.reportedTotal);
    airlineMap.set(row.airline, current);
  }

  for (const mismatch of mismatches) {
    const current = airlineMap.get(mismatch.airline);
    if (!current) {
      continue;
    }
    current.mismatchCount += 1;
  }

  return Array.from(airlineMap.entries())
    .map(([airline, value]) => ({
      airline,
      ...value,
    }))
    .sort((a, b) => b.mismatchCount - a.mismatchCount);
}

function buildTimeline(
  systemRows: SystemSaleRow[],
  statementRows: BspStatementRow[],
): SettlementTimelinePoint[] {
  const timelineMap = new Map<
    string,
    {
      date: string;
      airline: string;
      systemAmount: number;
      bspAmount: number;
    }
  >();

  const systemMap = new Map(systemRows.map((row) => [row.ticketNumber, row]));

  for (const statement of statementRows) {
    const key = `${statement.airline}:${statement.settlementDate.slice(0, 10)}`;
    const current = timelineMap.get(key) ?? {
      date: statement.settlementDate.slice(0, 10),
      airline: statement.airline,
      systemAmount: 0,
      bspAmount: 0,
    };

    const system = systemMap.get(statement.ticketNumber);
    if (system) {
      current.systemAmount = roundMoney(current.systemAmount + system.totalAmount);
    }
    current.bspAmount = roundMoney(current.bspAmount + statement.reportedTotal);

    timelineMap.set(key, current);
  }

  return Array.from(timelineMap.entries())
    .map(([key, value]) => ({
      key,
      ...value,
      delta: roundMoney(value.bspAmount - value.systemAmount),
    }))
    .sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) {
        return byDate;
      }
      return a.airline.localeCompare(b.airline);
    });
}

export function buildBspDataset(transactions: Transaction[]): BspDataset {
  const systemRows = createSystemRows(transactions);
  const statementRows = createStatementRows(systemRows);
  const mismatches = detectMismatches(systemRows, statementRows);
  const airlineSummaries = summarizeByAirline(systemRows, statementRows, mismatches);
  const timeline = buildTimeline(systemRows, statementRows);

  const systemTotal = roundMoney(
    systemRows.reduce((sum, row) => sum + row.totalAmount, 0),
  );
  const statementTotal = roundMoney(
    statementRows.reduce((sum, row) => sum + row.reportedTotal, 0),
  );

  return {
    systemRows,
    statementRows,
    mismatches,
    airlineSummaries,
    timeline,
    metrics: {
      systemSales: systemRows.length,
      statementSales: statementRows.length,
      mismatches: mismatches.length,
      variance: roundMoney(statementTotal - systemTotal),
    },
  };
}
