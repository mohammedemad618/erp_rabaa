"use client";

import { useTranslations } from "next-intl";
import { formatCurrency, formatDate } from "@/utils/format";

const ENTRY_STATE_STYLE = {
  draft: "bg-slate-100 text-slate-700",
  posted: "bg-emerald-100 text-emerald-700",
  reversed: "bg-amber-100 text-amber-700",
} as const;

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

      <div className="overflow-auto rounded-md border border-border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2 text-start">{tAccounting("journal.date")}</th>
              <th className="px-2 py-2 text-start">{tAccounting("journal.reference")}</th>
              <th className="px-2 py-2 text-end">{tAccounting("journal.debit")}</th>
              <th className="px-2 py-2 text-end">{tAccounting("journal.credit")}</th>
              <th className="px-2 py-2 text-end">{tAccounting("ledger.running")}</th>
              <th className="px-2 py-2 text-start">{tAccounting("journal.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/70">
                <td className="px-2 py-2">{formatDate(row.date, locale)}</td>
                <td className="px-2 py-2">{row.reference}</td>
                <td className="px-2 py-2 text-end">
                  {row.debit ? formatCurrency(row.debit, locale, row.currency) : "-"}
                </td>
                <td className="px-2 py-2 text-end">
                  {row.credit ? formatCurrency(row.credit, locale, row.currency) : "-"}
                </td>
                <td className="px-2 py-2 text-end font-medium text-finance">
                  {formatCurrency(row.runningBalance, locale, row.currency)}
                </td>
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
                <td colSpan={6} className="px-2 py-8 text-center text-muted-foreground">
                  {tAccounting("ledger.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
