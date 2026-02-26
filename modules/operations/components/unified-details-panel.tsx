"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/format";
import { AccountingImpactPreview } from "@/modules/transactions/components/accounting-impact-preview";
import { transitionSalesOrder } from "@/services/sales-workflow-api";
import { transitionTravelRequest } from "@/services/travel-workflow-api";
import { mapEnterpriseRoleToTravelActorRole } from "@/services/auth/role-mapping";
import type { EnterpriseRole } from "@/services/auth/types";
import type { SalesTransitionId } from "@/modules/sales/workflow/sales-state-machine";
import type { TravelTransitionId } from "@/modules/travel/workflow/travel-approval-engine";
import type { AnyServiceBooking } from "@/modules/services/types";
import { SERVICE_CATEGORIES } from "@/modules/services/types";
import type { Transaction } from "@/modules/transactions/types";
import { getTravelDictionary } from "@/modules/travel/i18n";
import type { TravelRequest } from "@/modules/travel/types";
import type { OperationsListItem } from "../types";
import { OperationsStatusPill } from "./operations-status-pill";
import { UnifiedApprovalTimeline } from "./unified-approval-timeline";
import { UnifiedWorkflowPanel } from "./unified-workflow-panel";

function LinkedServicesSection({
  request,
  allServiceBookings,
  locale,
  t,
}: {
  request: TravelRequest;
  allServiceBookings: AnyServiceBooking[];
  locale: string;
  t: (key: string) => string;
}) {
  const linkedBookings = request.linkedServiceBookings
    .map((id) => allServiceBookings.find((b) => b.id === id))
    .filter((b): b is AnyServiceBooking => b != null);

  return (
    <section className="surface-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-finance">{t("panel.linkedServicesTitle")}</h3>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
          {linkedBookings.length} {locale === "ar" ? "خدمة" : "service(s)"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t("panel.linkedServicesDesc")}</p>

      {linkedBookings.length > 0 ? (
        <div className="mt-4 space-y-3">
          {linkedBookings.map((booking) => {
            const catInfo = SERVICE_CATEGORIES.find((c) => c.id === booking.category);
            return (
              <article
                key={booking.id}
                className="rounded-lg border border-border bg-white p-3 text-xs transition hover:shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${catInfo?.bgColor ?? "bg-slate-50"}`}>
                      <span className="text-xs font-bold">{booking.id.split("-")[0]}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-finance">{booking.id}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {locale === "ar" ? catInfo?.labelAr : catInfo?.labelEn}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    booking.status === "confirmed" ? "bg-emerald-100 text-emerald-700" :
                    booking.status === "pending" ? "bg-amber-100 text-amber-700" :
                    booking.status === "completed" ? "bg-slate-100 text-slate-600" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {booking.status}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("panel.customer")}</span>
                    <span className="font-medium text-finance">{booking.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("panel.amountLabel")}</span>
                    <span className="font-medium text-finance">{formatCurrency(booking.totalAmount, locale, booking.currency)}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <span className="text-lg text-slate-400">🔗</span>
          </div>
          <p className="text-sm font-medium text-finance">{t("panel.linkedServicesEmpty")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("panel.linkedServicesEmptyDesc")}</p>
        </div>
      )}
    </section>
  );
}

function AuditTrailSection({ request, locale }: { request: TravelRequest; locale: string }) {
  const t = getTravelDictionary(locale as "en" | "ar");

  return (
    <section className="surface-card p-4">
      <h3 className="text-sm font-semibold text-finance">{t.labels.auditTrail}</h3>
      <div className="mt-3 max-h-[360px] space-y-2 overflow-auto pe-1">
        {request.auditTrail
          .slice()
          .reverse()
          .map((event) => (
            <div key={event.id} className="rounded-md border border-border px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-finance">
                  {t.transition[event.action as TravelTransitionId] ?? event.action}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {formatDate(event.at, locale)}
                </span>
              </div>
              <div className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                <p>
                  {t.audit.actor}: {event.actorName} ({t.roles[event.actorRole]})
                </p>
                <p>
                  {t.audit.fromTo}: {event.fromStatus ? t.status[event.fromStatus] : "-"}
                  {" -> "}
                  {t.status[event.toStatus]}
                </p>
                {event.note ? (
                  <p>
                    {t.audit.note}: {event.note}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}

interface SessionPayload {
  authenticated: boolean;
  user?: { id: string; name: string; email: string; role: string };
}

interface UnifiedDetailsPanelProps {
  item: OperationsListItem | null;
  onRefresh: (updated: Transaction | TravelRequest) => void;
  locale: string;
  allServiceBookings?: AnyServiceBooking[];
  /** Optional: show compact header when embedded in master-detail layout */
  embedded?: boolean;
}

type DetailTab = "overview" | "workflow" | "approval" | "accounting" | "services" | "audit";

export function UnifiedDetailsPanel({
  item,
  onRefresh,
  locale,
  allServiceBookings = [],
  embedded = true,
}: UnifiedDetailsPanelProps) {
  const tTx = useTranslations("transactions");
  const tOps = useTranslations("operations");
  const [detailTab, setDetailTab] = useState<DetailTab>("overview");
  const [isActing, setIsActing] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionPayload["user"] | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await res.json()) as SessionPayload;
        if (active && data.authenticated && data.user) {
          setSessionUser(data.user);
        }
      } catch {
        if (active) setSessionUser(null);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const actorRole = sessionUser ? mapEnterpriseRoleToTravelActorRole(sessionUser.role as EnterpriseRole) : null;

  if (!item) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-slate-50/50 p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {locale === "ar" ? "اختر معاملة أو طلب سفر لعرض التفاصيل" : "Select a transaction or travel request to view details"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {locale === "ar" ? "أو أنشئ طلب سفر جديد" : "Or create a new travel request"}
        </p>
      </div>
    );
  }

  async function handleTransition(transitionId: SalesTransitionId | TravelTransitionId) {
    if (!item || isActing) return;

    setIsActing(true);
    try {
      if (item.type === "transaction") {
        const result = await transitionSalesOrder({
          orderId: item.id,
          transitionId: transitionId as SalesTransitionId,
        });
        onRefresh(result.transaction);
      } else {
        const result = await transitionTravelRequest({
          requestId: item.id,
          transitionId: transitionId as TravelTransitionId,
        });
        onRefresh(result.request);
      }
    } catch (err) {
      console.error("Transition failed:", err);
    } finally {
      setIsActing(false);
    }
  }

  const title = item.type === "transaction"
    ? tTx("panel.summary")
    : tOps("panel.travelSummary");
  const description = item.type === "transaction"
    ? `${(item.raw as Transaction).pnr} - ${(item.raw as Transaction).ticketNumber}`
    : `${(item.raw as TravelRequest).origin} → ${(item.raw as TravelRequest).destination}`;

  const allTabs: { id: DetailTab; label: string; show?: boolean }[] = [
    { id: "overview", label: tOps("tabs.overview") },
    { id: "workflow", label: tOps("tabs.workflow") },
    { id: "approval", label: tOps("tabs.approval") },
    { id: "accounting", label: tOps("tabs.accounting"), show: item.type === "transaction" },
    { id: "services", label: tOps("tabs.services"), show: item.type === "travel_request" },
    { id: "audit", label: tOps("tabs.audit"), show: item.type === "travel_request" },
  ];
  const tabs = allTabs.filter((t) => t.show !== false);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {embedded && (
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-finance">{title}</h2>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              size="sm"
              variant={detailTab === tab.id ? "primary" : "secondary"}
              onClick={() => setDetailTab(tab.id)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {detailTab === "overview" && (
          <section className="surface-card p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-finance">{title}</h3>
              <OperationsStatusPill item={item} />
            </div>
            <p className="mt-2 font-mono text-sm text-finance">{item.displayId}</p>
            <dl className="mt-4 grid gap-x-3 gap-y-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-medium text-muted-foreground">
                  {item.type === "transaction" ? tTx("table.customer") : tOps("panel.employee")}
                </dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">
                  {item.customerOrEmployee}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-muted-foreground">{tOps("panel.amount")}</dt>
                <dd className="mt-0.5 text-sm font-bold text-finance">
                  {formatCurrency(item.amount, locale, item.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium text-muted-foreground">{tTx("table.createdAt")}</dt>
                <dd className="mt-0.5 text-sm font-medium text-foreground">
                  {formatDate(item.createdAt, locale)}
                </dd>
              </div>
              {item.type === "transaction" && (
                <>
                  <div>
                    <dt className="text-[11px] font-medium text-muted-foreground">{tTx("table.airline")}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">
                      {(item.raw as Transaction).airline}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-muted-foreground">{tTx("panel.agent")}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">
                      {(item.raw as Transaction).agent}
                    </dd>
                  </div>
                </>
              )}
              {item.type === "travel_request" && (
                <>
                  <div>
                    <dt className="text-[11px] font-medium text-muted-foreground">{tOps("panel.purpose")}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">
                      {(item.raw as TravelRequest).purpose}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-muted-foreground">{tOps("panel.department")}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-foreground">
                      {(item.raw as TravelRequest).department}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </section>
        )}

        {detailTab === "workflow" && (
          <UnifiedWorkflowPanel
            item={item}
            onExecuteTransition={handleTransition}
            isExecuting={isActing}
            actorRole={actorRole ?? undefined}
          />
        )}

        {detailTab === "approval" && <UnifiedApprovalTimeline item={item} />}

        {detailTab === "accounting" && item.type === "transaction" && (
          <AccountingImpactPreview transaction={item.raw as Transaction} />
        )}

        {detailTab === "services" && item.type === "travel_request" && (
          <LinkedServicesSection
            request={item.raw as TravelRequest}
            allServiceBookings={allServiceBookings}
            locale={locale}
            t={tOps}
          />
        )}

        {detailTab === "audit" && item.type === "travel_request" && (
          <AuditTrailSection
            request={item.raw as TravelRequest}
            locale={locale}
          />
        )}

        {item.type === "transaction" && (
          <section className="surface-card p-4 text-sm">
            <h3 className="text-sm font-semibold text-finance">{tTx("panel.auditMeta")}</h3>
            <dl className="mt-3 space-y-2 text-muted-foreground">
              <div className="flex items-center justify-between">
                <dt>{tTx("panel.createdBy")}</dt>
                <dd className="font-medium text-foreground">
                  {(item.raw as Transaction).auditMetadata.createdBy}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>{tTx("panel.updatedBy")}</dt>
                <dd className="font-medium text-foreground">
                  {(item.raw as Transaction).auditMetadata.updatedBy}
                </dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
