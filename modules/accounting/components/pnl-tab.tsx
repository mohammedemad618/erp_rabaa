"use client";

import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/utils/format";

interface ProfitLossView {
  revenue: number;
  expense: number;
  netIncome: number;
  margin: number;
  byBranch: Array<{ key: string; revenue: number; expense: number; net: number }>;
  byAirline: Array<{ key: string; revenue: number; expense: number; net: number }>;
}

interface PnlTabProps {
  locale: string;
  data: ProfitLossView;
}

export function PnlTab({ locale, data }: PnlTabProps) {
  const tAccounting = useTranslations("accounting");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-slate-500">{tAccounting("pnl.revenue")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(data.revenue, locale, "SAR")}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-slate-500">{tAccounting("pnl.expense")}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatCurrency(data.expense, locale, "SAR")}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-slate-500">{tAccounting("pnl.netIncome")}</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {formatCurrency(data.netIncome, locale, "SAR")}
          </p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
          <p className="text-sm font-medium text-slate-500">{tAccounting("pnl.margin")}</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{data.margin}%</p>
        </article>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-900">
            {tAccounting("pnl.branchBreakdown")}
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byBranch}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" fill="#0f4c81" />
                <Bar dataKey="expense" fill="#c78312" />
                <Bar dataKey="net" fill="#0f9d7a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-slate-900">
            {tAccounting("pnl.airlineBreakdown")}
          </h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byAirline}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="net" fill="#2f3544" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
