"use client";

import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { BalanceSheetRow } from "../types";
import { formatCurrency } from "@/utils/format";

const BALANCE_SHEET_COLORS = ["#0f4c81", "#0f9d7a", "#c78312"];

interface BalanceSheetView {
  assets: number;
  liabilities: number;
  equity: number;
  rows: BalanceSheetRow[];
}

interface BalanceSheetTabProps {
  locale: string;
  data: BalanceSheetView;
}

export function BalanceSheetTab({ locale, data }: BalanceSheetTabProps) {
  const tAccounting = useTranslations("accounting");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-slate-500">{tAccounting("balanceSheet.assets")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(data.assets, locale, "SAR")}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-slate-500">
            {tAccounting("balanceSheet.liabilities")}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(data.liabilities, locale, "SAR")}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-slate-500">{tAccounting("balanceSheet.equity")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(data.equity, locale, "SAR")}
          </p>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-start font-semibold">{tAccounting("trialBalance.account")}</th>
                  <th className="px-4 py-3 text-start font-semibold">{tAccounting("trialBalance.category")}</th>
                  <th className="px-4 py-3 text-end font-semibold">{tAccounting("balanceSheet.balance")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.rows.map((row) => (
                  <tr key={`${row.account}-${row.category}`} className="transition-colors hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.account}</td>
                    <td className="px-4 py-2.5">{tAccounting(`categories.${row.category}`)}</td>
                    <td className="px-4 py-2.5 text-end font-mono text-xs font-medium text-finance">
                      {formatCurrency(row.balance, locale, "SAR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
            <BarChart3 className="h-5 w-5 text-slate-500" />
            {tAccounting("balanceSheet.structure")}
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    {
                      name: tAccounting("balanceSheet.assets"),
                      value: Math.abs(data.assets),
                    },
                    {
                      name: tAccounting("balanceSheet.liabilities"),
                      value: Math.abs(data.liabilities),
                    },
                    {
                      name: tAccounting("balanceSheet.equity"),
                      value: Math.abs(data.equity),
                    },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label
                >
                  {BALANCE_SHEET_COLORS.map((color) => (
                    <Cell key={color} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
