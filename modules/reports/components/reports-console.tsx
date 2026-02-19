"use client";

import dynamic from "next/dynamic";
import { Download, FileSpreadsheet, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/format";
import type {
  CashFlowPoint,
  DatePreset,
  DrillType,
  HeatmapCell,
  HourBucket,
  MarginRow,
  ReportTransactionRow,
  ReportingDataset,
} from "../types";

const ReportsVisuals = dynamic(
  () => import("./reports-visuals").then((mod) => mod.ReportsVisuals),
  {
    ssr: false,
    loading: () => (
      <section className="surface-card p-4">
        <p className="text-sm text-muted-foreground">Loading BI visuals...</p>
      </section>
    ),
  },
);

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_BUCKETS: HourBucket[] = ["00_05", "06_11", "12_17", "18_23"];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function presetStart(maxDate: string, preset: DatePreset): number {
  const maxMs = new Date(maxDate).getTime();
  if (preset === "all") {
    return 0;
  }
  if (preset === "7d") {
    return maxMs - 7 * DAY_MS;
  }
  if (preset === "30d") {
    return maxMs - 30 * DAY_MS;
  }
  return maxMs - 90 * DAY_MS;
}

function aggregateMargin(
  rows: ReportTransactionRow[],
  dimension: "airline" | "agent",
): MarginRow[] {
  const map = new Map<
    string,
    {
      revenue: number;
      cost: number;
      margin: number;
      transactions: number;
    }
  >();

  for (const row of rows) {
    const key = dimension === "airline" ? row.airline : row.agent;
    const current = map.get(key) ?? {
      revenue: 0,
      cost: 0,
      margin: 0,
      transactions: 0,
    };
    current.revenue = roundMoney(current.revenue + row.revenueSigned);
    current.cost = roundMoney(current.cost + row.costSigned);
    current.margin = roundMoney(current.margin + row.marginSigned);
    current.transactions += 1;
    map.set(key, current);
  }

  return Array.from(map.entries())
    .map(([key, value]) => ({
      key,
      revenue: value.revenue,
      cost: value.cost,
      margin: value.margin,
      marginPct:
        value.revenue !== 0
          ? roundMoney((value.margin / value.revenue) * 100)
          : 0,
      transactions: value.transactions,
    }))
    .sort((a, b) => b.margin - a.margin);
}

function aggregateCashFlow(rows: ReportTransactionRow[]): CashFlowPoint[] {
  const map = new Map<
    string,
    {
      inflow: number;
      outflow: number;
    }
  >();

  for (const row of rows) {
    const current = map.get(row.dayKey) ?? { inflow: 0, outflow: 0 };
    if (row.grossSigned >= 0) {
      current.inflow = roundMoney(current.inflow + row.grossSigned);
    } else {
      current.outflow = roundMoney(current.outflow + Math.abs(row.grossSigned));
    }
    map.set(row.dayKey, current);
  }

  let cumulative = 0;
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => {
      const net = roundMoney(value.inflow - value.outflow);
      cumulative = roundMoney(cumulative + net);
      return {
        date,
        inflow: value.inflow,
        outflow: value.outflow,
        net,
        cumulative,
      };
    });
}

function buildHeatmap(rows: ReportTransactionRow[]): HeatmapCell[] {
  const map = new Map<
    string,
    {
      value: number;
      count: number;
      weekday: number;
      hourBucket: HourBucket;
    }
  >();

  for (const row of rows) {
    if (row.grossSigned <= 0) {
      continue;
    }
    const key = `${row.weekday}-${row.hourBucket}`;
    const current = map.get(key) ?? {
      value: 0,
      count: 0,
      weekday: row.weekday,
      hourBucket: row.hourBucket,
    };
    current.value = roundMoney(current.value + row.grossSigned);
    current.count += 1;
    map.set(key, current);
  }

  return Array.from(map.values());
}

function buildCashFlowSimulation(
  points: CashFlowPoint[],
  growthPct: number,
  costPct: number,
): CashFlowPoint[] {
  if (!points.length) {
    return [];
  }
  const basePoints = points.slice(-14);
  const avgInflow = roundMoney(
    basePoints.reduce((sum, point) => sum + point.inflow, 0) /
      Math.max(basePoints.length, 1),
  );
  const avgOutflow = roundMoney(
    basePoints.reduce((sum, point) => sum + point.outflow, 0) /
      Math.max(basePoints.length, 1),
  );
  const maxDate = points[points.length - 1].date;
  const startCumulative = points[points.length - 1].cumulative;

  let cumulative = startCumulative;
  return Array.from({ length: 10 }, (_, index) => {
    const multiplier = 1 + index * 0.04;
    const inflow = roundMoney(avgInflow * (1 + growthPct / 100) * multiplier);
    const outflow = roundMoney(avgOutflow * (1 + costPct / 100) * multiplier);
    const net = roundMoney(inflow - outflow);
    cumulative = roundMoney(cumulative + net);

    const date = new Date(maxDate);
    date.setUTCDate(date.getUTCDate() + index + 1);

    return {
      date: date.toISOString().slice(0, 10),
      inflow,
      outflow,
      net,
      cumulative,
    };
  });
}

interface ReportsConsoleProps {
  dataset: ReportingDataset;
}

export function ReportsConsole({ dataset }: ReportsConsoleProps) {
  const tReports = useTranslations("reportsModule");
  const tTx = useTranslations("transactions");
  const locale = useLocale();

  const [preset, setPreset] = useState<DatePreset>("30d");
  const [branchFilter, setBranchFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [growthPct, setGrowthPct] = useState(4);
  const [costPct, setCostPct] = useState(2);
  const [drill, setDrill] = useState<{ type: DrillType; key: string } | null>(null);
  const [notice, setNotice] = useState("");

  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    };
  }, []);

  const filteredRows = useMemo(() => {
    const startMs = presetStart(dataset.dateBounds.max, preset);
    const query = search.trim().toLowerCase();
    return dataset.rows.filter((row) => {
      if (new Date(row.date).getTime() < startMs) {
        return false;
      }
      if (branchFilter !== "all" && row.branch !== branchFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        row.airline.toLowerCase().includes(query) ||
        row.agent.toLowerCase().includes(query) ||
        row.transactionId.toLowerCase().includes(query)
      );
    });
  }, [branchFilter, dataset.dateBounds.max, dataset.rows, preset, search]);

  const grossSales = useMemo(
    () => roundMoney(filteredRows.reduce((sum, row) => sum + row.grossSigned, 0)),
    [filteredRows],
  );
  const marginTotal = useMemo(
    () => roundMoney(filteredRows.reduce((sum, row) => sum + row.marginSigned, 0)),
    [filteredRows],
  );
  const avgTicket = useMemo(() => {
    const positive = filteredRows.filter((row) => row.grossSigned > 0);
    const total = positive.reduce((sum, row) => sum + row.grossSigned, 0);
    return roundMoney(total / Math.max(positive.length, 1));
  }, [filteredRows]);
  const refundRate = useMemo(() => {
    if (!filteredRows.length) {
      return 0;
    }
    const refunded = filteredRows.filter((row) => row.refunded).length;
    return roundMoney((refunded / filteredRows.length) * 100);
  }, [filteredRows]);
  const pendingCollection = useMemo(
    () =>
      roundMoney(
        filteredRows
          .filter((row) => row.outstanding && row.grossSigned > 0)
          .reduce((sum, row) => sum + row.grossSigned, 0),
      ),
    [filteredRows],
  );

  const marginByAirline = useMemo(
    () => aggregateMargin(filteredRows, "airline"),
    [filteredRows],
  );
  const marginByAgent = useMemo(
    () => aggregateMargin(filteredRows, "agent"),
    [filteredRows],
  );
  const cashFlow = useMemo(() => aggregateCashFlow(filteredRows), [filteredRows]);
  const simulation = useMemo(
    () => buildCashFlowSimulation(cashFlow, growthPct, costPct),
    [cashFlow, costPct, growthPct],
  );

  const forecastNet = useMemo(
    () => roundMoney(simulation.slice(0, 7).reduce((sum, point) => sum + point.net, 0)),
    [simulation],
  );

  const heatmap = useMemo(() => buildHeatmap(filteredRows), [filteredRows]);
  const heatmapMap = useMemo(
    () =>
      new Map(
        heatmap.map((cell) => [`${cell.weekday}-${cell.hourBucket}`, cell] as const),
      ),
    [heatmap],
  );
  const maxHeatValue =
    heatmap.reduce((max, cell) => Math.max(max, cell.value), 0) || 1;

  const drillRows = useMemo(() => {
    if (!drill) {
      return [];
    }
    return filteredRows
      .filter((row) => (drill.type === "airline" ? row.airline : row.agent) === drill.key)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14);
  }, [drill, filteredRows]);

  function showNotice(message: string): void {
    setNotice(message);
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => setNotice(""), 2200);
  }

  return (
    <section className="space-y-4">
      <header className="surface-card p-6">
        <h2 className="text-2xl font-bold text-finance">{tReports("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tReports("subtitle")}</p>

        <div className="no-print mt-4 grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tReports("filters.searchPlaceholder")}
              className="h-9 w-full rounded-md border border-border bg-white ps-8 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            <option value="all">{tReports("filters.allBranches")}</option>
            {dataset.branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>

          <select
            value={preset}
            onChange={(event) => setPreset(event.target.value as DatePreset)}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            <option value="7d">{tReports("filters.preset7")}</option>
            <option value="30d">{tReports("filters.preset30")}</option>
            <option value="90d">{tReports("filters.preset90")}</option>
            <option value="all">{tReports("filters.presetAll")}</option>
          </select>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => showNotice(tReports("export.pdfTriggered"))}
          >
            <Download className="me-1 h-3.5 w-3.5" />
            {tReports("export.pdf")}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => showNotice(tReports("export.excelTriggered"))}
          >
            <FileSpreadsheet className="me-1 h-3.5 w-3.5" />
            {tReports("export.excel")}
          </Button>
        </div>

        {notice ? (
          <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-finance">
            {notice}
          </p>
        ) : null}
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tReports("kpi.grossSales")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {formatCurrency(grossSales, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tReports("kpi.margin")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {formatCurrency(marginTotal, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tReports("kpi.marginPct")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {grossSales !== 0 ? roundMoney((marginTotal / grossSales) * 100) : 0}%
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tReports("kpi.avgTicket")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {formatCurrency(avgTicket, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tReports("kpi.refundRate")}</p>
          <p className="mt-2 text-lg font-bold text-finance">{refundRate}%</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tReports("kpi.pendingCollection")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {formatCurrency(pendingCollection, locale, "SAR")}
          </p>
        </article>
      </div>

      <section className="surface-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-finance">{tReports("heatmap.title")}</h3>
          <p className="text-xs text-muted-foreground">
            {tReports("heatmap.subtitle")}
          </p>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[620px] text-xs">
            <thead>
              <tr className="text-muted-foreground">
                <th className="px-2 py-1 text-start">{tReports("heatmap.day")}</th>
                {HOUR_BUCKETS.map((bucket) => (
                  <th key={bucket} className="px-2 py-1 text-center">
                    {tReports(`heatmap.hours.${bucket}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((weekday) => (
                <tr key={weekday} className="border-t border-border/70">
                  <td className="px-2 py-2 font-medium text-finance">
                    {tReports(`heatmap.weekdays.${weekday}`)}
                  </td>
                  {HOUR_BUCKETS.map((bucket) => {
                    const cell = heatmapMap.get(`${weekday}-${bucket}`);
                    const value = cell?.value ?? 0;
                    const count = cell?.count ?? 0;
                    const ratio = Math.max(0, Math.min(1, value / maxHeatValue));
                    const bgOpacity = value ? 0.14 + ratio * 0.76 : 0.05;

                    return (
                      <td key={`${weekday}-${bucket}`} className="px-2 py-1">
                        <div
                          className="rounded-md border border-border px-2 py-2 text-center"
                          style={{
                            backgroundColor: `rgba(15,76,129,${bgOpacity})`,
                            color: ratio > 0.55 ? "#ffffff" : "#1f2937",
                          }}
                        >
                          <p className="text-[11px] font-semibold">
                            {formatCurrency(value, locale, "SAR")}
                          </p>
                          <p className="text-[10px] opacity-90">{count}</p>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card p-4">
        <div className="mb-3 grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs text-muted-foreground">
              {tReports("simulation.growth")}
            </label>
            <input
              type="range"
              min={-10}
              max={20}
              step={1}
              value={growthPct}
              onChange={(event) => setGrowthPct(Number(event.target.value))}
              className="mt-2 w-full"
            />
            <p className="mt-1 text-xs text-muted-foreground">{growthPct}%</p>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              {tReports("simulation.cost")}
            </label>
            <input
              type="range"
              min={-5}
              max={15}
              step={1}
              value={costPct}
              onChange={(event) => setCostPct(Number(event.target.value))}
              className="mt-2 w-full"
            />
            <p className="mt-1 text-xs text-muted-foreground">{costPct}%</p>
          </div>
        </div>

        <div className="mb-3 rounded-md border border-border bg-slate-50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{tReports("simulation.forecast7")}: </span>
          <span className="font-semibold text-finance">
            {formatCurrency(forecastNet, locale, "SAR")}
          </span>
        </div>

        <ReportsVisuals
          locale={locale}
          marginByAirline={marginByAirline}
          marginByAgent={marginByAgent}
          cashFlow={cashFlow}
          cashFlowSimulation={simulation}
          onAirlineSelect={(airline) => setDrill({ type: "airline", key: airline })}
          onAgentSelect={(agent) => setDrill({ type: "agent", key: agent })}
        />
      </section>

      <section className="surface-card overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-finance">{tReports("drill.title")}</h3>
          {drill ? (
            <button
              type="button"
              onClick={() => setDrill(null)}
              className="text-xs text-muted-foreground underline hover:text-foreground"
            >
              {tReports("drill.clear")}
            </button>
          ) : null}
        </header>

        {!drill ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">
            {tReports("drill.empty")}
          </p>
        ) : (
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2 text-start">{tReports("drill.date")}</th>
                  <th className="px-2 py-2 text-start">{tReports("drill.transaction")}</th>
                  <th className="px-2 py-2 text-start">{tReports("drill.dimension")}</th>
                  <th className="px-2 py-2 text-end">{tReports("drill.gross")}</th>
                  <th className="px-2 py-2 text-end">{tReports("drill.margin")}</th>
                  <th className="px-2 py-2 text-start">{tReports("drill.status")}</th>
                </tr>
              </thead>
              <tbody>
                {drillRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/70">
                    <td className="px-2 py-2">{formatDate(row.date, locale)}</td>
                    <td className="px-2 py-2 font-medium text-finance">
                      {row.transactionId}
                    </td>
                    <td className="px-2 py-2">
                      {drill.type === "airline" ? row.airline : row.agent}
                    </td>
                    <td className="px-2 py-2 text-end">
                      {formatCurrency(row.grossSigned, locale, "SAR")}
                    </td>
                    <td className="px-2 py-2 text-end">
                      {formatCurrency(row.marginSigned, locale, "SAR")}
                    </td>
                    <td className="px-2 py-2">{tTx(`statusValues.${row.status}`)}</td>
                  </tr>
                ))}
                {!drillRows.length ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-8 text-center text-muted-foreground">
                      {tReports("drill.noRows")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
