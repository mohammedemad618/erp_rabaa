"use client";

import dynamic from "next/dynamic";
import { formatCurrency, type CurrencyFormatOptions } from "@/utils/format";

const StatusPieChart = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.StatusPieChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const AirlineBarChart = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.AirlineBarChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);
const SalesTrendChart = dynamic(
  () => import("@/components/dashboard/dashboard-charts").then((m) => m.SalesTrendChart),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

function ChartSkeleton() {
  return (
    <div className="flex h-[220px] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

interface StatusItem {
  label: string;
  count: number;
  color: string;
}

interface AirlineItem {
  airline: string;
  amount: number;
}

interface TrendItem {
  hour: string;
  amount: number;
}

interface RecentTx {
  id: string;
  customerName: string;
  airline: string;
  totalAmount: number;
  currency: string;
  status: string;
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  paid: "bg-blue-100 text-blue-700",
  receipt_issued: "bg-indigo-100 text-indigo-700",
  refunded: "bg-rose-100 text-rose-700",
  voided: "bg-slate-200 text-slate-500",
  ocr_reviewed: "bg-cyan-100 text-cyan-700",
  pending_payment: "bg-orange-100 text-orange-700",
};

interface ServiceRevenueItem {
  name: string;
  revenue: number;
  count: number;
  color: string;
}

interface DashboardWidgetsProps {
  locale: string;
  statusBreakdown: StatusItem[];
  airlineData: AirlineItem[];
  trendData: TrendItem[];
  recentTransactions: RecentTx[];
  servicesRevenue: ServiceRevenueItem[];
  currencyOptions?: CurrencyFormatOptions;
}

export function DashboardWidgets({
  locale,
  statusBreakdown,
  airlineData,
  trendData,
  recentTransactions,
  servicesRevenue,
  currencyOptions,
}: DashboardWidgetsProps) {
  const isAr = locale === "ar";

  return (
    <>
      <div className="col-span-12 grid gap-4 xl:grid-cols-3">
        <section className="surface-card p-5">
          <h3 className="text-sm font-semibold text-finance">
            {isAr ? "\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u062D\u0627\u0644\u0627\u062A" : "Status Distribution"}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isAr ? "\u062D\u0633\u0628 \u062D\u0627\u0644\u0629 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629" : "By transaction status"}
          </p>
          <StatusPieChart data={statusBreakdown} />
          <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
            {statusBreakdown.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
                <span className="text-[10px] font-semibold text-finance">{item.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-5">
          <h3 className="text-sm font-semibold text-finance">
            {isAr ? "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0634\u0631\u0643\u0627\u062A \u0627\u0644\u0637\u064A\u0631\u0627\u0646" : "Airline Revenue"}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isAr ? "\u0623\u0639\u0644\u0649 \u0627\u0644\u0634\u0631\u0643\u0627\u062A \u062D\u0633\u0628 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A" : "Top airlines by revenue"}
          </p>
          <AirlineBarChart data={airlineData} />
        </section>

        <section className="surface-card p-5">
          <h3 className="text-sm font-semibold text-finance">
            {isAr ? "\u0627\u062A\u062C\u0627\u0647 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A" : "Sales Trend"}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isAr ? "\u062D\u062C\u0645 \u0627\u0644\u0645\u0628\u064A\u0639\u0627\u062A \u0643\u0644 \u0633\u0627\u0639\u0629" : "Hourly sales volume"}
          </p>
          <SalesTrendChart data={trendData} />
        </section>
      </div>

      <section className="surface-card col-span-12 p-5">
        <h3 className="text-sm font-semibold text-finance">
          {isAr ? "\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u0627\u0644\u062E\u062F\u0645\u0627\u062A \u0627\u0644\u0633\u064A\u0627\u062D\u064A\u0629" : "Travel Services Revenue"}
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {isAr ? "\u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0625\u064A\u0631\u0627\u062F\u0627\u062A \u062D\u0633\u0628 \u0646\u0648\u0639 \u0627\u0644\u062E\u062F\u0645\u0629" : "Revenue breakdown by service type"}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {servicesRevenue.map((svc) => (
            <div key={svc.name} className="rounded-lg border border-border/60 bg-slate-50/50 p-3 transition hover:shadow-sm">
              <p className="text-[11px] font-medium text-muted-foreground">{svc.name}</p>
              <p className="mt-1 text-base font-bold text-finance">
                {formatCurrency(svc.revenue, locale, "SAR", currencyOptions)}
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{svc.count} {isAr ? "\u062D\u062C\u0632" : "bookings"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card col-span-12 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-finance">
              {isAr ? "\u0623\u062D\u062F\u062B \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A" : "Recent Transactions"}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {isAr ? "\u0622\u062E\u0631 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0627\u0644\u0645\u0633\u062C\u0644\u0629 \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645" : "Latest transactions recorded in the system"}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-start font-medium">ID</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "\u0627\u0644\u0639\u0645\u064A\u0644" : "Customer"}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "\u0634\u0631\u0643\u0629 \u0627\u0644\u0637\u064A\u0631\u0627\u0646" : "Airline"}</th>
                <th className="px-3 py-2.5 text-end font-medium">{isAr ? "\u0627\u0644\u0645\u0628\u0644\u063A" : "Amount"}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "\u0627\u0644\u062D\u0627\u0644\u0629" : "Status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 font-medium text-finance">{tx.id}</td>
                  <td className="px-3 py-2.5 text-finance">{tx.customerName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{tx.airline}</td>
                  <td className="px-3 py-2.5 text-end font-semibold text-finance">
                    {formatCurrency(tx.totalAmount, locale, tx.currency, currencyOptions)}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[tx.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {tx.status.replace(/_/g, " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}


