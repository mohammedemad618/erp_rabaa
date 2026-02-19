"use client";

import { useTranslations } from "next-intl";
import type { TrialBalanceRow } from "../types";
import { formatCurrency } from "@/utils/format";

interface TrialBalanceTabProps {
  rows: TrialBalanceRow[];
  locale: string;
  totalDebit: number;
  totalCredit: number;
}

export function TrialBalanceTab({
  rows,
  locale,
  totalDebit,
  totalCredit,
}: TrialBalanceTabProps) {
  const tAccounting = useTranslations("accounting");

  return (
    <div className="overflow-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-white">
          <tr className="border-b border-border text-muted-foreground">
            <th className="px-2 py-2 text-start">{tAccounting("trialBalance.account")}</th>
            <th className="px-2 py-2 text-start">{tAccounting("trialBalance.category")}</th>
            <th className="px-2 py-2 text-end">{tAccounting("journal.debit")}</th>
            <th className="px-2 py-2 text-end">{tAccounting("journal.credit")}</th>
            <th className="px-2 py-2 text-end">{tAccounting("trialBalance.net")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.account} className="border-b border-border/70">
              <td className="px-2 py-2">{row.account}</td>
              <td className="px-2 py-2">{tAccounting(`categories.${row.category}`)}</td>
              <td className="px-2 py-2 text-end">
                {formatCurrency(row.debit, locale, "SAR")}
              </td>
              <td className="px-2 py-2 text-end">
                {formatCurrency(row.credit, locale, "SAR")}
              </td>
              <td className="px-2 py-2 text-end font-medium text-finance">
                {formatCurrency(row.net, locale, "SAR")}
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">
                {tAccounting("trialBalance.empty")}
              </td>
            </tr>
          ) : null}
        </tbody>
        <tfoot>
          <tr className="border-t border-border bg-slate-50 font-semibold text-finance">
            <td className="px-2 py-2" colSpan={2}>
              Total
            </td>
            <td className="px-2 py-2 text-end">
              {formatCurrency(totalDebit, locale, "SAR")}
            </td>
            <td className="px-2 py-2 text-end">
              {formatCurrency(totalCredit, locale, "SAR")}
            </td>
            <td className="px-2 py-2 text-end">
              {formatCurrency(Math.abs(totalDebit - totalCredit), locale, "SAR")}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
