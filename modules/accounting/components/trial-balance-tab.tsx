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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-slate-600">
          <thead className="bg-slate-50/80 text-xs text-slate-500 uppercase tracking-wider">
            <tr className="border-b border-slate-200">
              <th className="px-4 py-3 text-start font-semibold">{tAccounting("trialBalance.account")}</th>
              <th className="px-4 py-3 text-start font-semibold">{tAccounting("trialBalance.category")}</th>
              <th className="px-4 py-3 text-end font-semibold">{tAccounting("journal.debit")}</th>
              <th className="px-4 py-3 text-end font-semibold">{tAccounting("journal.credit")}</th>
              <th className="px-4 py-3 text-end font-semibold">{tAccounting("trialBalance.net")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.account} className="transition-colors hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">{row.account}</td>
                <td className="px-4 py-2.5">{tAccounting(`categories.${row.category}`)}</td>
                <td className="px-4 py-2.5 text-end font-mono text-xs">
                  {formatCurrency(row.debit, locale, "SAR")}
                </td>
                <td className="px-4 py-2.5 text-end font-mono text-xs">
                  {formatCurrency(row.credit, locale, "SAR")}
                </td>
                <td className="px-4 py-2.5 text-end font-mono font-medium text-finance">
                  {formatCurrency(row.net, locale, "SAR")}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <p>{tAccounting("trialBalance.empty")}</p>
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50/80 font-semibold text-finance">
              <td className="px-4 py-3" colSpan={2}>
                Total
              </td>
              <td className="px-4 py-3 text-end font-mono text-xs">
                {formatCurrency(totalDebit, locale, "SAR")}
              </td>
              <td className="px-4 py-3 text-end font-mono text-xs">
                {formatCurrency(totalCredit, locale, "SAR")}
              </td>
              <td className="px-4 py-3 text-end font-mono font-medium">
                {formatCurrency(Math.abs(totalDebit - totalCredit), locale, "SAR")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
