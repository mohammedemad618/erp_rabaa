"use client";

import { Link2, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import type { DragEvent } from "react";
import type {
  ReconciliationMatch,
  StatementBankRow,
  SystemBankRow,
} from "../types";
import { formatCurrency, formatDate } from "@/utils/format";

interface ReconciliationWorkbenchProps {
  systemRows: SystemBankRow[];
  statementRows: StatementBankRow[];
  matches: ReconciliationMatch[];
  onCreateMatch: (systemRowId: string, statementRowId: string) => void;
  onRemoveMatch: (matchId: string) => void;
}

function toSigned(direction: "in" | "out", amount: number): number {
  return direction === "in" ? amount : -amount;
}

export function ReconciliationWorkbench({
  systemRows,
  statementRows,
  matches,
  onCreateMatch,
  onRemoveMatch,
}: ReconciliationWorkbenchProps) {
  const tTreasury = useTranslations("treasury");
  const locale = useLocale();

  const systemById = useMemo(
    () => new Map(systemRows.map((row) => [row.id, row])),
    [systemRows],
  );
  const statementById = useMemo(
    () => new Map(statementRows.map((row) => [row.id, row])),
    [statementRows],
  );

  const matchedSystemIds = useMemo(
    () => new Set(matches.map((match) => match.systemRowId)),
    [matches],
  );
  const matchedStatementIds = useMemo(
    () => new Set(matches.map((match) => match.statementRowId)),
    [matches],
  );

  const unmatchedSystemRows = useMemo(
    () => systemRows.filter((row) => !matchedSystemIds.has(row.id)),
    [matchedSystemIds, systemRows],
  );
  const unmatchedStatementRows = useMemo(
    () => statementRows.filter((row) => !matchedStatementIds.has(row.id)),
    [matchedStatementIds, statementRows],
  );

  const unmatchedSystemSigned = useMemo(
    () =>
      unmatchedSystemRows.reduce(
        (sum, row) => sum + toSigned(row.direction, row.amount),
        0,
      ),
    [unmatchedSystemRows],
  );
  const unmatchedStatementSigned = useMemo(
    () =>
      unmatchedStatementRows.reduce(
        (sum, row) => sum + toSigned(row.direction, row.amount),
        0,
      ),
    [unmatchedStatementRows],
  );

  const realtimeDelta = unmatchedStatementSigned - unmatchedSystemSigned;
  const displayedSystemRows = unmatchedSystemRows.slice(0, 240);
  const displayedStatementRows = unmatchedStatementRows.slice(0, 240);

  const matchedPairs = useMemo(() => {
    return matches
      .map((match) => {
        const system = systemById.get(match.systemRowId);
        const statement = statementById.get(match.statementRowId);
        if (!system || !statement) {
          return null;
        }
        return { match, system, statement };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .slice(-90)
      .reverse();
  }, [matches, statementById, systemById]);

  function handleDrop(
    event: DragEvent<HTMLTableRowElement>,
    statementRowId: string,
  ): void {
    event.preventDefault();
    const systemRowId = event.dataTransfer.getData("application/x-system-row-id");
    if (!systemRowId) {
      return;
    }
    onCreateMatch(systemRowId, statementRowId);
  }

  return (
    <section className="surface-card p-4">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-finance">
            {tTreasury("reconciliation.title")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {tTreasury("reconciliation.subtitle")}
          </p>
        </div>

        <div className="rounded-md border border-border bg-slate-50 px-3 py-2 text-xs">
          <p className="text-muted-foreground">{tTreasury("reconciliation.realtimeDelta")}</p>
          <p className="mt-1 text-sm font-semibold text-finance">
            {formatCurrency(realtimeDelta, locale, "SAR")}
          </p>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="overflow-hidden rounded-md border border-border">
          <header className="border-b border-border bg-slate-50 px-3 py-2 text-xs font-semibold text-finance">
            {tTreasury("reconciliation.systemUnmatched")} ({unmatchedSystemRows.length})
          </header>
          <div className="max-h-[330px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2 text-start">{tTreasury("table.reference")}</th>
                  <th className="px-2 py-2 text-start">{tTreasury("table.date")}</th>
                  <th className="px-2 py-2 text-start">{tTreasury("table.direction")}</th>
                  <th className="px-2 py-2 text-end">{tTreasury("table.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {displayedSystemRows.map((row) => (
                  <tr
                    key={row.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("application/x-system-row-id", row.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    className="cursor-grab border-b border-border/70 bg-rose-50/70 hover:bg-rose-100/70"
                  >
                    <td className="px-2 py-2 font-medium text-finance">{row.reference}</td>
                    <td className="px-2 py-2">{formatDate(row.date, locale)}</td>
                    <td className="px-2 py-2">{tTreasury(`directions.${row.direction}`)}</td>
                    <td className="px-2 py-2 text-end">
                      {formatCurrency(row.amount, locale, row.currency)}
                    </td>
                  </tr>
                ))}
                {!displayedSystemRows.length ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-8 text-center text-muted-foreground">
                      {tTreasury("empty.systemUnmatched")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-md border border-border">
          <header className="border-b border-border bg-slate-50 px-3 py-2 text-xs font-semibold text-finance">
            {tTreasury("reconciliation.statementUnmatched")} (
            {unmatchedStatementRows.length})
          </header>
          <div className="max-h-[330px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2 text-start">{tTreasury("table.reference")}</th>
                  <th className="px-2 py-2 text-start">{tTreasury("table.date")}</th>
                  <th className="px-2 py-2 text-start">{tTreasury("table.direction")}</th>
                  <th className="px-2 py-2 text-end">{tTreasury("table.amount")}</th>
                </tr>
              </thead>
              <tbody>
                {displayedStatementRows.map((row) => (
                  <tr
                    key={row.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => handleDrop(event, row.id)}
                    className="border-b border-border/70 bg-amber-50/70 hover:bg-amber-100/70"
                  >
                    <td className="px-2 py-2 font-medium text-finance">
                      {row.statementReference}
                    </td>
                    <td className="px-2 py-2">{formatDate(row.date, locale)}</td>
                    <td className="px-2 py-2">{tTreasury(`directions.${row.direction}`)}</td>
                    <td className="px-2 py-2 text-end">
                      {formatCurrency(row.amount, locale, row.currency)}
                    </td>
                  </tr>
                ))}
                {!displayedStatementRows.length ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-8 text-center text-muted-foreground">
                      {tTreasury("empty.statementUnmatched")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="mt-4 overflow-hidden rounded-md border border-border">
        <header className="border-b border-border bg-slate-50 px-3 py-2 text-xs font-semibold text-finance">
          {tTreasury("reconciliation.matchedPairs")} ({matchedPairs.length})
        </header>
        <div className="max-h-[250px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-2 text-start">{tTreasury("table.reference")}</th>
                <th className="px-2 py-2 text-start">{tTreasury("reconciliation.linkedTo")}</th>
                <th className="px-2 py-2 text-end">{tTreasury("reconciliation.delta")}</th>
                <th className="px-2 py-2 text-end">{tTreasury("reconciliation.action")}</th>
              </tr>
            </thead>
            <tbody>
              {matchedPairs.map(({ match, system, statement }) => (
                <tr key={match.id} className="border-b border-border/70">
                  <td className="px-2 py-2">
                    <span className="inline-flex items-center gap-1 font-medium text-finance">
                      <Link2 className="h-3 w-3" />
                      {system.reference}
                    </span>
                  </td>
                  <td className="px-2 py-2">{statement.statementReference}</td>
                  <td className="px-2 py-2 text-end">
                    {formatCurrency(match.delta, locale, "SAR")}
                  </td>
                  <td className="px-2 py-2 text-end">
                    <button
                      type="button"
                      onClick={() => onRemoveMatch(match.id)}
                      className="inline-flex h-7 items-center gap-1 rounded border border-border px-2 text-[11px] text-muted-foreground hover:bg-slate-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {tTreasury("reconciliation.unmatch")}
                    </button>
                  </td>
                </tr>
              ))}
              {!matchedPairs.length ? (
                <tr>
                  <td colSpan={4} className="px-2 py-8 text-center text-muted-foreground">
                    {tTreasury("empty.matchedPairs")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
