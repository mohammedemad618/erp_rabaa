"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Download, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ErpKpiGrid,
  ErpMainSplit,
  ErpPageHeader,
  ErpPageLayout,
  ErpSection,
} from "@/components/layout/erp-page-layout";
import { Button } from "@/components/ui/button";
import { PermissionButton } from "@/components/ui/permission-button";
import { StatusPill } from "@/components/ui/status-pill";
import { useHotkeys } from "@/hooks/use-hotkeys";
import {
  getSalesTransitionOption,
  type SalesTransitionBlockReason,
  type SalesTransitionId,
} from "@/modules/sales/workflow/sales-state-machine";
import { transitionSalesOrder } from "@/services/sales-workflow-api";
import { cn } from "@/utils/cn";
import { formatCurrency, formatDate } from "@/utils/format";
import { AccountingImpactPreview } from "./accounting-impact-preview";
import { ApprovalTimeline } from "./approval-timeline";
import { SalesWorkflowPanel } from "./sales-workflow-panel";
import type { Transaction, TransactionStatus } from "../types";
import { transactionStatusOrder } from "../types";

interface TransactionWorkbenchProps {
  initialTransactions: Transaction[];
}

interface PendingTransition {
  transactionId: string;
  transitionId: SalesTransitionId;
}

function isPnrQuery(query: string): boolean {
  return /^[a-z0-9]{6}$/i.test(query);
}

function isTicketQuery(query: string): boolean {
  return /^\d{13}$/.test(query);
}

function isPhoneQuery(query: string): boolean {
  return /^\+?\d{8,15}$/.test(query);
}

function matchesSearch(transaction: Transaction, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return true;
  }
  if (isPnrQuery(query)) {
    return transaction.pnr.toLowerCase().includes(query);
  }
  if (isTicketQuery(query)) {
    return transaction.ticketNumber.includes(query);
  }
  if (isPhoneQuery(query)) {
    return transaction.customerPhone.replace(/\s/g, "").includes(query);
  }

  return [
    transaction.customerName,
    transaction.customerPhone,
    transaction.pnr,
    transaction.ticketNumber,
    transaction.airline,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function TransactionWorkbench({
  initialTransactions,
}: TransactionWorkbenchProps) {
  const tTx = useTranslations("transactions");
  const tSales = useTranslations("salesFlow");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const hotkeyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [transactions, setTransactions] = useState(initialTransactions);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "all">("all");
  const [quickPreset, setQuickPreset] = useState<"none" | "cash" | "high_value">("none");
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });
  const [selectedId, setSelectedId] = useState(initialTransactions[0]?.id ?? "");
  const [hotkeyMessage, setHotkeyMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");
  const [isApplyingTransition, setIsApplyingTransition] = useState(false);

  useEffect(() => {
    setTransactions(initialTransactions);
    setSelectedId(initialTransactions[0]?.id ?? "");
  }, [initialTransactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (statusFilter !== "all" && transaction.status !== statusFilter) {
        return false;
      }
      if (quickPreset === "cash" && transaction.paymentMethod !== "cash") {
        return false;
      }
      if (quickPreset === "high_value" && transaction.totalAmount < 1800) {
        return false;
      }
      return matchesSearch(transaction, search);
    });
  }, [quickPreset, search, statusFilter, transactions]);

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            aria-label="Select all rows"
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            aria-label={`Select row ${row.original.id}`}
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            onClick={(event) => event.stopPropagation()}
          />
        ),
        size: 40,
        enableSorting: false,
      },
      {
        accessorKey: "id",
        header: tTx("table.id"),
        size: 120,
        cell: ({ row }) => <bdi className="font-mono">{row.original.id}</bdi>,
      },
      {
        accessorKey: "pnr",
        header: tTx("table.pnr"),
        size: 80,
        cell: ({ row }) => <bdi className="font-mono">{row.original.pnr}</bdi>,
      },
      {
        accessorKey: "ticketNumber",
        header: tTx("table.ticket"),
        size: 140,
        cell: ({ row }) => <bdi className="font-mono">{row.original.ticketNumber}</bdi>,
      },
      {
        accessorKey: "customerName",
        header: tTx("table.customer"),
        size: 200,
        cell: ({ row }) => <bdi>{row.original.customerName}</bdi>,
      },
      {
        accessorKey: "airline",
        header: tTx("table.airline"),
        size: 140,
      },
      {
        accessorKey: "totalAmount",
        header: tTx("table.total"),
        size: 120,
        cell: ({ row }) =>
          formatCurrency(row.original.totalAmount, locale, row.original.currency),
      },
      {
        accessorKey: "status",
        header: tTx("table.status"),
        size: 150,
        cell: ({ row }) => <StatusPill status={row.original.status} />,
      },
      {
        accessorKey: "createdAt",
        header: tTx("table.createdAt"),
        size: 160,
        cell: ({ row }) => formatDate(row.original.createdAt, locale),
      },
    ],
    [locale, tTx],
  );

  const table = useReactTable({
    data: filteredTransactions,
    columns,
    state: {
      sorting,
      rowSelection,
      pagination,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;

  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
  }, [quickPreset, search, statusFilter]);

  useEffect(() => {
    if (!filteredTransactions.length) {
      setSelectedId("");
      return;
    }
    const stillExists = filteredTransactions.some((item) => item.id === selectedId);
    if (!stillExists) {
      setSelectedId(filteredTransactions[0].id);
    }
  }, [filteredTransactions, selectedId]);

  useEffect(() => {
    return () => {
      if (hotkeyTimerRef.current) {
        clearTimeout(hotkeyTimerRef.current);
      }
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  function announceHotkey(message: string): void {
    setHotkeyMessage(message);
    if (hotkeyTimerRef.current) {
      clearTimeout(hotkeyTimerRef.current);
    }
    hotkeyTimerRef.current = setTimeout(() => setHotkeyMessage(""), 2000);
  }

  function showNotice(message: string): void {
    setNotice(message);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => setNotice(""), 2800);
  }

  function blockedReasonMessage(reason?: SalesTransitionBlockReason): string {
    if (reason === "approval_required") {
      return tSales("reasons.approval_required");
    }
    if (reason === "state_not_allowed") {
      return tSales("reasons.state_not_allowed");
    }
    return tSales("notReady");
  }

  function scrollRowIntoView(transactionId: string): void {
    const rowNode = rowRefs.current[transactionId];
    if (rowNode) {
      rowNode.scrollIntoView({ block: "nearest" });
    }
  }

  function moveSelection(offset: number): void {
    if (!rows.length) {
      return;
    }
    const currentIndex = rows.findIndex((row) => row.original.id === selectedId);
    const safeCurrent = currentIndex < 0 ? 0 : currentIndex;
    const nextIndex = Math.max(0, Math.min(rows.length - 1, safeCurrent + offset));
    const target = rows[nextIndex]?.original.id;
    if (target) {
      setSelectedId(target);
      scrollRowIntoView(target);
    }
  }

  function jumpToNextLowConfidence(): void {
    if (!rows.length) {
      return;
    }
    const currentIndex = rows.findIndex((row) => row.original.id === selectedId);
    const startFrom = currentIndex < 0 ? 0 : currentIndex + 1;
    const nextIndex = rows.findIndex(
      (row, index) =>
        index >= startFrom &&
        (row.original.status === "ocr_reviewed" ||
          row.original.status === "pending_approval"),
    );
    if (nextIndex >= 0) {
      const target = rows[nextIndex]?.original.id;
      if (target) {
        setSelectedId(target);
        scrollRowIntoView(target);
        announceHotkey(tTx("messages.nextLowConfidenceFocused"));
      }
      return;
    }
    announceHotkey(tTx("messages.noLowConfidence"));
  }

  useHotkeys([
    {
      key: "/",
      handler: () => {
        searchInputRef.current?.focus();
        announceHotkey(tTx("messages.searchFocused"));
      },
    },
    {
      key: "j",
      handler: () => moveSelection(1),
    },
    {
      key: "k",
      handler: () => moveSelection(-1),
    },
    {
      key: "n",
      alt: true,
      handler: () => jumpToNextLowConfidence(),
    },
    {
      key: "a",
      alt: true,
      handler: () => announceHotkey(tTx("messages.ocrFieldAccepted")),
    },
    {
      key: "d",
      alt: true,
      handler: () => announceHotkey(tTx("messages.documentZoomOpened")),
    },
  ]);

  const selectedTransaction =
    filteredTransactions.find((transaction) => transaction.id === selectedId) ?? null;

  async function executeTransition(
    transactionId: string,
    transitionId: SalesTransitionId,
    fromPinFlow = false,
    pinToken?: string,
  ): Promise<void> {
    const transaction = transactions.find((item) => item.id === transactionId);
    if (!transaction) {
      return;
    }

    const evaluation = getSalesTransitionOption(transitionId, {
      state: transaction.status,
      approvalState: transaction.approvalState,
    });

    if (!evaluation.allowed) {
      showNotice(blockedReasonMessage(evaluation.blockedReason));
      return;
    }

    setIsApplyingTransition(true);

    try {
      const result = await transitionSalesOrder({
        orderId: transactionId,
        transitionId,
        pinToken,
      });

      setTransactions((previous) =>
        previous.map((item) => (item.id === transactionId ? result.transaction : item)),
      );

      showNotice(
        fromPinFlow
          ? tSales("messages.executedWithPin", {
              action: tSales(`actions.${transitionId}`),
            })
          : tSales("messages.executed", {
              action: tSales(`actions.${transitionId}`),
            }),
      );
    } catch (error) {
      const fallback = tSales("messages.apiFailed");
      const message = error instanceof Error ? error.message : fallback;
      showNotice(message || fallback);
    } finally {
      setIsApplyingTransition(false);
    }
  }

  function requestTransition(transitionId: SalesTransitionId): void {
    if (!selectedTransaction || isApplyingTransition) {
      return;
    }

    const evaluation = getSalesTransitionOption(transitionId, {
      state: selectedTransaction.status,
      approvalState: selectedTransaction.approvalState,
    });

    if (!evaluation.allowed) {
      showNotice(blockedReasonMessage(evaluation.blockedReason));
      return;
    }

    if (evaluation.requiresPin) {
      setPendingTransition({
        transactionId: selectedTransaction.id,
        transitionId,
      });
      setPinValue("");
      setPinError("");
      return;
    }

    void executeTransition(selectedTransaction.id, transitionId);
  }

  async function confirmPinTransition(): Promise<void> {
    if (!pendingTransition || isApplyingTransition) {
      return;
    }
    if (pinValue.trim() !== "1234") {
      setPinError(tSales("messages.invalidPin"));
      return;
    }

    await executeTransition(
      pendingTransition.transactionId,
      pendingTransition.transitionId,
      true,
      pinValue.trim(),
    );
    setPendingTransition(null);
    setPinValue("");
    setPinError("");
  }

  async function batchApproveSelection(): Promise<void> {
    const selectedRows = table.getSelectedRowModel().rows;
    if (!selectedRows.length || isApplyingTransition) {
      return;
    }

    setIsApplyingTransition(true);

    let successCount = 0;
    let blockedCount = 0;
    let failedCount = 0;

    try {
      for (const row of selectedRows) {
        const transaction = row.original;
        const evaluation = getSalesTransitionOption("approve_sale", {
          state: transaction.status,
          approvalState: transaction.approvalState,
        });

        if (!evaluation.allowed) {
          blockedCount += 1;
          continue;
        }

        try {
          const result = await transitionSalesOrder({
            orderId: transaction.id,
            transitionId: "approve_sale",
          });
          successCount += 1;
          setTransactions((previous) =>
            previous.map((item) =>
              item.id === transaction.id ? result.transaction : item,
            ),
          );
        } catch {
          failedCount += 1;
        }
      }

      showNotice(
        tSales("messages.batchResult", {
          success: successCount.toString(),
          blocked: blockedCount.toString(),
          failed: failedCount.toString(),
        }),
      );
    } finally {
      setIsApplyingTransition(false);
    }
  }

  const selectedCount = table.getSelectedRowModel().rows.length;
  const pageCount = table.getPageCount();
  const pendingApprovalCount = filteredTransactions.filter(
    (transaction) => transaction.status === "pending_approval",
  ).length;
  const ocrReviewedCount = filteredTransactions.filter(
    (transaction) => transaction.status === "ocr_reviewed",
  ).length;
  const highValueCount = filteredTransactions.filter(
    (transaction) => transaction.totalAmount >= 1800,
  ).length;
  const cashOnlyCount = filteredTransactions.filter(
    (transaction) => transaction.paymentMethod === "cash",
  ).length;

  function applyQueue(
    queue: "all" | "pending_approval" | "ocr_reviewed" | "high_value" | "cash",
  ): void {
    if (queue === "all") {
      setStatusFilter("all");
      setQuickPreset("none");
      return;
    }
    if (queue === "high_value") {
      setStatusFilter("all");
      setQuickPreset("high_value");
      return;
    }
    if (queue === "cash") {
      setStatusFilter("all");
      setQuickPreset("cash");
      return;
    }
    setStatusFilter(queue);
    setQuickPreset("none");
  }

  function resetFilters(): void {
    setSearch("");
    setStatusFilter("all");
    setQuickPreset("none");
  }

  return (
    <ErpPageLayout>
      <ErpPageHeader title={tTx("title")} description={tTx("subtitle")} />

      <ErpSection
        className="col-span-12 no-print"
        title={tTx("actionable.title")}
        description={tTx("actionable.description")}
      >
        <div className="grid gap-2 lg:grid-cols-[1.35fr_1fr_180px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tCommon("search")}
              className="h-9 w-full rounded-md border border-border bg-white ps-8 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as TransactionStatus | "all")
            }
            className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground"
          >
            <option value="all">
              {tCommon("status")}: {tCommon("all")}
            </option>
            {transactionStatusOrder.map((status) => (
              <option key={status} value={status}>
                {tTx(`statusValues.${status}`)}
              </option>
            ))}
          </select>

          <select
            value={pagination.pageSize}
            onChange={(event) =>
              setPagination((previous) => ({
                ...previous,
                pageIndex: 0,
                pageSize: Number(event.target.value),
              }))
            }
            className="h-9 rounded-md border border-border bg-white px-3 text-sm text-foreground"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {tTx("pagination.rowsPerPage")}: {size}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedCount === 0 || isApplyingTransition}
              onClick={() => void batchApproveSelection()}
            >
              {tTx("actions.batchApprove")} ({selectedCount})
            </Button>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Download className="me-1 h-3.5 w-3.5" />
              {tTx("actions.exportPdf")}
            </Button>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-border bg-slate-50/60 p-2">
          <p className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
            {tTx("filters.queueTitle")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                statusFilter === "all" && quickPreset === "none" ? "bg-slate-100" : "",
              )}
              onClick={() => applyQueue("all")}
            >
              {tTx("filters.queueAll")} <span className="ms-1 text-xs">{transactions.length}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                statusFilter === "pending_approval" && quickPreset === "none"
                  ? "bg-slate-100"
                  : "",
              )}
              onClick={() => applyQueue("pending_approval")}
            >
              {tTx("filters.quickPendingApproval")}{" "}
              <span className="ms-1 text-xs">{pendingApprovalCount}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                statusFilter === "ocr_reviewed" && quickPreset === "none" ? "bg-slate-100" : "",
              )}
              onClick={() => applyQueue("ocr_reviewed")}
            >
              {tTx("filters.queueOcrReviewed")}{" "}
              <span className="ms-1 text-xs">{ocrReviewedCount}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(quickPreset === "high_value" ? "bg-slate-100" : "")}
              onClick={() => applyQueue("high_value")}
            >
              {tTx("filters.quickHighValue")}{" "}
              <span className="ms-1 text-xs">{highValueCount}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(quickPreset === "cash" ? "bg-slate-100" : "")}
              onClick={() => applyQueue("cash")}
            >
              {tTx("filters.quickCashOnly")}{" "}
              <span className="ms-1 text-xs">{cashOnlyCount}</span>
            </Button>
            <Button variant="secondary" size="sm" onClick={resetFilters}>
              {tTx("filters.resetFilters")}
            </Button>
          </div>
        </div>

        {notice ? (
          <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-finance">{notice}</p>
        ) : null}
      </ErpSection>

      <ErpKpiGrid>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tTx("kpi.matchedRecords")}</p>
          <p className="mt-2 text-lg font-bold text-finance">{filteredTransactions.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tTx("kpi.pendingApproval")}</p>
          <p className="mt-2 text-lg font-bold text-finance">{pendingApprovalCount}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tTx("kpi.highValue")}</p>
          <p className="mt-2 text-lg font-bold text-finance">{highValueCount}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tTx("kpi.selectedRows")}</p>
          <p className="mt-2 text-lg font-bold text-finance">{selectedCount}</p>
        </article>
      </ErpKpiGrid>

      <ErpMainSplit
        asideFirst={locale === "ar"}
        className="min-[1900px]:grid-cols-[minmax(0,1fr)_340px]"
        primary={
          <>
            <ErpSection className="col-span-12" title={tTx("tableTitle")}>
              <div
                ref={listContainerRef}
                className="h-[520px] overflow-auto rounded-md border border-border"
              >
                <table className="w-full table-fixed text-sm" aria-label="Transactions table">
                  <thead className="sticky top-0 z-10 bg-white">
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id} className="border-b border-border">
                        {headerGroup.headers.map((header) => {
                          const sortState = header.column.getIsSorted();
                          return (
                            <th
                              key={header.id}
                              style={{ width: header.getSize() }}
                              className="px-2 py-2 text-start text-xs font-semibold text-muted-foreground"
                            >
                              {header.isPlaceholder ? null : (
                                <button
                                  type="button"
                                  onClick={header.column.getToggleSortingHandler()}
                                  className={cn(
                                    "inline-flex items-center gap-1",
                                    header.column.getCanSort()
                                      ? "cursor-pointer hover:text-foreground"
                                      : "cursor-default",
                                  )}
                                >
                                  {flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                                  {sortState === "asc"
                                    ? "^"
                                    : sortState === "desc"
                                      ? "v"
                                      : ""}
                                </button>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>

                  <tbody>
                    {rows.length ? (
                      rows.map((row) => {
                        const active = selectedId === row.original.id;

                        return (
                          <tr
                            key={row.id}
                            ref={(node) => {
                              rowRefs.current[row.original.id] = node;
                            }}
                            className={cn(
                              "cursor-pointer border-b border-border transition hover:bg-slate-50",
                              active ? "bg-blue-50/70" : "bg-white",
                            )}
                            onClick={() => setSelectedId(row.original.id)}
                          >
                            {row.getVisibleCells().map((cell) => (
                              <td
                                key={cell.id}
                                style={{ width: cell.column.getSize() }}
                                className="truncate px-2 py-2"
                              >
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </td>
                            ))}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="px-3 py-8 text-center text-sm text-muted-foreground"
                        >
                          {tCommon("noResults")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="no-print mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <p>
                  {rows.length} {tTx("pagination.rowsInPage")}, {filteredTransactions.length}{" "}
                  {tTx("pagination.matchedRecords")}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!table.getCanPreviousPage()}
                    onClick={() => table.previousPage()}
                  >
                    {tTx("pagination.prev")}
                  </Button>
                  <span>
                    {tTx("pagination.page")} {pagination.pageIndex + 1} / {Math.max(pageCount, 1)}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!table.getCanNextPage()}
                    onClick={() => table.nextPage()}
                  >
                    {tTx("pagination.next")}
                  </Button>
                </div>
              </div>
            </ErpSection>
          </>
        }
        secondary={
          <div className="space-y-4">
            {selectedTransaction ? (
              <>
                <section className="surface-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-finance">{tTx("panel.summary")}</h3>
                    <StatusPill status={selectedTransaction.status} />
                  </div>

                  <p className="mt-2 text-sm font-semibold text-finance">
                    <bdi className="font-mono">{selectedTransaction.id}</bdi>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <bdi className="font-mono">
                      {selectedTransaction.pnr} - {selectedTransaction.ticketNumber}
                    </bdi>
                  </p>

                  <dl className="mt-3 grid gap-x-3 gap-y-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>
                      <dt className="text-[11px]">{tTx("table.customer")}</dt>
                      <dd className="text-sm text-foreground">
                        <bdi>{selectedTransaction.customerName}</bdi>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px]">{tTx("panel.customerPhone")}</dt>
                      <dd className="text-sm text-foreground">
                        <bdi>{selectedTransaction.customerPhone}</bdi>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px]">{tTx("table.airline")}</dt>
                      <dd className="text-sm text-foreground">
                        <bdi>{selectedTransaction.airline}</bdi>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px]">{tTx("panel.branch")}</dt>
                      <dd className="text-sm text-foreground">
                        <bdi>{selectedTransaction.branch}</bdi>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px]">{tTx("panel.agent")}</dt>
                      <dd className="text-sm text-foreground">
                        <bdi>{selectedTransaction.agent}</bdi>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px]">{tTx("panel.paymentMethod")}</dt>
                      <dd className="text-sm text-foreground">
                        {tTx(`paymentMethods.${selectedTransaction.paymentMethod}`)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px]">{tTx("table.total")}</dt>
                      <dd className="text-sm text-foreground">
                        {formatCurrency(
                          selectedTransaction.totalAmount,
                          locale,
                          selectedTransaction.currency,
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px]">{tTx("table.createdAt")}</dt>
                      <dd className="text-sm text-foreground">
                        {formatDate(selectedTransaction.createdAt, locale)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px]">{tTx("panel.issuedAt")}</dt>
                      <dd className="text-sm text-foreground">
                        {formatDate(selectedTransaction.issuedAt, locale)}
                      </dd>
                    </div>
                  </dl>
                </section>

                <section className="surface-card p-4">
                  <h3 className="text-sm font-semibold text-finance">{tTx("panel.quickActions")}</h3>
                  <div className="no-print mt-3 flex flex-wrap gap-2">
                    <PermissionButton
                      action="refund"
                      transaction={selectedTransaction}
                      label={tTx("actions.refund")}
                      requiresPinLabel={tTx("actions.requiresPin")}
                      disabled={isApplyingTransition}
                      onClick={() => requestTransition("refund_sale")}
                    />
                    <PermissionButton
                      action="void"
                      transaction={selectedTransaction}
                      label={tTx("actions.void")}
                      requiresPinLabel={tTx("actions.requiresPin")}
                      disabled={isApplyingTransition}
                      onClick={() => requestTransition("void_sale")}
                    />
                  </div>
                </section>

                <AccountingImpactPreview transaction={selectedTransaction} />
                <SalesWorkflowPanel
                  transaction={selectedTransaction}
                  onExecuteTransition={requestTransition}
                  isExecuting={isApplyingTransition}
                />
                <ApprovalTimeline transaction={selectedTransaction} />

                <section className="surface-card p-4 text-sm">
                  <h3 className="text-sm font-semibold text-finance">{tTx("panel.auditMeta")}</h3>
                  <dl className="mt-3 space-y-2 text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <dt>{tTx("panel.createdBy")}</dt>
                      <dd>{selectedTransaction.auditMetadata.createdBy}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>{tTx("panel.updatedBy")}</dt>
                      <dd>{selectedTransaction.auditMetadata.updatedBy}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt>{tTx("panel.version")}</dt>
                      <dd>{selectedTransaction.auditMetadata.version}</dd>
                    </div>
                  </dl>
                </section>
              </>
            ) : (
              <section className="surface-card p-4 text-sm text-muted-foreground">
                {tTx("empty.noSelection")}
              </section>
            )}

            <section className="surface-card no-print p-4">
              <h3 className="text-sm font-semibold text-finance">{tTx("hotkeys.title")}</h3>
              <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                <p>{tTx("hotkeys.focusSearch")}</p>
                <p>{tTx("hotkeys.nextRow")}</p>
                <p>{tTx("hotkeys.prevRow")}</p>
                <p>{tTx("hotkeys.nextLowConfidence")}</p>
                <p>{tTx("hotkeys.acceptField")}</p>
                <p>{tTx("hotkeys.zoomDocument")}</p>
              </div>
              {hotkeyMessage ? (
                <p className="mt-2 rounded-md bg-slate-100 px-2 py-1 text-xs text-finance">
                  {hotkeyMessage}
                </p>
              ) : null}
            </section>
          </div>
        }
      />

      {pendingTransition ? (
        <div className="no-print fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-sm rounded-lg border border-border bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-finance">{tSales("pinTitle")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{tSales("pinSubtitle")}</p>

            <label className="mt-3 block text-xs text-muted-foreground">
              {tSales("pinLabel")}
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pinValue}
                onChange={(event) => setPinValue(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            {pinError ? (
              <p className="mt-2 rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">
                {pinError}
              </p>
            ) : null}

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={isApplyingTransition}
                onClick={() => {
                  setPendingTransition(null);
                  setPinValue("");
                  setPinError("");
                }}
              >
                {tSales("cancel")}
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={isApplyingTransition}
                onClick={() => void confirmPinTransition()}
              >
                {tSales("confirm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ErpPageLayout>
  );
}

