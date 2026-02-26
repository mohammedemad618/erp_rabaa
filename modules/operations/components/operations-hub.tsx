"use client";

import { Search, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ErpKpiGrid,
  ErpPageHeader,
  ErpPageLayout,
  ErpSection,
} from "@/components/layout/erp-page-layout";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { cn } from "@/utils/cn";
import { formatCurrency, formatDate } from "@/utils/format";
import { fetchTravelRequests } from "@/services/travel-workflow-api";
import type { Transaction } from "@/modules/transactions/types";
import { transactionStatusOrder } from "@/modules/transactions/types";
import type { AnyServiceBooking } from "@/modules/services/types";
import type { TravelRequest, TravelRequestStatus } from "@/modules/travel/types";
import { mergeOperationsItems } from "../converters";
import type { OperationFilterType, OperationsListItem } from "../types";
import { OperationsStatusPill } from "./operations-status-pill";
import { UnifiedDetailsPanel } from "./unified-details-panel";

const TRAVEL_STATUS_ORDER: Array<TravelRequestStatus | "all"> = [
  "all",
  "draft",
  "submitted",
  "manager_approved",
  "travel_review",
  "finance_approved",
  "booked",
  "closed",
  "rejected",
  "cancelled",
];

function matchesSearch(item: OperationsListItem, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const searchable = [
    item.displayId,
    item.customerOrEmployee,
    item.status,
    String(item.amount),
  ].join(" ");

  if (item.type === "transaction") {
    const tx = item.raw as Transaction;
    if (/^[a-z0-9]{6}$/i.test(query)) return tx.pnr.toLowerCase().includes(query);
    if (/^\d{13}$/.test(query)) return tx.ticketNumber.includes(query);
    if (/^\+?\d{8,15}$/.test(query)) return tx.customerPhone.replace(/\s/g, "").includes(query);
  }

  return searchable.toLowerCase().includes(query);
}

interface OperationsHubProps {
  initialTransactions: Transaction[];
  initialRequests: TravelRequest[];
  allServiceBookings?: AnyServiceBooking[];
}

interface NoticeState {
  message: string;
  requestId?: string;
}

export function OperationsHub({
  initialTransactions,
  initialRequests,
  allServiceBookings = [],
}: OperationsHubProps) {
  const tOps = useTranslations("operations");
  const tTx = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const noticeTimerRef = useRef<number | null>(null);

  const typeFromUrl = searchParams.get("type");
  const modeFromUrl = searchParams.get("mode");
  const createdRequestId = searchParams.get("created");
  const initialType: OperationFilterType =
    typeFromUrl === "travel" ? "travel" : typeFromUrl === "transactions" ? "transactions" : "all";

  const [transactions, setTransactions] = useState(initialTransactions);
  const [requests, setRequests] = useState(initialRequests);
  const [typeFilter, setTypeFilter] = useState<OperationFilterType>(initialType);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [quickPreset, setQuickPreset] = useState<"none" | "pending" | "high_value" | "cash">("none");
  const [selectedId, setSelectedId] = useState<string>("");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const showNotice = useCallback((message: string, requestId?: string) => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }

    setNotice({ message, requestId });
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
    }, 4200);
  }, []);

  const refreshRequestsFromApi = useCallback(async () => {
    try {
      const latestRequests = await fetchTravelRequests();
      setRequests(latestRequests);
    } catch {
      // Keep current rows when the refresh fails.
    }
  }, []);
  const allItems = useMemo(
    () => mergeOperationsItems(transactions, requests, allServiceBookings),
    [allServiceBookings, transactions, requests],
  );

  const filteredItems = useMemo(() => {
    const expectedType = typeFilter === "transactions" ? "transaction" : typeFilter === "travel" ? "travel_request" : null;
    return allItems.filter((item) => {
      if (expectedType && item.type !== expectedType) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (quickPreset === "cash" && item.type !== "transaction") return false;
      if (quickPreset === "cash") {
        const tx = item.raw as Transaction;
        if (tx.paymentMethod !== "cash") return false;
      }
      if (quickPreset === "high_value" && item.amount < 1800) return false;
      if (quickPreset === "pending") {
        if (item.type === "transaction") {
          const tx = item.raw as Transaction;
          if (tx.status !== "pending_approval") return false;
        } else {
          const req = item.raw as TravelRequest;
          if (!["submitted", "manager_approved", "travel_review", "finance_approved"].includes(req.status))
            return false;
        }
      }
      return matchesSearch(item, search);
    });
  }, [allItems, typeFilter, statusFilter, search, quickPreset]);

  useEffect(() => {
    setTransactions(initialTransactions);
    setRequests(initialRequests);
  }, [initialTransactions, initialRequests]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void refreshRequestsFromApi();
  }, [refreshRequestsFromApi]);

  useEffect(() => {
    function handleFocus() {
      void refreshRequestsFromApi();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshRequestsFromApi();
      }
    }

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshRequestsFromApi]);

  useEffect(() => {
    const t = typeFromUrl === "travel" ? "travel" : typeFromUrl === "transactions" ? "transactions" : "all";
    setTypeFilter(t);
  }, [typeFromUrl]);

  // Create request moved to dedicated page. Keep backwards compatibility for old links.
  useEffect(() => {
    if (modeFromUrl === "create") {
      router.replace("/travel/create");
    }
  }, [modeFromUrl, router]);

  useEffect(() => {
    if (!createdRequestId) {
      return;
    }

    let cancelled = false;

    const completeCreateFlow = async () => {
      await refreshRequestsFromApi();
      if (cancelled) {
        return;
      }

      setTypeFilter("travel");
      setStatusFilter("all");
      setQuickPreset("none");
      setSelectedId(createdRequestId);
      showNotice(
        locale === "ar"
          ? `تم إرسال طلب السفر بنجاح. الرقم المرجعي: ${createdRequestId}`
          : `Travel request submitted successfully. Reference: ${createdRequestId}`,
        createdRequestId,
      );

      const params = new URLSearchParams(searchParams.toString());
      params.delete("created");
      const qs = params.toString();
      router.replace(`/operations${qs ? `?${qs}` : ""}`, { scroll: false });
    };

    void completeCreateFlow();
    return () => {
      cancelled = true;
    };
  }, [createdRequestId, locale, refreshRequestsFromApi, router, searchParams, showNotice]);

  const effectiveSelectedId = useMemo(() => {
    if (!selectedId) return "";
    return filteredItems.some((i) => i.id === selectedId) ? selectedId : "";
  }, [filteredItems, selectedId]);

  const selectedItem = filteredItems.find((i) => i.id === effectiveSelectedId) ?? null;

  const statusOptions = useMemo(() => {
    if (typeFilter === "transactions") {
      return transactionStatusOrder;
    }
    if (typeFilter === "travel") {
      return TRAVEL_STATUS_ORDER.filter((s) => s !== "all");
    }
    return [];
  }, [typeFilter]);

  const pendingCount = useMemo(() => {
    return allItems.filter((item) => {
      if (item.type === "transaction") {
        return (item.raw as Transaction).status === "pending_approval";
      }
      const req = item.raw as TravelRequest;
      return ["submitted", "manager_approved", "travel_review", "finance_approved"].includes(req.status);
    }).length;
  }, [allItems]);

  const highValueCount = allItems.filter((i) => i.amount >= 1800).length;
  const cashCount = allItems.filter((i) => i.type === "transaction" && (i.raw as Transaction).paymentMethod === "cash").length;

  function handleRowClick(item: OperationsListItem) {
    setSelectedId(item.id);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mode");
    const qs = params.toString();
    router.replace(`/operations${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function refreshItem(updated: Transaction | TravelRequest) {
    if ("pnr" in updated) {
      setTransactions((prev) => prev.map((t) => (t.id === updated.id ? (updated as Transaction) : t)));
    } else {
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? (updated as TravelRequest) : r)));
    }
  }

  useHotkeys([
    {
      key: "/",
      handler: () => {
        searchInputRef.current?.focus();
        showNotice(tOps("messages.searchFocused"));
      },
    },
    {
      key: "ArrowDown",
      handler: (e) => {
        e.preventDefault();
        if (!filteredItems.length) return;
        const index = filteredItems.findIndex((i) => i.id === effectiveSelectedId);
        if (index < filteredItems.length - 1) {
          const nextId = filteredItems[index + 1].id;
          setSelectedId(nextId);
          rowRefs.current[nextId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      },
    },
    {
      key: "ArrowUp",
      handler: (e) => {
        e.preventDefault();
        if (!filteredItems.length) return;
        const index = filteredItems.findIndex((i) => i.id === effectiveSelectedId);
        if (index > 0) {
          const prevId = filteredItems[index - 1].id;
          setSelectedId(prevId);
          rowRefs.current[prevId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      },
    },
  ]);

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={tOps("title")}
        description={tOps("subtitle")}
        actions={
          <Link href="/travel/create">
            <Button size="sm">
              <Plus className="me-1 h-3.5 w-3.5" />
              {tOps("createTravel")}
            </Button>
          </Link>
        }
      />

      <ErpSection
        className="col-span-12 no-print"
        title={tOps("filters.title")}
        description={tOps("filters.description")}
      >
        <div className="grid gap-2 lg:grid-cols-[1fr_1fr_140px_auto]">
          <label className="relative">
            <Search className="pointer-events-none absolute start-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tCommon("search")}
              className="h-9 w-full rounded-md border border-border bg-white ps-8 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          <div className="flex gap-2">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as OperationFilterType);
                setStatusFilter("all");
              }}
              className="h-9 flex-1 rounded-md border border-border bg-white px-3 text-sm text-foreground"
            >
              <option value="all">{tOps("typeAll")}</option>
              <option value="transactions">{tOps("typeTransactions")}</option>
              <option value="travel">{tOps("typeTravel")}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 flex-1 rounded-md border border-border bg-white px-3 text-sm text-foreground"
            >
              <option value="all">{tCommon("status")}: {tCommon("all")}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {typeFilter === "transactions"
                    ? tTx(`statusValues.${status}`)
                    : tOps(`travelStatus.${status}`)}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setQuickPreset("none");
            }}
          >
            {tOps("filters.reset")}
          </Button>
        </div>

        <div className="mt-3 rounded-md border border-border bg-slate-50/60 p-2">
          <p className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
            {tOps("filters.quickTitle")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={cn(quickPreset === "none" && statusFilter === "all" ? "bg-slate-100" : "")}
              onClick={() => {
                setQuickPreset("none");
                setStatusFilter("all");
              }}
            >
              {tOps("quickAll")} <span className="ms-1 text-xs">{allItems.length}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(quickPreset === "pending" ? "bg-slate-100" : "")}
              onClick={() => setQuickPreset("pending")}
            >
              {tOps("quickPending")} <span className="ms-1 text-xs">{pendingCount}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(quickPreset === "high_value" ? "bg-slate-100" : "")}
              onClick={() => setQuickPreset("high_value")}
            >
              {tOps("quickHighValue")} <span className="ms-1 text-xs">{highValueCount}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(quickPreset === "cash" ? "bg-slate-100" : "")}
              onClick={() => setQuickPreset("cash")}
            >
              {tOps("quickCash")} <span className="ms-1 text-xs">{cashCount}</span>
            </Button>
          </div>
        </div>

        {notice ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-slate-100 px-3 py-2">
            <p className="text-xs text-finance">{notice.message}</p>
            {notice.requestId ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSelectedId(notice.requestId ?? "")}
              >
                {locale === "ar" ? "فتح التفاصيل" : "Open details"}
              </Button>
            ) : null}
          </div>
        ) : null}
      </ErpSection>

      <ErpKpiGrid>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tOps("kpi.matched")}</p>
          <p className="mt-2 text-lg font-bold text-finance" suppressHydrationWarning>{filteredItems.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tOps("kpi.pending")}</p>
          <p className="mt-2 text-lg font-bold text-finance" suppressHydrationWarning>{pendingCount}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tOps("kpi.highValue")}</p>
          <p className="mt-2 text-lg font-bold text-finance" suppressHydrationWarning>{highValueCount}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{tOps("kpi.totalAmount")}</p>
          <p className="mt-2 text-lg font-bold text-finance" suppressHydrationWarning>
            {formatCurrency(
              filteredItems.reduce((s, i) => s + i.amount, 0),
              locale,
              "SAR",
            )}
          </p>
        </article>
      </ErpKpiGrid>

      {/* قائمة العمليات بعرض الصفحة — ملخص المعاملة في صفحة منبثقة */}
      <div className="col-span-12 grid min-h-[calc(100vh-18rem)] grid-cols-1">
        <ErpSection className="flex min-h-0 flex-col overflow-hidden" title={tOps("tableTitle")}>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
            <table className="w-full table-fixed text-sm" aria-label={tOps("tableTitle")}>
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-border">
                  <th className="w-[100px] px-2 py-2 text-start text-xs font-semibold text-muted-foreground">
                    {tOps("table.id")}
                  </th>
                  <th className="w-[80px] px-2 py-2 text-start text-xs font-semibold text-muted-foreground">
                    {tOps("table.type")}
                  </th>
                  <th className="w-[200px] px-2 py-2 text-start text-xs font-semibold text-muted-foreground">
                    {tOps("table.customerOrEmployee")}
                  </th>
                  <th className="w-[120px] px-2 py-2 text-start text-xs font-semibold text-muted-foreground">
                    {tOps("table.amount")}
                  </th>
                  <th className="w-[150px] px-2 py-2 text-start text-xs font-semibold text-muted-foreground">
                    {tOps("table.status")}
                  </th>
                  <th className="w-[160px] px-2 py-2 text-start text-xs font-semibold text-muted-foreground">
                    {tOps("table.createdAt")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length ? (
                  filteredItems.map((item) => {
                    const active = effectiveSelectedId === item.id;
                    return (
                      <tr
                        key={`${item.type}-${item.id}`}
                        ref={(node) => {
                          rowRefs.current[item.id] = node;
                        }}
                        className={cn(
                          "cursor-pointer border-b border-border transition hover:bg-slate-50",
                          active ? "bg-blue-50/70" : "bg-white",
                        )}
                        onClick={() => handleRowClick(item)}
                      >
                        <td className="truncate px-2 py-2 font-mono text-xs">{item.displayId}</td>
                        <td className="truncate px-2 py-2 text-xs">
                          {item.type === "transaction" ? tOps("typeTransactions") : tOps("typeTravel")}
                        </td>
                        <td className="truncate px-2 py-2">{item.customerOrEmployee}</td>
                        <td className="truncate px-2 py-2 font-medium" suppressHydrationWarning>
                          {formatCurrency(item.amount, locale, item.currency)}
                        </td>
                        <td className="truncate px-2 py-2">
                          <OperationsStatusPill item={item} />
                        </td>
                        <td className="truncate px-2 py-2 text-muted-foreground">
                          {formatDate(item.createdAt, locale)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      {tCommon("noResults")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ErpSection>
      </div>

      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedId("")}
        title={
          selectedItem
            ? selectedItem.type === "transaction"
              ? tTx("panel.summary")
              : tOps("panel.travelSummary")
            : ""
        }
        description={
          selectedItem
            ? selectedItem.type === "transaction"
              ? `${(selectedItem.raw as Transaction).pnr} - ${(selectedItem.raw as Transaction).ticketNumber}`
              : `${(selectedItem.raw as TravelRequest).origin} → ${(selectedItem.raw as TravelRequest).destination}`
            : undefined
        }
        size="2xl"
      >
        {selectedItem ? (
          <UnifiedDetailsPanel
            item={selectedItem}
            onRefresh={refreshItem}
            locale={locale}
            allServiceBookings={allServiceBookings}
            embedded={true}
          />
        ) : null}
      </Modal>
    </ErpPageLayout>
  );
}

