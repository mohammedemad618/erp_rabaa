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
import { formatCurrency } from "@/utils/format";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

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

  const kpiCards = [
    {
      label: tDashboard("kpi.salesToday"),
      value: formatCurrency(salesToday, locale, "SAR", {
        displayCurrency,
        exchangeRates: exchangeRates ?? undefined,
      }),
      accent: "bg-blue-50 border-blue-200",
    },
    {
      label: tDashboard("kpi.pendingApprovals"),
      value: pendingApprovals.toString(),
      accent: pendingApprovals > 200 ? "bg-amber-50 border-amber-200" : "bg-white border-border",
    },
    {
      label: tDashboard("kpi.openRefunds"),
      value: openRefunds.toString(),
      accent: openRefunds > 200 ? "bg-rose-50 border-rose-200" : "bg-white border-border",
    },
    {
      label: tDashboard("kpi.ocrLatency"),
      value: "1.3s",
      accent: "bg-white border-border",
    },
  ];

  const recentTransactions = transactions.slice(0, 8);

  const statusBreakdown = [
    { label: "Draft", count: transactions.filter((t) => t.status === "draft").length, color: "bg-slate-200" },
    { label: "Pending Approval", count: pendingApprovals, color: "bg-amber-400" },
    { label: "Approved", count: transactions.filter((t) => t.status === "approved").length, color: "bg-emerald-400" },
    { label: "Paid", count: transactions.filter((t) => t.status === "paid").length, color: "bg-blue-400" },
    { label: "Refunded", count: openRefunds, color: "bg-rose-400" },
  ];
  const statusTotal = statusBreakdown.reduce((s, b) => s + b.count, 0) || 1;

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={tDashboard("title")}
        description={tDashboard("description")}
        actions={
          <Link
            href="/transactions"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:opacity-95"
          >
            {tDashboard("cta")}
          </Link>
        }
      />

      <ErpKpiGrid>
        {kpiCards.map((kpi) => (
          <article key={kpi.label} className={`rounded-lg border p-4 ${kpi.accent}`}>
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="mt-2 text-2xl font-bold text-finance">{kpi.value}</p>
          </article>
        ))}
      </ErpKpiGrid>

      <div className="col-span-12 grid gap-4 xl:grid-cols-2">
        <section className="surface-card p-5">
          <h3 className="text-sm font-semibold text-finance">{locale === "ar" ? "توزيع الحالات" : "Status Breakdown"}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">{locale === "ar" ? "توزيع حالات المعاملات الحالية" : "Current transaction status distribution"}</p>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full">
            {statusBreakdown.map((item) => (
              <div
                key={item.label}
                className={`${item.color} transition-all`}
                style={{ width: `${(item.count / statusTotal) * 100}%` }}
                title={`${item.label}: ${item.count}`}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {statusBreakdown.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${item.color}`} />
                <span className="text-xs text-muted-foreground">{item.label}</span>
                <span className="text-xs font-medium text-finance">{item.count}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="surface-card p-5">
          <h3 className="text-sm font-semibold text-finance">{locale === "ar" ? "أحدث المعاملات" : "Recent Activity"}</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">{locale === "ar" ? "آخر 8 معاملات في النظام" : "Latest 8 transactions"}</p>
          <div className="mt-3 divide-y divide-border">
            {recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-xs font-medium text-finance">{tx.customerName}</p>
                  <p className="text-[11px] text-muted-foreground">{tx.airline} &middot; {tx.id}</p>
                </div>
                <p className="text-xs font-semibold text-finance">{formatCurrency(tx.totalAmount, locale, tx.currency)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </ErpPageLayout>
  );
}
