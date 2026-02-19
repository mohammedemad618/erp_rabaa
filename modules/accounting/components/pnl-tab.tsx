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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-md border border-border bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">{tAccounting("pnl.revenue")}</p>
          <p className="mt-1 text-lg font-semibold text-finance">
            {formatCurrency(data.revenue, locale, "SAR")}
          </p>
        </article>
        <article className="rounded-md border border-border bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">{tAccounting("pnl.expense")}</p>
          <p className="mt-1 text-lg font-semibold text-finance">
            {formatCurrency(data.expense, locale, "SAR")}
          </p>
        </article>
        <article className="rounded-md border border-border bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">{tAccounting("pnl.netIncome")}</p>
          <p className="mt-1 text-lg font-semibold text-finance">
            {formatCurrency(data.netIncome, locale, "SAR")}
          </p>
        </article>
        <article className="rounded-md border border-border bg-slate-50 p-3">
          <p className="text-xs text-muted-foreground">{tAccounting("pnl.margin")}</p>
          <p className="mt-1 text-lg font-semibold text-finance">{data.margin}%</p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-md border border-border p-3">
          <h3 className="mb-2 text-sm font-semibold text-finance">
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

        <section className="rounded-md border border-border p-3">
          <h3 className="mb-2 text-sm font-semibold text-finance">
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
