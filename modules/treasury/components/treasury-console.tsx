"use client";

import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { formatCurrency, formatDate } from "@/utils/format";
import { Button } from "@/components/ui/button";
import type { ReconciliationMatch, TreasuryDataset } from "../types";
import { ReconciliationWorkbench } from "./reconciliation-workbench";

type AccountFilter = "all" | string;

function toSigned(direction: "in" | "out", amount: number): number {
  return direction === "in" ? amount : -amount;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

interface TreasuryConsoleProps {
  dataset: TreasuryDataset;
}

export function TreasuryConsole({ dataset }: TreasuryConsoleProps) {
  const tTreasury = useTranslations("treasury");
  const locale = useLocale();

  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [matches, setMatches] = useState<ReconciliationMatch[]>(() => dataset.suggestedMatches);

  const systemById = useMemo(
    () => new Map(dataset.systemBankRows.map((row) => [row.id, row])),
    [dataset.systemBankRows],
  );
  const statementById = useMemo(
    () => new Map(dataset.statementBankRows.map((row) => [row.id, row])),
    [dataset.statementBankRows],
  );

  const selectedAccountBranch =
    accountFilter === "all"
      ? "all"
      : dataset.bankAccounts.find((account) => account.accountId === accountFilter)?.branch ??
        "all";

  const query = normalize(search);

  const filteredSystemRows = useMemo(() => {
    return dataset.systemBankRows.filter((row) => {
      if (accountFilter !== "all" && row.accountId !== accountFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        row.reference.toLowerCase().includes(query) ||
        row.description.toLowerCase().includes(query)
      );
    });
  }, [accountFilter, dataset.systemBankRows, query]);

  const filteredStatementRows = useMemo(() => {
    return dataset.statementBankRows.filter((row) => {
      if (accountFilter !== "all" && row.accountId !== accountFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        row.statementReference.toLowerCase().includes(query) ||
        row.description.toLowerCase().includes(query)
      );
    });
  }, [accountFilter, dataset.statementBankRows, query]);

  const filteredCashRows = useMemo(() => {
    return dataset.cashRows.filter((row) => {
      if (selectedAccountBranch !== "all" && row.branch !== selectedAccountBranch) {
        return false;
      }
      return true;
    });
  }, [dataset.cashRows, selectedAccountBranch]);

  const filteredPosRows = useMemo(() => {
    return dataset.posSummaries.filter((row) => {
      if (selectedAccountBranch !== "all" && row.branch !== selectedAccountBranch) {
        return false;
      }
      return true;
    });
  }, [dataset.posSummaries, selectedAccountBranch]);

  const displayedAccounts = useMemo(() => {
    if (accountFilter === "all") {
      return dataset.bankAccounts;
    }
    return dataset.bankAccounts.filter((account) => account.accountId === accountFilter);
  }, [accountFilter, dataset.bankAccounts]);

  const filteredSystemSet = useMemo(
    () => new Set(filteredSystemRows.map((row) => row.id)),
    [filteredSystemRows],
  );
  const filteredStatementSet = useMemo(
    () => new Set(filteredStatementRows.map((row) => row.id)),
    [filteredStatementRows],
  );

  const filteredMatches = useMemo(() => {
    return matches.filter(
      (match) =>
        filteredSystemSet.has(match.systemRowId) &&
        filteredStatementSet.has(match.statementRowId),
    );
  }, [filteredStatementSet, filteredSystemSet, matches]);

  const matchedSystemIds = useMemo(
    () => new Set(filteredMatches.map((match) => match.systemRowId)),
    [filteredMatches],
  );
  const matchedStatementIds = useMemo(
    () => new Set(filteredMatches.map((match) => match.statementRowId)),
    [filteredMatches],
  );

  const cashIn = roundMoney(
    filteredCashRows
      .filter((row) => row.direction === "in")
      .reduce((sum, row) => sum + row.amount, 0),
  );
  const cashOut = roundMoney(
    filteredCashRows
      .filter((row) => row.direction === "out")
      .reduce((sum, row) => sum + row.amount, 0),
  );

  const posPending = roundMoney(
    filteredPosRows.reduce((sum, row) => sum + row.pendingAmount, 0),
  );

  const ledgerTotal = roundMoney(
    displayedAccounts.reduce((sum, row) => sum + row.ledgerBalance, 0),
  );
  const statementTotal = roundMoney(
    displayedAccounts.reduce((sum, row) => sum + row.statementBalance, 0),
  );
  const bankVariance = roundMoney(statementTotal - ledgerTotal);

  const unmatchedSystemCount = filteredSystemRows.filter(
    (row) => !matchedSystemIds.has(row.id),
  ).length;
  const unmatchedStatementCount = filteredStatementRows.filter(
    (row) => !matchedStatementIds.has(row.id),
  ).length;

  function createMatch(systemRowId: string, statementRowId: string): void {
    setMatches((previous) => {
      const alreadyMatched = previous.some(
        (match) =>
          match.systemRowId === systemRowId || match.statementRowId === statementRowId,
      );
      if (alreadyMatched) {
        return previous;
      }

      const system = systemById.get(systemRowId);
      const statement = statementById.get(statementRowId);
      if (!system || !statement) {
        return previous;
      }

      const delta = roundMoney(
        toSigned(statement.direction, statement.amount) -
          toSigned(system.direction, system.amount),
      );

      const nextMatch: ReconciliationMatch = {
        id: `manual-${systemRowId}-${statementRowId}`,
        systemRowId,
        statementRowId,
        matchedAt: new Date().toISOString(),
        delta,
      };

      return [...previous, nextMatch];
    });
  }

  function removeMatch(matchId: string): void {
    setMatches((previous) => previous.filter((match) => match.id !== matchId));
  }

  const displayedCashRows = filteredCashRows.slice(0, 14);
  const displayedPosRows = filteredPosRows.slice(0, 12);

  return (
    <section className="space-y-4">
      <header className="surface-card p-6">
        <h2 className="text-2xl font-bold text-finance">{tTreasury("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tTreasury("subtitle")}</p>

        <div className="no-print mt-4 grid gap-2 md:grid-cols-[1.4fr_1fr_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tTreasury("filters.searchPlaceholder")}
              className="h-9 w-full rounded-md border border-border bg-white ps-8 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            className="h-9 rounded-md border border-border bg-white px-3 text-sm"
          >
            <option value="all">{tTreasury("filters.allAccounts")}</option>
            {dataset.bankAccounts.map((account) => (
              <option key={account.accountId} value={account.accountId}>
                {account.accountId} - {account.branch}
              </option>
            ))}
          </select>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearch("");
              setAccountFilter("all");
            }}
          >
            {tTreasury("filters.reset")}
          </Button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tTreasury("kpi.cashIn")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {formatCurrency(cashIn, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tTreasury("kpi.cashOut")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {formatCurrency(cashOut, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tTreasury("kpi.cashNet")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {formatCurrency(cashIn - cashOut, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tTreasury("kpi.posPending")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {formatCurrency(posPending, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tTreasury("kpi.bankVariance")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {formatCurrency(bankVariance, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tTreasury("kpi.unmatched")}</p>
          <p className="mt-2 text-lg font-bold text-finance">
            {unmatchedSystemCount}/{unmatchedStatementCount}
          </p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="surface-card overflow-hidden">
          <header className="border-b border-border bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-finance">
              {tTreasury("cashDashboard.title")}
            </h3>
          </header>
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2 text-start">{tTreasury("table.date")}</th>
                  <th className="px-2 py-2 text-start">{tTreasury("table.branch")}</th>
                  <th className="px-2 py-2 text-start">{tTreasury("table.direction")}</th>
                  <th className="px-2 py-2 text-end">{tTreasury("table.amount")}</th>
                  <th className="px-2 py-2 text-start">{tTreasury("table.status")}</th>
                </tr>
              </thead>
              <tbody>
                {displayedCashRows.map((row) => (
                  <tr key={row.id} className="border-b border-border/70">
                    <td className="px-2 py-2">{formatDate(row.date, locale)}</td>
                    <td className="px-2 py-2">{row.branch}</td>
                    <td className="px-2 py-2">{tTreasury(`directions.${row.direction}`)}</td>
                    <td className="px-2 py-2 text-end">
                      {formatCurrency(row.amount, locale, row.currency)}
                    </td>
                    <td className="px-2 py-2">{row.status}</td>
                  </tr>
                ))}
                {!displayedCashRows.length ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">
                      {tTreasury("empty.cash")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="surface-card overflow-hidden">
          <header className="border-b border-border bg-slate-50 px-4 py-3">
            <h3 className="text-sm font-semibold text-finance">
              {tTreasury("posSummary.title")}
            </h3>
          </header>
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-2 py-2 text-start">{tTreasury("posSummary.terminal")}</th>
                  <th className="px-2 py-2 text-start">{tTreasury("table.branch")}</th>
                  <th className="px-2 py-2 text-end">{tTreasury("posSummary.transactions")}</th>
                  <th className="px-2 py-2 text-end">{tTreasury("posSummary.gross")}</th>
                  <th className="px-2 py-2 text-end">{tTreasury("posSummary.pending")}</th>
                </tr>
              </thead>
              <tbody>
                {displayedPosRows.map((row) => (
                  <tr key={row.terminalId} className="border-b border-border/70">
                    <td className="px-2 py-2 font-medium text-finance">{row.terminalId}</td>
                    <td className="px-2 py-2">{row.branch}</td>
                    <td className="px-2 py-2 text-end">{row.transactions}</td>
                    <td className="px-2 py-2 text-end">
                      {formatCurrency(row.grossAmount, locale, "SAR")}
                    </td>
                    <td className="px-2 py-2 text-end">
                      {formatCurrency(row.pendingAmount, locale, "SAR")}
                    </td>
                  </tr>
                ))}
                {!displayedPosRows.length ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-8 text-center text-muted-foreground">
                      {tTreasury("empty.pos")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="surface-card p-4">
        <h3 className="text-sm font-semibold text-finance">{tTreasury("bankOverview.title")}</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {displayedAccounts.map((account) => (
            <article key={account.accountId} className="rounded-md border border-border p-3">
              <p className="text-sm font-semibold text-finance">{account.accountId}</p>
              <p className="text-xs text-muted-foreground">
                {account.bankName} - {account.branch}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{account.iban}</p>
              <dl className="mt-3 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{tTreasury("bankOverview.ledger")}</dt>
                  <dd>{formatCurrency(account.ledgerBalance, locale, account.currency)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{tTreasury("bankOverview.statement")}</dt>
                  <dd>{formatCurrency(account.statementBalance, locale, account.currency)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{tTreasury("bankOverview.available")}</dt>
                  <dd>{formatCurrency(account.availableBalance, locale, account.currency)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-muted-foreground">{tTreasury("bankOverview.lastSync")}</dt>
                  <dd>{formatDate(account.lastSyncAt, locale)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <ReconciliationWorkbench
        systemRows={filteredSystemRows}
        statementRows={filteredStatementRows}
        matches={filteredMatches}
        onCreateMatch={createMatch}
        onRemoveMatch={removeMatch}
      />
    </section>
  );
}
