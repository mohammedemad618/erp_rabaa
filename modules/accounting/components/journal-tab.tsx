"use client";

import { useTranslations } from "next-intl";
import type { JournalRow } from "../types";
import { formatCurrency, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/button";

const ENTRY_STATE_STYLE = {
  draft: "bg-slate-100 text-slate-700",
  posted: "bg-emerald-100 text-emerald-700",
  reversed: "bg-amber-100 text-amber-700",
} as const;

interface JournalTabProps {
  rows: JournalRow[];
  locale: string;
  page: number;
  pageCount: number;
  totalRows: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function JournalTab({
  rows,
  locale,
  page,
  pageCount,
  totalRows,
  onPrevPage,
  onNextPage,
}: JournalTabProps) {
  const tAccounting = useTranslations("accounting");

  return (
    <div className="space-y-3">
      <div className="overflow-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2 text-start">{tAccounting("journal.entry")}</th>
              <th className="px-2 py-2 text-start">{tAccounting("journal.date")}</th>
              <th className="px-2 py-2 text-start">{tAccounting("journal.reference")}</th>
              <th className="px-2 py-2 text-start">{tAccounting("journal.account")}</th>
              <th className="px-2 py-2 text-end">{tAccounting("journal.debit")}</th>
              <th className="px-2 py-2 text-end">{tAccounting("journal.credit")}</th>
              <th className="px-2 py-2 text-start">{tAccounting("journal.branch")}</th>
              <th className="px-2 py-2 text-start">{tAccounting("journal.airline")}</th>
              <th className="px-2 py-2 text-start">{tAccounting("journal.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/70">
                <td className="px-2 py-2 font-medium text-finance">{row.entryId}</td>
                <td className="px-2 py-2">{formatDate(row.date, locale)}</td>
                <td className="px-2 py-2">{row.reference}</td>
                <td className="px-2 py-2">{row.account}</td>
                <td className="px-2 py-2 text-end">
                  {row.debit ? formatCurrency(row.debit, locale, row.currency) : "-"}
                </td>
                <td className="px-2 py-2 text-end">
                  {row.credit ? formatCurrency(row.credit, locale, row.currency) : "-"}
                </td>
                <td className="px-2 py-2">{row.branch}</td>
                <td className="px-2 py-2">{row.airline}</td>
                <td className="px-2 py-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${ENTRY_STATE_STYLE[row.state]}`}
                  >
                    {tAccounting(`journal.stateValues.${row.state}`)}
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={9} className="px-2 py-8 text-center text-muted-foreground">
                  {tAccounting("journal.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="no-print flex items-center justify-between text-xs text-muted-foreground">
        <p>
          {tAccounting("journal.rows")}: {totalRows}
        </p>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" disabled={page <= 0} onClick={onPrevPage}>
            Prev
          </Button>
          <span>
            {page + 1} / {pageCount}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= pageCount - 1}
            onClick={onNextPage}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
