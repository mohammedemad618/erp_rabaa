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
      <div className="grid gap-3 md:grid-cols-3">
        <article className="rounded-md border border-border bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">{tAccounting("balanceSheet.assets")}</p>
          <p className="mt-1 text-lg font-semibold text-finance">
            {formatCurrency(data.assets, locale, "SAR")}
          </p>
        </article>
        <article className="rounded-md border border-border bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">
            {tAccounting("balanceSheet.liabilities")}
          </p>
          <p className="mt-1 text-lg font-semibold text-finance">
            {formatCurrency(data.liabilities, locale, "SAR")}
          </p>
        </article>
        <article className="rounded-md border border-border bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">{tAccounting("balanceSheet.equity")}</p>
          <p className="mt-1 text-lg font-semibold text-finance">
            {formatCurrency(data.equity, locale, "SAR")}
          </p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <section className="overflow-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2 text-start">{tAccounting("trialBalance.account")}</th>
                <th className="px-2 py-2 text-start">{tAccounting("trialBalance.category")}</th>
                <th className="px-2 py-2 text-end">{tAccounting("balanceSheet.balance")}</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={`${row.account}-${row.category}`} className="border-b border-border/70">
                  <td className="px-2 py-2">{row.account}</td>
                  <td className="px-2 py-2">{tAccounting(`categories.${row.category}`)}</td>
                  <td className="px-2 py-2 text-end font-medium text-finance">
                    {formatCurrency(row.balance, locale, "SAR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-md border border-border p-3">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-finance">
            <BarChart3 className="h-4 w-4" />
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
