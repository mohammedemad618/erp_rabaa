"use client";

import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CashFlowPoint, MarginRow } from "../types";
import { formatCurrency } from "@/utils/format";

interface ReportsVisualsProps {
  locale: string;
  marginByAirline: MarginRow[];
  marginByAgent: MarginRow[];
  cashFlow: CashFlowPoint[];
  cashFlowSimulation: CashFlowPoint[];
  onAirlineSelect: (airline: string) => void;
  onAgentSelect: (agent: string) => void;
}

function getPayloadKey(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const value = (payload as { key?: string }).key;
  return typeof value === "string" ? value : null;
}

export function ReportsVisuals({
  locale,
  marginByAirline,
  marginByAgent,
  cashFlow,
  cashFlowSimulation,
  onAirlineSelect,
  onAgentSelect,
}: ReportsVisualsProps) {
  const tReports = useTranslations("reportsModule");

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="surface-card min-w-0 p-4">
          <h3 className="text-sm font-semibold text-finance">
            {tReports("charts.marginByAirline")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {tReports("charts.clickToDrill")}
          </p>
          <div className="mt-3 h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marginByAirline.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" tick={{ fontSize: 11 }} interval={0} angle={-18} dy={12} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number"
                      ? formatCurrency(value, locale, "SAR")
                      : value
                  }
                />
                <Legend />
                <Bar
                  dataKey="margin"
                  fill="#0f4c81"
                  name={tReports("charts.margin")}
                  onClick={(point) => {
                    const key = getPayloadKey(point?.payload);
                    if (key) {
                      onAirlineSelect(key);
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface-card min-w-0 p-4">
          <h3 className="text-sm font-semibold text-finance">
            {tReports("charts.marginByEmployee")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {tReports("charts.clickToDrill")}
          </p>
          <div className="mt-3 h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marginByAgent.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" tick={{ fontSize: 11 }} interval={0} angle={-18} dy={12} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number"
                      ? formatCurrency(value, locale, "SAR")
                      : value
                  }
                />
                <Legend />
                <Bar
                  dataKey="margin"
                  fill="#0f9d7a"
                  name={tReports("charts.margin")}
                  onClick={(point) => {
                    const key = getPayloadKey(point?.payload);
                    if (key) {
                      onAgentSelect(key);
                    }
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="surface-card min-w-0 p-4">
          <h3 className="text-sm font-semibold text-finance">
            {tReports("charts.cashFlowActual")}
          </h3>
          <div className="mt-3 h-[290px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlow}>
                <defs>
                  <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f4c81" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0f4c81" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number"
                      ? formatCurrency(value, locale, "SAR")
                      : value
                  }
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="#0f4c81"
                  fill="url(#netGradient)"
                  name={tReports("charts.net")}
                />
                <Line
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#2f3544"
                  dot={false}
                  name={tReports("charts.cumulative")}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface-card min-w-0 p-4">
          <h3 className="text-sm font-semibold text-finance">
            {tReports("charts.cashFlowSimulation")}
          </h3>
          <div className="mt-3 h-[290px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={cashFlowSimulation}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) =>
                    typeof value === "number"
                      ? formatCurrency(value, locale, "SAR")
                      : value
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="inflow"
                  stroke="#0f9d7a"
                  dot={false}
                  name={tReports("charts.inflow")}
                />
                <Line
                  type="monotone"
                  dataKey="outflow"
                  stroke="#c62828"
                  dot={false}
                  name={tReports("charts.outflow")}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="#0f4c81"
                  dot={false}
                  name={tReports("charts.net")}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}
