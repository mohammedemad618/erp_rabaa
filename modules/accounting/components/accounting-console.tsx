"use client";

import { Building2, CalendarClock, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  ErpKpiGrid,
  ErpPageHeader,
  ErpPageLayout,
  ErpSection,
} from "@/components/layout/erp-page-layout";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/format";
import type { AccountingDataset } from "../types";
import {
  absDiff,
  aggregateBalanceSheet,
  aggregateProfitLoss,
  aggregateTrialBalance,
  isWithinPeriod,
  sumCredit,
  sumDebit,
  toDirectionalNet,
  type PeriodPreset,
} from "../utils/aggregations";
import { BalanceSheetTab } from "./balance-sheet-tab";
import { JournalTab } from "./journal-tab";
import { LedgerTab } from "./ledger-tab";
import { PnlTab } from "./pnl-tab";
import { TrialBalanceTab } from "./trial-balance-tab";

type AccountingTab = "journal" | "ledger" | "trial_balance" | "pnl" | "balance_sheet";

const PAGE_SIZE = 120;

interface AccountingConsoleProps {
  dataset: AccountingDataset;
}

export function AccountingConsole({ dataset }: AccountingConsoleProps) {
  const tAccounting = useTranslations("accounting");
  const locale = useLocale();
  const nowMs = useMemo(() => {
    return dataset.journalRows.reduce((max, row) => {
      return Math.max(max, new Date(row.date).getTime());
    }, 0);
  }, [dataset.journalRows]);

  const [activeTab, setActiveTab] = useState<AccountingTab>("journal");
  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("all");
  const [period, setPeriod] = useState<PeriodPreset>("30");
  const [selectedAccount, setSelectedAccount] = useState(dataset.accounts[0] ?? "");
  const [journalPage, setJournalPage] = useState(0);

  const filteredRows = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return dataset.journalRows.filter((row) => {
      if (branch !== "all" && row.branch !== branch) {
        return false;
      }
      if (!isWithinPeriod(row.date, period, nowMs)) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return (
        row.entryId.toLowerCase().includes(normalized) ||
        row.reference.toLowerCase().includes(normalized) ||
        row.account.toLowerCase().includes(normalized) ||
        row.airline.toLowerCase().includes(normalized) ||
        row.agent.toLowerCase().includes(normalized)
      );
    });
  }, [branch, dataset.journalRows, nowMs, period, search]);

  const safeSelectedAccount = dataset.accounts.includes(selectedAccount)
    ? selectedAccount
    : dataset.accounts[0] ?? "";

  const journalPageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safeJournalPage = Math.min(journalPage, journalPageCount - 1);
  const journalRows = filteredRows.slice(
    safeJournalPage * PAGE_SIZE,
    safeJournalPage * PAGE_SIZE + PAGE_SIZE,
  );

  const filteredDebit = sumDebit(filteredRows);
  const filteredCredit = sumCredit(filteredRows);
  const filteredImbalance = absDiff(filteredDebit, filteredCredit);
  const postedFilteredRows = useMemo(
    () => filteredRows.filter((row) => row.state !== "draft"),
    [filteredRows],
  );

  const trialBalanceRows = useMemo(
    () => aggregateTrialBalance(postedFilteredRows),
    [postedFilteredRows],
  );
  const trialTotalDebit = sumDebit(trialBalanceRows);
  const trialTotalCredit = sumCredit(trialBalanceRows);

  const ledgerRows = useMemo(() => {
    if (!safeSelectedAccount) {
      return [];
    }
    const category = dataset.accountCategories[safeSelectedAccount] ?? "asset";
    const rows = filteredRows
      .filter((row) => row.account === safeSelectedAccount)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let running = 0;
    return rows.map((row) => {
      running += toDirectionalNet(category, row.debit, row.credit);
      return {
        ...row,
        runningBalance: running,
      };
    });
  }, [dataset.accountCategories, filteredRows, safeSelectedAccount]);

  const ledgerDebit = sumDebit(ledgerRows);
  const ledgerCredit = sumCredit(ledgerRows);
  const ledgerMovement = ledgerRows[ledgerRows.length - 1]?.runningBalance ?? 0;

  const profitLoss = useMemo(
    () => aggregateProfitLoss(postedFilteredRows),
    [postedFilteredRows],
  );
  const balanceSheet = useMemo(
    () => aggregateBalanceSheet(trialBalanceRows),
    [trialBalanceRows],
  );

  const tabs: Array<{ key: AccountingTab; label: string }> = [
    { key: "journal", label: tAccounting("tabs.journal") },
    { key: "ledger", label: tAccounting("tabs.ledger") },
    { key: "trial_balance", label: tAccounting("tabs.trialBalance") },
    { key: "pnl", label: tAccounting("tabs.pnl") },
    { key: "balance_sheet", label: tAccounting("tabs.balanceSheet") },
  ];

  return (
    <ErpPageLayout>
      <ErpPageHeader title={tAccounting("title")} description={tAccounting("subtitle")} />

      <ErpSection
        className="col-span-12 no-print"
        title={locale === "ar" ? "عناصر قابلة للتنفيذ" : "Actionable Controls"}
      >
        <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr]">
          <label className="relative">
            <Search className="pointer-events-none absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tAccounting("filters.searchPlaceholder")}
              className="h-9 w-full rounded-md border border-border bg-white ps-8 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <label className="flex items-center gap-2 rounded-md border border-border bg-white px-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <select
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              className="h-9 w-full bg-transparent text-sm outline-none"
            >
              <option value="all">{tAccounting("filters.allBranches")}</option>
              {dataset.branches.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-md border border-border bg-white px-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value as PeriodPreset)}
              className="h-9 w-full bg-transparent text-sm outline-none"
            >
              <option value="all">{tAccounting("filters.periodAll")}</option>
              <option value="30">{tAccounting("filters.period30")}</option>
              <option value="7">{tAccounting("filters.period7")}</option>
            </select>
          </label>
        </div>
      </ErpSection>

      <ErpKpiGrid className="xl:grid-cols-5">
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tAccounting("kpi.posted")}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{dataset.metrics.postedEntries}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tAccounting("kpi.draft")}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{dataset.metrics.draftEntries}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tAccounting("kpi.debit")}</p>
          <p className="mt-2 text-xl font-bold text-finance">
            {formatCurrency(filteredDebit, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tAccounting("kpi.credit")}</p>
          <p className="mt-2 text-xl font-bold text-finance">
            {formatCurrency(filteredCredit, locale, "SAR")}
          </p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tAccounting("kpi.imbalance")}</p>
          <p className="mt-2 text-xl font-bold text-finance">
            {formatCurrency(filteredImbalance, locale, "SAR")}
          </p>
        </article>
      </ErpKpiGrid>

      <ErpSection className="col-span-12">
        <div className="no-print mb-4 flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.key}
              variant={activeTab === tab.key ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </Button>
          ))}
          <span className="ms-auto text-xs text-muted-foreground">
            {tAccounting("filters.showing")}: {filteredRows.length}
          </span>
        </div>

        {activeTab === "journal" ? (
          <JournalTab
            rows={journalRows}
            locale={locale}
            page={safeJournalPage}
            pageCount={journalPageCount}
            totalRows={filteredRows.length}
            onPrevPage={() => setJournalPage((prev) => Math.max(prev - 1, 0))}
            onNextPage={() =>
              setJournalPage((prev) => Math.min(prev + 1, journalPageCount - 1))
            }
          />
        ) : null}

        {activeTab === "ledger" ? (
          <LedgerTab
            locale={locale}
            account={safeSelectedAccount}
            accounts={dataset.accounts}
            rows={ledgerRows}
            debitTotal={ledgerDebit}
            creditTotal={ledgerCredit}
            movement={ledgerMovement}
            onAccountChange={setSelectedAccount}
          />
        ) : null}

        {activeTab === "trial_balance" ? (
          <TrialBalanceTab
            rows={trialBalanceRows}
            locale={locale}
            totalDebit={trialTotalDebit}
            totalCredit={trialTotalCredit}
          />
        ) : null}

        {activeTab === "pnl" ? <PnlTab locale={locale} data={profitLoss} /> : null}

        {activeTab === "balance_sheet" ? (
          <BalanceSheetTab locale={locale} data={balanceSheet} />
        ) : null}
      </ErpSection>
    </ErpPageLayout>
  );
}
