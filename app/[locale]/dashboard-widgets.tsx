"use client";

import dynamic from "next/dynamic";
import { formatCurrency } from "@/utils/format";

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
}

export function DashboardWidgets({
  locale,
  statusBreakdown,
  airlineData,
  trendData,
  recentTransactions,
  servicesRevenue,
}: DashboardWidgetsProps) {
  const isAr = locale === "ar";

  return (
    <>
      <div className="col-span-12 grid gap-4 xl:grid-cols-3">
        <section className="surface-card p-5">
          <h3 className="text-sm font-semibold text-finance">
            {isAr ? "توزيع الحالات" : "Status Distribution"}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isAr ? "حسب حالة المعاملة" : "By transaction status"}
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
            {isAr ? "إيرادات شركات الطيران" : "Airline Revenue"}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isAr ? "أعلى الشركات حسب الإيرادات" : "Top airlines by revenue"}
          </p>
          <AirlineBarChart data={airlineData} />
        </section>

        <section className="surface-card p-5">
          <h3 className="text-sm font-semibold text-finance">
            {isAr ? "اتجاه المبيعات" : "Sales Trend"}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {isAr ? "حجم المبيعات كل ساعة" : "Hourly sales volume"}
          </p>
          <SalesTrendChart data={trendData} />
        </section>
      </div>

      <section className="surface-card col-span-12 p-5">
        <h3 className="text-sm font-semibold text-finance">
          {isAr ? "إيرادات الخدمات السياحية" : "Travel Services Revenue"}
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {isAr ? "توزيع الإيرادات حسب نوع الخدمة" : "Revenue breakdown by service type"}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {servicesRevenue.map((svc) => (
            <div key={svc.name} className="rounded-lg border border-border/60 bg-slate-50/50 p-3 transition hover:shadow-sm">
              <p className="text-[11px] font-medium text-muted-foreground">{svc.name}</p>
              <p className="mt-1 text-base font-bold text-finance">SAR {svc.revenue.toLocaleString()}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{svc.count} {isAr ? "حجز" : "bookings"}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card col-span-12 p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-finance">
              {isAr ? "أحدث المعاملات" : "Recent Transactions"}
            </h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {isAr ? "آخر المعاملات المسجلة في النظام" : "Latest transactions recorded in the system"}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-start font-medium">ID</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "العميل" : "Customer"}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "شركة الطيران" : "Airline"}</th>
                <th className="px-3 py-2.5 text-end font-medium">{isAr ? "المبلغ" : "Amount"}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {recentTransactions.map((tx) => (
                <tr key={tx.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-3 py-2.5 font-medium text-finance">{tx.id}</td>
                  <td className="px-3 py-2.5 text-finance">{tx.customerName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{tx.airline}</td>
                  <td className="px-3 py-2.5 text-end font-semibold text-finance">
                    {formatCurrency(tx.totalAmount, locale, tx.currency)}
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
