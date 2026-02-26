"use client";

import type { OperationsListItem } from "../types";
import { SalesWorkflowPanel } from "@/modules/transactions/components/sales-workflow-panel";
import type { SalesTransitionId } from "@/modules/sales/workflow/sales-state-machine";
import { getTravelTransitionOptions } from "@/modules/travel/workflow/travel-approval-engine";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/cn";
import type { TravelRequest, TravelActorRole } from "@/modules/travel/types";
import type { TravelTransitionId } from "@/modules/travel/workflow/travel-approval-engine";
import type { Transaction } from "@/modules/transactions/types";

const TRAVEL_TRANSITION_LABELS: Record<TravelTransitionId, { en: string; ar: string }> = {
  submit_request: { en: "Submit Request", ar: "إرسال الطلب" },
  approve_manager: { en: "Approve (Manager)", ar: "موافقة المدير" },
  reject_manager: { en: "Reject (Manager)", ar: "رفض المدير" },
  start_travel_review: { en: "Start Travel Review", ar: "بدء مراجعة السفر" },
  approve_finance: { en: "Approve (Finance)", ar: "موافقة المالية" },
  reject_finance: { en: "Reject (Finance)", ar: "رفض المالية" },
  confirm_booking: { en: "Confirm Booking", ar: "تأكيد الحجز" },
  close_trip: { en: "Close Trip", ar: "إغلاق الرحلة" },
  cancel_request: { en: "Cancel Request", ar: "إلغاء الطلب" },
};

interface UnifiedWorkflowPanelProps {
  item: OperationsListItem;
  onExecuteTransition?: (transitionId: SalesTransitionId | TravelTransitionId) => void;
  isExecuting?: boolean;
  actorRole?: TravelActorRole | null;
}

export function UnifiedWorkflowPanel({
  item,
  onExecuteTransition,
  isExecuting = false,
  actorRole = null,
}: UnifiedWorkflowPanelProps) {
  if (item.type === "transaction") {
    return (
      <SalesWorkflowPanel
        transaction={item.raw as Transaction}
        onExecuteTransition={onExecuteTransition as (id: SalesTransitionId) => void}
        isExecuting={isExecuting}
      />
    );
  }

  return (
    <TravelWorkflowPanel
      request={item.raw as TravelRequest}
      onExecuteTransition={onExecuteTransition as (id: TravelTransitionId) => void}
      isExecuting={isExecuting}
      actorRole={actorRole}
    />
  );
}

interface TravelWorkflowPanelProps {
  request: TravelRequest;
  onExecuteTransition?: (transitionId: TravelTransitionId) => void;
  isExecuting?: boolean;
  actorRole?: TravelActorRole | null;
}

function TravelWorkflowPanel({
  request,
  onExecuteTransition,
  isExecuting = false,
  actorRole = null,
}: TravelWorkflowPanelProps) {
  const tOps = useTranslations("operations");
  const locale = useLocale();
  const isAr = locale === "ar";

  const options = useMemo(
    () =>
      getTravelTransitionOptions({
        request,
        actorRole: actorRole ?? "employee",
      }),
    [request, actorRole],
  );

  return (
    <section className="surface-card p-4">
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-finance">
          {isAr ? "إجراءات سير العمل" : "Workflow Actions"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {isAr ? "الانتقالات المتاحة حسب الحالة الحالية والصلاحيات." : "Available transitions based on current state and permissions."}
        </p>
      </header>

      <div className="mb-3 rounded-md border border-border bg-white px-3 py-2">
        <p className="text-[11px] text-muted-foreground">{isAr ? "الحالة الحالية" : "Current State"}</p>
        <p className="mt-1 text-sm font-semibold text-finance">
          {tOps(`travelStatus.${request.status}`)}
        </p>
      </div>

      {options.length ? (
        <ul className="space-y-2">
          {options.map((option) => (
            <li key={option.id} className="rounded-md border border-border bg-white px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-finance">
                  {TRAVEL_TRANSITION_LABELS[option.id]?.[isAr ? "ar" : "en"] ?? option.id}
                </p>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-1 text-[11px] font-medium",
                    option.allowed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700",
                  )}
                >
                  {option.allowed ? (isAr ? "مسموح" : "Allowed") : (isAr ? "غير مسموح" : "Blocked")}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {isAr ? "الحالة التالية" : "Next State"}: {tOps(`travelStatus.${option.to}`)}
              </p>
              {option.allowed && onExecuteTransition ? (
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={isExecuting}
                    onClick={() => onExecuteTransition(option.id)}
                  >
                    {isAr ? "تنفيذ" : "Execute"}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-border bg-white px-3 py-6 text-center text-sm text-muted-foreground">
          {isAr ? "لا توجد انتقالات متاحة" : "No transitions available"}
        </p>
      )}
    </section>
  );
}
