"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Transaction } from "../types";
import { formatDate } from "@/utils/format";

interface ApprovalTimelineProps {
  transaction: Transaction;
}

const statusColor = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

export function ApprovalTimeline({ transaction }: ApprovalTimelineProps) {
  const tTx = useTranslations("transactions");
  const locale = useLocale();

  return (
    <section className="surface-card p-4">
      <h3 className="text-sm font-semibold text-finance">{tTx("panel.approvalTimeline")}</h3>
      <ol className="mt-3 space-y-3">
        {transaction.approvalTimeline.map((step) => (
          <li key={step.id} className="flex items-start gap-3">
            <span
              className={`mt-1 inline-flex min-w-[74px] justify-center rounded-full px-2 py-1 text-xs font-medium ${statusColor[step.status]}`}
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
    </section>
  );
}
