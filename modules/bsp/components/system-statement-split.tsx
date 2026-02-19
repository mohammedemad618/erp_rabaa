"use client";

import { useTranslations } from "next-intl";
import type { BspStatementRow, SystemSaleRow } from "../types";
import { formatCurrency, formatDate } from "@/utils/format";

interface SystemStatementSplitProps {
  locale: string;
  systemRows: SystemSaleRow[];
  statementRows: BspStatementRow[];
  mismatchedTickets: Set<string>;
  selectedTicket: string;
  onSelectTicket: (ticketNumber: string) => void;
}

function rowClass(
  ticketNumber: string,
  mismatchedTickets: Set<string>,
  selectedTicket: string,
): string {
  const isSelected = selectedTicket === ticketNumber;
  const isMismatch = mismatchedTickets.has(ticketNumber);

  if (isSelected && isMismatch) {
    return "bg-amber-50";
  }
  if (isSelected) {
    return "bg-blue-50";
  }
  if (isMismatch) {
    return "bg-rose-50";
  }
  return "";
}

export function SystemStatementSplit({
  locale,
  systemRows,
  statementRows,
  mismatchedTickets,
  selectedTicket,
  onSelectTicket,
}: SystemStatementSplitProps) {
  const tBsp = useTranslations("bsp");

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="surface-card overflow-hidden">
        <header className="border-b border-border bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-finance">{tBsp("split.systemTitle")}</h3>
        </header>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2 text-start">{tBsp("table.ticket")}</th>
                <th className="px-2 py-2 text-start">{tBsp("table.pnr")}</th>
                <th className="px-2 py-2 text-start">{tBsp("table.airline")}</th>
                <th className="px-2 py-2 text-end">{tBsp("table.total")}</th>
                <th className="px-2 py-2 text-start">{tBsp("table.status")}</th>
              </tr>
            </thead>
            <tbody>
              {systemRows.map((row) => (
                <tr
                  key={row.transactionId}
                  className={`cursor-pointer border-b border-border/70 ${rowClass(
                    row.ticketNumber,
                    mismatchedTickets,
                    selectedTicket,
                  )}`}
                  onClick={() => onSelectTicket(row.ticketNumber)}
                >
                  <td className="px-2 py-2 font-medium text-finance">{row.ticketNumber}</td>
                  <td className="px-2 py-2">{row.pnr}</td>
                  <td className="px-2 py-2">{row.airline}</td>
                  <td className="px-2 py-2 text-end">
                    {formatCurrency(row.totalAmount, locale, row.currency)}
                  </td>
                  <td className="px-2 py-2">{row.status}</td>
                </tr>
              ))}
              {!systemRows.length ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">
                    {tBsp("empty.system")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card overflow-hidden">
        <header className="border-b border-border bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-finance">{tBsp("split.statementTitle")}</h3>
        </header>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2 text-start">{tBsp("table.statementId")}</th>
                <th className="px-2 py-2 text-start">{tBsp("table.ticket")}</th>
                <th className="px-2 py-2 text-start">{tBsp("table.settlementDate")}</th>
                <th className="px-2 py-2 text-end">{tBsp("table.total")}</th>
                <th className="px-2 py-2 text-start">{tBsp("table.status")}</th>
              </tr>
            </thead>
            <tbody>
              {statementRows.map((row) => (
                <tr
                  key={row.statementId}
                  className={`cursor-pointer border-b border-border/70 ${rowClass(
                    row.ticketNumber,
                    mismatchedTickets,
                    selectedTicket,
                  )}`}
                  onClick={() => onSelectTicket(row.ticketNumber)}
                >
                  <td className="px-2 py-2 font-medium text-finance">{row.statementId}</td>
                  <td className="px-2 py-2">{row.ticketNumber}</td>
                  <td className="px-2 py-2">{formatDate(row.settlementDate, locale)}</td>
                  <td className="px-2 py-2 text-end">
                    {formatCurrency(row.reportedTotal, locale, row.currency)}
                  </td>
                  <td className="px-2 py-2">{row.reportedStatus}</td>
                </tr>
              ))}
              {!statementRows.length ? (
                <tr>
                  <td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">
                    {tBsp("empty.statement")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
