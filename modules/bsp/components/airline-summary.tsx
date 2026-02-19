"use client";

import { useTranslations } from "next-intl";
import type { AirlineReconciliationSummary } from "../types";
import { formatCurrency } from "@/utils/format";

interface AirlineSummaryProps {
  locale: string;
  rows: AirlineReconciliationSummary[];
  selectedAirline: string;
  onSelectAirline: (airline: string) => void;
}

export function AirlineSummary({
  locale,
  rows,
  selectedAirline,
  onSelectAirline,
}: AirlineSummaryProps) {
  const tBsp = useTranslations("bsp");

  return (
    <section className="surface-card overflow-hidden">
      <header className="border-b border-border bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-finance">{tBsp("airlineSummary.title")}</h3>
      </header>
      <div className="max-h-[320px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2 text-start">{tBsp("table.airline")}</th>
              <th className="px-2 py-2 text-end">{tBsp("airlineSummary.systemCount")}</th>
              <th className="px-2 py-2 text-end">{tBsp("airlineSummary.bspCount")}</th>
              <th className="px-2 py-2 text-end">{tBsp("airlineSummary.mismatchCount")}</th>
              <th className="px-2 py-2 text-end">{tBsp("airlineSummary.variance")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const active =
                selectedAirline !== "all" && selectedAirline === row.airline;
              return (
                <tr
                  key={row.airline}
                  className={`cursor-pointer border-b border-border/70 ${active ? "bg-blue-50" : ""}`}
                  onClick={() => onSelectAirline(row.airline)}
                >
                  <td className="px-2 py-2 font-medium text-finance">{row.airline}</td>
                  <td className="px-2 py-2 text-end">{row.systemCount}</td>
                  <td className="px-2 py-2 text-end">{row.statementCount}</td>
                  <td className="px-2 py-2 text-end">{row.mismatchCount}</td>
                  <td className="px-2 py-2 text-end">
                    {formatCurrency(row.variance, locale, "SAR")}
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">
                  {tBsp("empty.airlineSummary")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
