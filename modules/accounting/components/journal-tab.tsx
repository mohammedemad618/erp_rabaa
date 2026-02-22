"use client";

import { useTranslations } from "next-intl";
import type { JournalRow } from "../types";
import { formatCurrency, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";

const ENTRY_STATE_STYLE = {
  draft: "bg-slate-50 text-slate-700 border border-slate-200",
  posted: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  reversed: "bg-amber-50 text-amber-700 border border-amber-200",
} as const;

function JournalStatusPill({ state, label }: { state: keyof typeof ENTRY_STATE_STYLE; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
        ENTRY_STATE_STYLE[state]
      )}
    >
      {label}
    </span>
  );
}

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
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs text-slate-500 uppercase tracking-wider">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-start font-semibold">{tAccounting("journal.entry")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tAccounting("journal.date")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tAccounting("journal.reference")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tAccounting("journal.account")}</th>
                <th className="px-4 py-3 text-end font-semibold">{tAccounting("journal.debit")}</th>
                <th className="px-4 py-3 text-end font-semibold">{tAccounting("journal.credit")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tAccounting("journal.branch")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tAccounting("journal.airline")}</th>
                <th className="px-4 py-3 text-center font-semibold">{tAccounting("journal.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{row.entryId}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(row.date, locale)}</td>
                  <td className="px-4 py-2.5 truncate max-w-[150px]">{row.reference}</td>
                  <td className="px-4 py-2.5 text-slate-900">{row.account}</td>
                  <td className="px-4 py-2.5 text-end font-mono text-xs">
                    {row.debit ? formatCurrency(row.debit, locale, row.currency) : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-end font-mono text-xs">
                    {row.credit ? formatCurrency(row.credit, locale, row.currency) : "-"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{row.branch}</td>
                  <td className="px-4 py-2.5 truncate max-w-[120px]">{row.airline}</td>
                  <td className="px-4 py-2.5 text-center">
                    <JournalStatusPill
                      state={row.state}
                      label={tAccounting(`journal.stateValues.${row.state}`)}
                    />
                  </td>
                </tr>
              ))}
              {!rows.length ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p>{tAccounting("journal.empty")}</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="no-print flex items-center justify-between text-xs text-slate-500 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
        <p className="font-medium">
          {tAccounting("journal.rows")}: <span className="text-slate-900">{totalRows}</span>
        </p>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="secondary" disabled={page <= 0} onClick={onPrevPage} className="h-8 px-3">
            Prev
          </Button>
          <span className="font-medium text-slate-700">
            {page + 1} / {pageCount}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= pageCount - 1}
            onClick={onNextPage}
            className="h-8 px-3"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
