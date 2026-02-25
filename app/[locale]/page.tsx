import { Link } from "@/i18n/navigation";
import {
  ErpKpiGrid,
  ErpPageHeader,
  ErpPageLayout,
} from "@/components/layout/erp-page-layout";
import {
  deserializeExchangeRates,
  DISPLAY_CURRENCY_COOKIE_KEY,
  EXCHANGE_RATES_COOKIE_KEY,
} from "@/modules/settings/settings-config";
import { requirePermission } from "@/services/auth/server-guards";
import { transactionService } from "@/services/transaction-service";
import { getServiceStats } from "@/modules/services/services-store";
import { SERVICE_CATEGORIES } from "@/modules/services/types";
import { formatCurrency } from "@/utils/format";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { DashboardWidgets } from "./dashboard-widgets";

export const dynamic = "force-dynamic";

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

function decodeCookieValue(value?: string): string | null {
  if (!value) {
    return null;
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale: routeLocale } = await params;
  await requirePermission(routeLocale, "dashboard.view", `/${routeLocale}`);
  const [tDashboard, transactions, locale, cookieStore] = await Promise.all([
    getTranslations("dashboard"),
    transactionService.list(),
    getLocale(),
    cookies(),
  ]);
  const displayCurrency = cookieStore.get(DISPLAY_CURRENCY_COOKIE_KEY)?.value;
  const exchangeRates = deserializeExchangeRates(
    decodeCookieValue(cookieStore.get(EXCHANGE_RATES_COOKIE_KEY)?.value),
  );

  const salesToday = transactions
    .slice(0, 180)
    .reduce((sum, transaction) => sum + transaction.totalAmount, 0);
  const pendingApprovals = transactions.filter(
    (transaction) => transaction.status === "pending_approval",
  ).length;
  const openRefunds = transactions.filter(
    (transaction) => transaction.status === "refunded",
  ).length;
  const approvedCount = transactions.filter(
    (transaction) => transaction.status === "approved",
  ).length;
  const paidCount = transactions.filter(
    (transaction) => transaction.status === "paid",
  ).length;
  const draftCount = transactions.filter(
    (transaction) => transaction.status === "draft",
  ).length;

  const kpiCards = [
    {
      label: tDashboard("kpi.salesToday"),
      value: formatCurrency(salesToday, locale, "SAR", {
        displayCurrency,
        exchangeRates: exchangeRates ?? undefined,
      }),
      accent: "bg-blue-50 border-blue-200",
      trend: "+12.3%",
      trendUp: true,
    },
    {
      label: tDashboard("kpi.pendingApprovals"),
      value: pendingApprovals.toString(),
      accent: pendingApprovals > 200 ? "bg-amber-50 border-amber-200" : "bg-white border-border",
      trend: pendingApprovals > 200 ? "High" : "Normal",
      trendUp: false,
    },
    {
      label: tDashboard("kpi.openRefunds"),
      value: openRefunds.toString(),
      accent: openRefunds > 200 ? "bg-rose-50 border-rose-200" : "bg-white border-border",
      trend: "-3.1%",
      trendUp: true,
    },
    {
      label: tDashboard("kpi.ocrLatency"),
      value: "1.3s",
      accent: "bg-emerald-50 border-emerald-200",
      trend: "Optimal",
      trendUp: true,
    },
  ];

  const statusBreakdown = [
    { label: "Draft", count: draftCount, color: "#94a3b8" },
    { label: "Pending", count: pendingApprovals, color: "#f59e0b" },
    { label: "Approved", count: approvedCount, color: "#10b981" },
    { label: "Paid", count: paidCount, color: "#3b82f6" },
    { label: "Refunded", count: openRefunds, color: "#ef4444" },
  ];

  const airlineRevenue: Record<string, number> = {};
  for (const tx of transactions.slice(0, 500)) {
    airlineRevenue[tx.airline] = (airlineRevenue[tx.airline] ?? 0) + tx.totalAmount;
  }
  const airlineData = Object.entries(airlineRevenue)
    .map(([airline, amount]) => ({ airline, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);

  const hourlyBuckets: Record<string, number> = {};
  for (const tx of transactions.slice(0, 300)) {
    const h = new Date(tx.createdAt).getHours();
    const label = `${h.toString().padStart(2, "0")}:00`;
    hourlyBuckets[label] = (hourlyBuckets[label] ?? 0) + tx.totalAmount;
  }
  const trendData = Object.entries(hourlyBuckets)
    .map(([hour, amount]) => ({ hour, amount: Math.round(amount) }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  const recentTransactions = transactions.slice(0, 6).map((tx) => ({
    id: tx.id,
    customerName: tx.customerName,
    airline: tx.airline,
    totalAmount: tx.totalAmount,
    currency: tx.currency,
    status: tx.status,
  }));

  const serviceStats = getServiceStats();
  const servicesRevenue = SERVICE_CATEGORIES.map((cat) => ({
    name: locale === "ar" ? cat.labelAr : cat.labelEn,
    revenue: serviceStats[cat.id]?.revenue ?? 0,
    count: serviceStats[cat.id]?.count ?? 0,
    color: cat.color.replace("text-", ""),
  }));

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={tDashboard("title")}
        description={tDashboard("description")}
        actions={
          <Link
            href="/transactions"
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-blue-700 hover:shadow-lg"
          >
            {tDashboard("cta")}
          </Link>
        }
      />

      <ErpKpiGrid>
        {kpiCards.map((kpi) => (
          <article key={kpi.label} className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${kpi.accent}`}>
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-muted-foreground">{kpi.label}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kpi.trendUp ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                {kpi.trend}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold tracking-tight text-finance">{kpi.value}</p>
          </article>
        ))}
      </ErpKpiGrid>

      <DashboardWidgets
        locale={locale}
        statusBreakdown={statusBreakdown}
        airlineData={airlineData}
        trendData={trendData}
        recentTransactions={recentTransactions}
        servicesRevenue={servicesRevenue}
      />
    </ErpPageLayout>
  );
}
