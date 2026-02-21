"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  ErpKpiGrid,
  ErpPageHeader,
  ErpPageLayout,
  ErpSection,
} from "@/components/layout/erp-page-layout";
import { formatCurrency, formatDate } from "@/utils/format";
import type { CrmDataset, CustomerProfile, CustomerRiskLevel } from "../types";

type RiskFilter = "all" | CustomerRiskLevel;

const riskClass = {
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-rose-100 text-rose-700",
} as const;

const segmentClass = {
  starter: "bg-slate-100 text-slate-700",
  growth: "bg-blue-100 text-blue-700",
  strategic: "bg-indigo-100 text-indigo-700",
} as const;

interface CrmConsoleProps {
  dataset: CrmDataset;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function maxAgingAmount(customer: CustomerProfile | null): number {
  if (!customer) {
    return 1;
  }
  return (
    customer.aging.reduce((max, bucket) => Math.max(max, bucket.amount), 0) || 1
  );
}

export function CrmConsole({ dataset }: CrmConsoleProps) {
  const tCrm = useTranslations("crmModule");
  const tTx = useTranslations("transactions");
  const locale = useLocale();

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("all");
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    dataset.customers[0]?.id ?? "",
  );

  const query = normalize(search);

  const filteredCustomers = useMemo(() => {
    return dataset.customers.filter((customer) => {
      if (riskFilter !== "all" && customer.credit.riskLevel !== riskFilter) {
        return false;
      }
      if (!query) {
        return true;
      }

      return (
        customer.name.toLowerCase().includes(query) ||
        customer.phone.toLowerCase().includes(query) ||
        customer.preferredAirline.toLowerCase().includes(query)
      );
    });
  }, [dataset.customers, query, riskFilter]);

  const selectedCustomer =
    filteredCustomers.find((customer) => customer.id === selectedCustomerId) ??
    filteredCustomers[0] ??
    null;

  const portfolioOutstanding = useMemo(
    () =>
      filteredCustomers.reduce(
        (sum, customer) => sum + customer.outstandingAmount,
        0,
      ),
    [filteredCustomers],
  );
  const highRiskCount = useMemo(
    () =>
      filteredCustomers.filter(
        (customer) => customer.credit.riskLevel === "high",
      ).length,
    [filteredCustomers],
  );

  const displayedTimeline = selectedCustomer?.timeline.slice(0, 18) ?? [];
  const maxAging = maxAgingAmount(selectedCustomer);

  return (
    <ErpPageLayout>
      <ErpPageHeader title={tCrm("title")} description={tCrm("subtitle")} />

      <ErpSection
        className="col-span-12 no-print"
        title={locale === "ar" ? "عناصر قابلة للتنفيذ" : "Actionable Controls"}
      >
        <div className="grid gap-2 md:grid-cols-[1.4fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tCrm("filters.searchPlaceholder")}
              className="h-9 w-full rounded-md border border-border bg-white ps-8 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <select
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            <option value="all">{tCrm("filters.allRiskLevels")}</option>
            <option value="low">{tCrm("risk.low")}</option>
            <option value="medium">{tCrm("risk.medium")}</option>
            <option value="high">{tCrm("risk.high")}</option>
          </select>
        </div>
      </ErpSection>

      <ErpKpiGrid>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tCrm("kpi.customers")}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{filteredCustomers.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tCrm("kpi.totalSales")}</p>
          <p className="mt-2 text-xl font-bold text-finance">
            {formatCurrency(
              filteredCustomers.reduce((sum, customer) => sum + customer.totalSales, 0),
              locale,
              "SAR",
            )}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tCrm("kpi.outstanding")}</p>
          <p className="mt-2 text-xl font-bold text-finance">
            {formatCurrency(portfolioOutstanding, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tCrm("kpi.highRisk")}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{highRiskCount}</p>
        </article>
      </ErpKpiGrid>

      <div className="col-span-12 grid gap-4 xl:grid-cols-[330px_1fr]">
        <section className="surface-card overflow-hidden">
          <header className="border-b border-border bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-finance">{tCrm("customers.title")}</h3>
          </header>
          <div className="max-h-[760px] overflow-auto p-2">
            {filteredCustomers.map((customer) => {
              const active = selectedCustomer?.id === customer.id;
              return (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className={`mb-2 w-full rounded-md border px-3 py-3 text-start transition ${
                    active
                      ? "border-primary bg-blue-50"
                      : "border-border bg-white hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-finance">
                    <bdi>{customer.name}</bdi>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <bdi>{customer.phone}</bdi>
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {customer.totalBookings} {tCrm("customers.bookings")}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${
                        riskClass[customer.credit.riskLevel]
                      }`}
                    >
                      {tCrm(`risk.${customer.credit.riskLevel}`)}
                    </span>
                  </div>
                </button>
              );
            })}
            {!filteredCustomers.length ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                {tCrm("empty.customers")}
              </p>
            ) : null}
          </div>
        </section>

        <div className="space-y-4">
          {!selectedCustomer ? (
            <section className="surface-card p-6 text-sm text-muted-foreground">
              {tCrm("empty.selection")}
            </section>
          ) : (
            <>
              <section className="surface-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-finance">
                      <bdi>{selectedCustomer.name}</bdi>
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <bdi>{selectedCustomer.phone}</bdi>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        segmentClass[selectedCustomer.segment]
                      }`}
                    >
                      {tCrm(`segment.${selectedCustomer.segment}`)}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                        riskClass[selectedCustomer.credit.riskLevel]
                      }`}
                    >
                      {tCrm(`risk.${selectedCustomer.credit.riskLevel}`)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <article className="rounded-md border border-border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">
                      {tCrm("profile.preferredAirline")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-finance">
                      {selectedCustomer.preferredAirline}
                    </p>
                  </article>
                  <article className="rounded-md border border-border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">{tCrm("profile.lastBooking")}</p>
                    <p className="mt-1 text-sm font-semibold text-finance">
                      {formatDate(selectedCustomer.lastBookingAt, locale)}
                    </p>
                  </article>
                  <article className="rounded-md border border-border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">{tCrm("profile.totalBookings")}</p>
                    <p className="mt-1 text-sm font-semibold text-finance">
                      {selectedCustomer.totalBookings}
                    </p>
                  </article>
                  <article className="rounded-md border border-border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">{tCrm("profile.avgTicket")}</p>
                    <p className="mt-1 text-sm font-semibold text-finance">
                      {formatCurrency(selectedCustomer.averageTicket, locale, "SAR")}
                    </p>
                  </article>
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {tCrm("profile.branches")}: {selectedCustomer.branches.join(", ")}
                </p>
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                <section className="surface-card p-4">
                  <h3 className="text-sm font-semibold text-finance">
                    {tCrm("credit.title")}
                  </h3>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>{tCrm("credit.limit")}</span>
                      <span className="font-medium text-finance">
                        {formatCurrency(selectedCustomer.credit.limit, locale, "SAR")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{tCrm("credit.exposure")}</span>
                      <span className="font-medium text-finance">
                        {formatCurrency(selectedCustomer.credit.exposure, locale, "SAR")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>{tCrm("credit.available")}</span>
                      <span className="font-medium text-finance">
                        {formatCurrency(selectedCustomer.credit.available, locale, "SAR")}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{tCrm("credit.utilization")}</span>
                      <span>{selectedCustomer.credit.utilization}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${
                          selectedCustomer.credit.riskLevel === "high"
                            ? "bg-danger"
                            : selectedCustomer.credit.riskLevel === "medium"
                              ? "bg-warning"
                              : "bg-success"
                        }`}
                        style={{
                          width: `${Math.min(selectedCustomer.credit.utilization, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </section>

                <section className="surface-card p-4">
                  <h3 className="text-sm font-semibold text-finance">
                    {tCrm("aging.title")}
                  </h3>
                  <div className="mt-3 space-y-3">
                    {selectedCustomer.aging.map((bucket) => (
                      <div key={bucket.bucket}>
                        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                          <span>{bucket.label}</span>
                          <span>
                            {bucket.count} |{" "}
                            {formatCurrency(bucket.amount, locale, "SAR")}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{
                              width: `${Math.min((bucket.amount / maxAging) * 100, 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <section className="surface-card overflow-hidden">
                <header className="border-b border-border bg-slate-50 px-4 py-3">
                  <h3 className="text-sm font-semibold text-finance">
                    {tCrm("timeline.title")}
                  </h3>
                </header>
                <div className="max-h-[340px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="px-2 py-2 text-start">{tCrm("timeline.date")}</th>
                        <th className="px-2 py-2 text-start">{tCrm("timeline.ticket")}</th>
                        <th className="px-2 py-2 text-start">{tCrm("timeline.airline")}</th>
                        <th className="px-2 py-2 text-start">{tCrm("timeline.agent")}</th>
                        <th className="px-2 py-2 text-end">{tCrm("timeline.amount")}</th>
                        <th className="px-2 py-2 text-start">{tCrm("timeline.status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedTimeline.map((item) => (
                        <tr key={item.id} className="border-b border-border/70">
                          <td className="px-2 py-2">{formatDate(item.date, locale)}</td>
                          <td className="px-2 py-2 font-medium text-finance">
                            {item.ticketNumber}
                          </td>
                          <td className="px-2 py-2">{item.airline}</td>
                          <td className="px-2 py-2">{item.agent}</td>
                          <td className="px-2 py-2 text-end">
                            {formatCurrency(item.amount, locale, item.currency)}
                          </td>
                          <td className="px-2 py-2">
                            {tTx(`statusValues.${item.status}`)}
                          </td>
                        </tr>
                      ))}
                      {!displayedTimeline.length ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-2 py-8 text-center text-muted-foreground"
                          >
                            {tCrm("empty.timeline")}
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </ErpPageLayout>
  );
}
