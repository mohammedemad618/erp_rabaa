import { Link } from "@/i18n/navigation";
import {
  deserializeExchangeRates,
  DISPLAY_CURRENCY_COOKIE_KEY,
  EXCHANGE_RATES_COOKIE_KEY,
} from "@/modules/settings/settings-config";
import { transactionService } from "@/services/transaction-service";
import { formatCurrency } from "@/utils/format";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

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

export default async function DashboardPage() {
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
    },
    {
      label: tDashboard("kpi.pendingApprovals"),
      value: pendingApprovals.toString(),
    },
    {
      label: tDashboard("kpi.openRefunds"),
      value: openRefunds.toString(),
    },
    {
      label: tDashboard("kpi.ocrLatency"),
      value: "1.3s",
    },
  ];

  return (
    <section className="space-y-4">
      <header className="surface-card p-6">
        <h2 className="text-2xl font-bold text-finance">{tDashboard("title")}</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          {tDashboard("description")}
        </p>
        <Link
          href="/transactions"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:opacity-95"
        >
          {tDashboard("cta")}
        </Link>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((kpi) => (
          <article key={kpi.label} className="surface-card p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="mt-2 text-2xl font-bold text-finance">{kpi.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
