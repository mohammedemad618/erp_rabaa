"use client";

import { useTranslations } from "next-intl";
import type { BspMismatchRow } from "../types";
import { formatCurrency } from "@/utils/format";

const severityClass = {
  low: "bg-amber-100 text-amber-700",
  medium: "bg-orange-100 text-orange-700",
  high: "bg-rose-100 text-rose-700",
} as const;

interface MismatchDetectorProps {
  locale: string;
  rows: BspMismatchRow[];
  selectedTicket: string;
  onSelectTicket: (ticketNumber: string) => void;
}

export function MismatchDetector({
  locale,
  rows,
  selectedTicket,
  onSelectTicket,
}: MismatchDetectorProps) {
  const tBsp = useTranslations("bsp");

  return (
    <section className="surface-card overflow-hidden">
      <header className="border-b border-border bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-finance">
          {tBsp("mismatch.title")} ({rows.length})
        </h3>
      </header>
      <div className="max-h-[320px] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white">
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-2 py-2 text-start">{tBsp("mismatch.type")}</th>
              <th className="px-2 py-2 text-start">{tBsp("table.ticket")}</th>
              <th className="px-2 py-2 text-start">{tBsp("table.airline")}</th>
              <th className="px-2 py-2 text-end">{tBsp("mismatch.systemAmount")}</th>
              <th className="px-2 py-2 text-end">{tBsp("mismatch.bspAmount")}</th>
              <th className="px-2 py-2 text-end">{tBsp("mismatch.delta")}</th>
              <th className="px-2 py-2 text-start">{tBsp("mismatch.severity")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isSelected = selectedTicket === row.ticketNumber;
              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer border-b border-border/70 ${
                    isSelected ? "bg-blue-50" : ""
                  }`}
                  onClick={() => onSelectTicket(row.ticketNumber)}
                >
                  <td className="px-2 py-2">{tBsp(`mismatch.types.${row.type}`)}</td>
                  <td className="px-2 py-2 font-medium text-finance">{row.ticketNumber}</td>
                  <td className="px-2 py-2">{row.airline}</td>
                  <td className="px-2 py-2 text-end">
                    {formatCurrency(row.systemAmount, locale, "SAR")}
                  </td>
                  <td className="px-2 py-2 text-end">
                    {formatCurrency(row.bspAmount, locale, "SAR")}
                  </td>
                  <td className="px-2 py-2 text-end">
                    {formatCurrency(row.delta, locale, "SAR")}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${severityClass[row.severity]}`}
                    >
                      {tBsp(`mismatch.severityValues.${row.severity}`)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={7} className="px-2 py-8 text-center text-muted-foreground">
                  {tBsp("empty.mismatch")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
