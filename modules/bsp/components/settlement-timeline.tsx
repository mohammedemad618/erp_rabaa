"use client";

import { useTranslations } from "next-intl";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SettlementTimelinePoint } from "../types";
import { formatCurrency } from "@/utils/format";

interface SettlementTimelineProps {
  locale: string;
  rows: SettlementTimelinePoint[];
}

export function SettlementTimeline({ locale, rows }: SettlementTimelineProps) {
  const tBsp = useTranslations("bsp");

  const chartRows = rows.slice(0, 50).map((row) => ({
    key: `${row.date.slice(5)} ${row.airline.split(" ")[0]}`,
    systemAmount: row.systemAmount,
    bspAmount: row.bspAmount,
    delta: row.delta,
  }));

  return (
    <section className="surface-card p-4">
      <h3 className="text-sm font-semibold text-finance">{tBsp("timeline.title")}</h3>
      <p className="mt-1 text-xs text-muted-foreground">{tBsp("timeline.subtitle")}</p>

      <div className="mt-3 h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartRows}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="key" tick={{ fontSize: 10 }} interval={3} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value) =>
                typeof value === "number"
                  ? formatCurrency(value, locale, "SAR")
                  : value
              }
            />
            <Legend />
            <Bar dataKey="systemAmount" name={tBsp("timeline.system")} fill="#0f4c81" />
            <Bar dataKey="bspAmount" name={tBsp("timeline.bsp")} fill="#0f9d7a" />
            <Line
              type="monotone"
              dataKey="delta"
              name={tBsp("timeline.delta")}
              stroke="#c62828"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
