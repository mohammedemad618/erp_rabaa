"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/utils/cn";
import type { TransactionStatus } from "@/modules/transactions/types";

const statusStyle: Record<TransactionStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  ocr_reviewed: "bg-cyan-100 text-cyan-700",
  pending_approval: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  pending_payment: "bg-orange-100 text-orange-700",
  paid: "bg-green-100 text-green-700",
  receipt_issued: "bg-blue-100 text-blue-700",
  refunded: "bg-rose-100 text-rose-700",
  voided: "bg-red-100 text-red-700",
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
