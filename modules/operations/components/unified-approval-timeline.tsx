"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDate } from "@/utils/format";
import type { Transaction } from "@/modules/transactions/types";
import type { TravelRequest, TravelApprovalStep } from "@/modules/travel/types";
import type { OperationsListItem } from "../types";

const txStatusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const travelStatusColor: Record<string, string> = {
  waiting: "bg-slate-100 text-slate-700",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  skipped: "bg-zinc-100 text-zinc-600",
};

const ROLE_LABELS: Record<string, { en: string; ar: string }> = {
  manager: { en: "Manager", ar: "المدير" },
  travel_desk: { en: "Travel Desk", ar: "مكتب السفر" },
  finance: { en: "Finance", ar: "المالية" },
  employee: { en: "Employee", ar: "الموظف" },
  admin: { en: "Admin", ar: "المسؤول" },
};

const APPROVAL_STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  waiting: { en: "Waiting", ar: "في الانتظار" },
  pending: { en: "Pending", ar: "قيد المراجعة" },
  approved: { en: "Approved", ar: "مقبول" },
  rejected: { en: "Rejected", ar: "مرفوض" },
  skipped: { en: "Skipped", ar: "تم تخطيه" },
};

interface UnifiedApprovalTimelineProps {
  item: OperationsListItem;
}

function TransactionTimeline({ transaction }: { transaction: Transaction }) {
  const locale = useLocale();

  return (
    <ol className="mt-3 space-y-3">
      {transaction.approvalTimeline.map((step) => (
        <li key={step.id} className="flex items-start gap-3">
          <span
            className={`mt-1 inline-flex min-w-[74px] justify-center rounded-full px-2 py-1 text-xs font-medium ${txStatusColor[step.status] ?? "bg-slate-100 text-slate-700"}`}
          >
            {step.status}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{step.actor}</p>
            {step.at ? (
              <p className="text-xs text-muted-foreground">{formatDate(step.at, locale)}</p>
            ) : null}
            {step.note ? <p className="text-xs text-muted-foreground">{step.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function TravelTimeline({ request }: { request: TravelRequest }) {
  const locale = useLocale();
  const isAr = locale === "ar";

  return (
    <ol className="mt-3 space-y-3">
      {request.approvalRoute.map((step: TravelApprovalStep) => (
        <li key={step.id} className="flex items-start gap-3">
          <span
            className={`mt-1 inline-flex min-w-[74px] justify-center rounded-full px-2 py-1 text-xs font-medium ${travelStatusColor[step.status] ?? "bg-slate-100 text-slate-700"}`}
          >
            {APPROVAL_STATUS_LABELS[step.status]?.[isAr ? "ar" : "en"] ?? step.status}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {ROLE_LABELS[step.role]?.[isAr ? "ar" : "en"] ?? step.role}
            </p>
            {step.actedAt ? (
              <p className="text-xs text-muted-foreground">{formatDate(step.actedAt, locale)}</p>
            ) : null}
            {step.actorName ? (
              <p className="text-xs text-muted-foreground">{step.actorName}</p>
            ) : null}
            {step.note ? <p className="text-xs text-muted-foreground">{step.note}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function UnifiedApprovalTimeline({ item }: UnifiedApprovalTimelineProps) {
  const tTx = useTranslations("transactions");

  return (
    <section className="surface-card p-4">
      <h3 className="text-sm font-semibold text-finance">{tTx("panel.approvalTimeline")}</h3>
      {item.type === "transaction" ? (
        <TransactionTimeline transaction={item.raw as Transaction} />
      ) : (
        <TravelTimeline request={item.raw as TravelRequest} />
      )}
    </section>
  );
}
