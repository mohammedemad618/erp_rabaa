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
        announceHotkey("Focused next low-confidence transaction");
      }
      return;
    }
    announceHotkey("No additional low-confidence transaction found");
  }

  useHotkeys([
    {
      key: "/",
      handler: () => {
        searchInputRef.current?.focus();
        announceHotkey("Search focused");
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
      handler: () => announceHotkey("OCR field accepted (UI only)"),
    },
    {
      key: "d",
      alt: true,
      handler: () => announceHotkey("Document zoom opened (UI only)"),
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

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-finance">{tTx("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tTx("subtitle")}</p>
      </header>

      <div className="grid gap-4 min-[1900px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <section className="surface-card p-4">
            <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative">
                  <Search className="pointer-events-none absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    ref={searchInputRef}
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={tCommon("search")}
                    className="h-9 min-w-[220px] rounded-md border border-border bg-white ps-8 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
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

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStatusFilter("pending_approval")}
                >
                  {tTx("filters.quickPendingApproval")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={quickPreset === "cash" ? "bg-slate-100" : ""}
                  onClick={() =>
                    setQuickPreset((current) => (current === "cash" ? "none" : "cash"))
                  }
                >
                  {tTx("filters.quickCashOnly")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={quickPreset === "high_value" ? "bg-slate-100" : ""}
                  onClick={() =>
                    setQuickPreset((current) =>
                      current === "high_value" ? "none" : "high_value",
                    )
                  }
                >
                  {tTx("filters.quickHighValue")}
                </Button>
              </div>

              <div className="flex items-center gap-2">
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

            {notice ? (
              <p className="no-print mb-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-finance">
                {notice}
              </p>
            ) : null}

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
                {rows.length} rows in page, {filteredTransactions.length} matched records
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  Prev
                </Button>
                <span>
                  Page {pagination.pageIndex + 1} / {Math.max(pageCount, 1)}
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  Next
                </Button>
              </div>
            </div>
          </section>

          <section className="surface-card no-print p-4">
            <h3 className="text-sm font-semibold text-finance">{tTx("hotkeys.title")}</h3>
            <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
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

        <aside className="space-y-4 min-[1900px]:sticky min-[1900px]:top-20 min-[1900px]:self-start">
          {selectedTransaction ? (
            <>
              <section className="surface-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-finance">
                      <bdi className="font-mono">{selectedTransaction.id}</bdi>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <bdi>{selectedTransaction.customerName}</bdi>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <bdi className="font-mono">
                        {selectedTransaction.pnr} - {selectedTransaction.ticketNumber}
                      </bdi>
                    </p>
                  </div>
                  <StatusPill status={selectedTransaction.status} />
                </div>

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
                    <dt>Version</dt>
                    <dd>{selectedTransaction.auditMetadata.version}</dd>
                  </div>
                </dl>
              </section>
            </>
          ) : (
            <section className="surface-card p-4 text-sm text-muted-foreground">
              No transaction selected.
            </section>
          )}
        </aside>
      </div>

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
    </section>
  );
}

