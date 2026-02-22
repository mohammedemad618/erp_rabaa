"use client";

import { useTranslations } from "next-intl";
import { formatCurrency, formatDate } from "@/utils/format";
import { cn } from "@/utils/cn";

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

interface LedgerRowView {
  id: string;
  date: string;
  reference: string;
  debit: number;
  credit: number;
  currency: string;
  state: "draft" | "posted" | "reversed";
  runningBalance: number;
}

interface LedgerTabProps {
  locale: string;
  account: string;
  accounts: string[];
  rows: LedgerRowView[];
  debitTotal: number;
  creditTotal: number;
  movement: number;
  onAccountChange: (value: string) => void;
}

export function LedgerTab({
  locale,
  account,
  accounts,
  rows,
  debitTotal,
  creditTotal,
  movement,
  onAccountChange,
}: LedgerTabProps) {
  const tAccounting = useTranslations("accounting");

  return (
    <div className="space-y-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        <label className="text-xs text-muted-foreground">{tAccounting("ledger.account")}</label>
        <select
          value={account}
          onChange={(event) => onAccountChange(event.target.value)}
          className="h-9 min-w-[240px] rounded-md border border-border bg-white px-3 text-sm"
        >
          {accounts.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-md border border-border bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">{tAccounting("ledger.debitTotal")}</p>
          <p className="mt-1 text-lg font-semibold text-finance">
            {formatCurrency(debitTotal, locale, "SAR")}
          </p>
        </article>
        <article className="rounded-md border border-border bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">{tAccounting("ledger.creditTotal")}</p>
          <p className="mt-1 text-lg font-semibold text-finance">
            {formatCurrency(creditTotal, locale, "SAR")}
          </p>
        </article>
        <article className="rounded-md border border-border bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">{tAccounting("ledger.movement")}</p>
          <p className="mt-1 text-lg font-semibold text-finance">
            {formatCurrency(movement, locale, "SAR")}
          </p>
        </article>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs text-slate-500 uppercase tracking-wider">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-start font-semibold">{tAccounting("journal.date")}</th>
                <th className="px-4 py-3 text-start font-semibold">{tAccounting("journal.reference")}</th>
                <th className="px-4 py-3 text-end font-semibold">{tAccounting("journal.debit")}</th>
                <th className="px-4 py-3 text-end font-semibold">{tAccounting("journal.credit")}</th>
                <th className="px-4 py-3 text-end font-semibold">{tAccounting("ledger.running")}</th>
                <th className="px-4 py-3 text-center font-semibold">{tAccounting("journal.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-slate-50">
                  <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(row.date, locale)}</td>
                  <td className="px-4 py-2.5 truncate max-w-[200px] text-slate-900">{row.reference}</td>
                  <td className="px-4 py-2.5 text-end font-mono text-xs">
                    {row.debit ? formatCurrency(row.debit, locale, row.currency) : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-end font-mono text-xs">
                    {row.credit ? formatCurrency(row.credit, locale, row.currency) : "-"}
                  </td>
                  <td className="px-4 py-2.5 text-end font-mono font-medium text-finance">
                    {formatCurrency(row.runningBalance, locale, row.currency)}
                  </td>
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
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p>{tAccounting("ledger.empty")}</p>
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
