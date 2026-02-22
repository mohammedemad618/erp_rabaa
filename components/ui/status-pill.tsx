"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/utils/cn";
import type { TransactionStatus } from "@/modules/transactions/types";

const statusStyle: Record<TransactionStatus, string> = {
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

interface StatusPillProps {
  status: TransactionStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  const tTx = useTranslations("transactions");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        statusStyle[status],
      )}
    >
      {tTx(`statusValues.${status}`)}
    </span>
  );
}
