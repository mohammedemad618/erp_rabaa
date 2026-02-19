"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { formatCurrency } from "@/utils/format";
import type { BspDataset, MismatchType } from "../types";
import { AirlineSummary } from "./airline-summary";
import { MismatchDetector } from "./mismatch-detector";
import { SystemStatementSplit } from "./system-statement-split";

const SettlementTimeline = dynamic(
  () => import("./settlement-timeline").then((mod) => mod.SettlementTimeline),
  {
    ssr: false,
    loading: () => (
      <section className="surface-card p-4">
        <p className="text-sm text-muted-foreground">Loading settlement timeline...</p>
      </section>
    ),
  },
);

type MismatchFilter = "all" | MismatchType;

interface BspConsoleProps {
  dataset: BspDataset;
}

function toLower(value: string): string {
  return value.trim().toLowerCase();
}

export function BspConsole({ dataset }: BspConsoleProps) {
  const tBsp = useTranslations("bsp");
  const locale = useLocale();

  const [search, setSearch] = useState("");
  const [selectedAirline, setSelectedAirline] = useState("all");
  const [mismatchFilter, setMismatchFilter] = useState<MismatchFilter>("all");
  const [selectedTicket, setSelectedTicket] = useState("");

  const filteredSystemRows = useMemo(() => {
    const query = toLower(search);
    return dataset.systemRows
      .filter((row) => {
        if (selectedAirline !== "all" && row.airline !== selectedAirline) {
          return false;
        }
        if (!query) {
          return true;
        }
        return (
          row.ticketNumber.toLowerCase().includes(query) ||
          row.pnr.toLowerCase().includes(query) ||
          row.transactionId.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  }, [dataset.systemRows, search, selectedAirline]);

  const filteredStatementRows = useMemo(() => {
    const query = toLower(search);
    return dataset.statementRows
      .filter((row) => {
        if (selectedAirline !== "all" && row.airline !== selectedAirline) {
          return false;
        }
        if (!query) {
          return true;
        }
        return (
          row.ticketNumber.toLowerCase().includes(query) ||
          row.pnr.toLowerCase().includes(query) ||
          row.statementId.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.settlementDate.localeCompare(a.settlementDate));
  }, [dataset.statementRows, search, selectedAirline]);

  const filteredMismatches = useMemo(() => {
    const query = toLower(search);
    return dataset.mismatches.filter((row) => {
      if (selectedAirline !== "all" && row.airline !== selectedAirline) {
        return false;
      }
      if (mismatchFilter !== "all" && row.type !== mismatchFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        row.ticketNumber.toLowerCase().includes(query) ||
        row.pnr.toLowerCase().includes(query)
      );
    });
  }, [dataset.mismatches, mismatchFilter, search, selectedAirline]);

  const filteredTimeline = useMemo(() => {
    return dataset.timeline.filter((row) => {
      if (selectedAirline !== "all" && row.airline !== selectedAirline) {
        return false;
      }
      return true;
    });
  }, [dataset.timeline, selectedAirline]);

  const filteredAirlineSummary = useMemo(() => {
    if (selectedAirline === "all") {
      return dataset.airlineSummaries;
    }
    return dataset.airlineSummaries.filter((row) => row.airline === selectedAirline);
  }, [dataset.airlineSummaries, selectedAirline]);

  const mismatchedTickets = useMemo(
    () => new Set(filteredMismatches.map((row) => row.ticketNumber)),
    [filteredMismatches],
  );

  const systemAmount = useMemo(() => {
    return filteredSystemRows.reduce((sum, row) => sum + row.totalAmount, 0);
  }, [filteredSystemRows]);

  const bspAmount = useMemo(() => {
    return filteredStatementRows.reduce((sum, row) => sum + row.reportedTotal, 0);
  }, [filteredStatementRows]);

  const variance = bspAmount - systemAmount;

  const selectedSystem = filteredSystemRows.find(
    (row) => row.ticketNumber === selectedTicket,
  );
  const selectedStatement = filteredStatementRows.find(
    (row) => row.ticketNumber === selectedTicket,
  );
  const selectedTicketMismatches = filteredMismatches.filter(
    (row) => row.ticketNumber === selectedTicket,
  );

  const systemRowsForSplit = filteredSystemRows.slice(0, 260);
  const statementRowsForSplit = filteredStatementRows.slice(0, 260);

  const mismatchTypes: Array<{ value: MismatchFilter; label: string }> = [
    { value: "all", label: tBsp("filters.allMismatchTypes") },
    { value: "missing_in_bsp", label: tBsp("mismatch.types.missing_in_bsp") },
    { value: "extra_in_bsp", label: tBsp("mismatch.types.extra_in_bsp") },
    { value: "amount_mismatch", label: tBsp("mismatch.types.amount_mismatch") },
    { value: "tax_mismatch", label: tBsp("mismatch.types.tax_mismatch") },
    { value: "status_mismatch", label: tBsp("mismatch.types.status_mismatch") },
  ];

  return (
    <section className="space-y-4">
      <header className="surface-card p-6">
        <h2 className="text-2xl font-bold text-finance">{tBsp("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tBsp("subtitle")}</p>

        <div className="no-print mt-4 grid gap-2 md:grid-cols-[1.4fr_1fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tBsp("filters.searchPlaceholder")}
              className="h-9 w-full rounded-md border border-border bg-white ps-8 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <select
            value={selectedAirline}
            onChange={(event) => setSelectedAirline(event.target.value)}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            <option value="all">{tBsp("filters.allAirlines")}</option>
            {dataset.airlineSummaries.map((row) => (
              <option key={row.airline} value={row.airline}>
                {row.airline}
              </option>
            ))}
          </select>

          <select
            value={mismatchFilter}
            onChange={(event) => setMismatchFilter(event.target.value as MismatchFilter)}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            {mismatchTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tBsp("kpi.systemSales")}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{filteredSystemRows.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tBsp("kpi.bspSales")}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{filteredStatementRows.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tBsp("kpi.mismatches")}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{filteredMismatches.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tBsp("kpi.variance")}</p>
          <p className="mt-2 text-xl font-bold text-finance">
            {formatCurrency(variance, locale, "SAR")}
          </p>
        </article>
      </div>

      <SystemStatementSplit
        locale={locale}
        systemRows={systemRowsForSplit}
        statementRows={statementRowsForSplit}
        mismatchedTickets={mismatchedTickets}
        selectedTicket={selectedTicket}
        onSelectTicket={setSelectedTicket}
      />

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <MismatchDetector
          locale={locale}
          rows={filteredMismatches}
          selectedTicket={selectedTicket}
          onSelectTicket={setSelectedTicket}
        />

        <section className="surface-card p-4">
          <h3 className="text-sm font-semibold text-finance">{tBsp("details.title")}</h3>
          {!selectedTicket ? (
            <p className="mt-4 text-sm text-muted-foreground">{tBsp("details.empty")}</p>
          ) : (
            <div className="mt-3 space-y-3 text-xs">
              <article className="rounded-md border border-border bg-slate-50 p-3">
                <p className="font-semibold text-finance">{tBsp("details.systemRecord")}</p>
                {selectedSystem ? (
                  <dl className="mt-2 space-y-1 text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <dt>{tBsp("table.ticket")}</dt>
                      <dd>{selectedSystem.ticketNumber}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>{tBsp("table.total")}</dt>
                      <dd>{formatCurrency(selectedSystem.totalAmount, locale, "SAR")}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>{tBsp("table.status")}</dt>
                      <dd>{selectedSystem.status}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 text-muted-foreground">{tBsp("details.notAvailable")}</p>
                )}
              </article>

              <article className="rounded-md border border-border bg-slate-50 p-3">
                <p className="font-semibold text-finance">{tBsp("details.statementRecord")}</p>
                {selectedStatement ? (
                  <dl className="mt-2 space-y-1 text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <dt>{tBsp("table.statementId")}</dt>
                      <dd>{selectedStatement.statementId}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>{tBsp("table.total")}</dt>
                      <dd>{formatCurrency(selectedStatement.reportedTotal, locale, "SAR")}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>{tBsp("table.status")}</dt>
                      <dd>{selectedStatement.reportedStatus}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-2 text-muted-foreground">{tBsp("details.notAvailable")}</p>
                )}
              </article>

              <article className="rounded-md border border-border bg-slate-50 p-3">
                <p className="font-semibold text-finance">{tBsp("details.discrepancies")}</p>
                {selectedTicketMismatches.length ? (
                  <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                    {selectedTicketMismatches.map((row) => (
                      <li key={row.id}>{row.description}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-muted-foreground">{tBsp("details.noMismatch")}</p>
                )}
              </article>
            </div>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.3fr]">
        <AirlineSummary
          locale={locale}
          rows={filteredAirlineSummary}
          selectedAirline={selectedAirline}
          onSelectAirline={setSelectedAirline}
        />
        <SettlementTimeline locale={locale} rows={filteredTimeline} />
      </div>
    </section>
  );
}
