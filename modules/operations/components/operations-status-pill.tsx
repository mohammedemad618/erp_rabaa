"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/utils/cn";
import type { OperationsListItem } from "../types";

const transactionStatusStyle: Record<string, string> = {
  draft: "bg-slate-50 text-slate-600 border border-slate-200",
  ocr_reviewed: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  pending_approval: "bg-amber-50 text-amber-700 border border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  pending_payment: "bg-orange-50 text-orange-700 border border-orange-200",
  paid: "bg-green-50 text-green-700 border border-green-200",
  receipt_issued: "bg-blue-50 text-blue-700 border border-blue-200",
  refunded: "bg-purple-50 text-purple-700 border border-purple-200",
  voided: "bg-rose-50 text-rose-700 border border-rose-200",
};

const travelStatusStyle: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-blue-100 text-blue-700",
  manager_approved: "bg-cyan-100 text-cyan-700",
  travel_review: "bg-violet-100 text-violet-700",
  finance_approved: "bg-indigo-100 text-indigo-700",
  booked: "bg-emerald-100 text-emerald-700",
  closed: "bg-teal-100 text-teal-700",
  rejected: "bg-rose-100 text-rose-700",
  cancelled: "bg-zinc-100 text-zinc-700",
};

interface OperationsStatusPillProps {
  item: OperationsListItem;
}

export function OperationsStatusPill({ item }: OperationsStatusPillProps) {
  const tTx = useTranslations("transactions");
  const tOps = useTranslations("operations");

  const style =
    item.type === "transaction"
      ? transactionStatusStyle[item.status] ?? "bg-slate-100 text-slate-700"
      : travelStatusStyle[item.status] ?? "bg-slate-100 text-slate-700";

  const label =
    item.type === "transaction"
      ? tTx(`statusValues.${item.status}`)
      : tOps(`travelStatus.${item.status}`);

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-medium",
        style,
      )}
    >
      {label}
    </span>
  );
}
