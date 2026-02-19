"use client";

import { useLocale, useTranslations } from "next-intl";
import type { Transaction } from "../types";
import { formatCurrency } from "@/utils/format";

interface AccountingImpactPreviewProps {
  transaction: Transaction;
}

export function AccountingImpactPreview({
  transaction,
}: AccountingImpactPreviewProps) {
  const locale = useLocale();
  const tTx = useTranslations("transactions");
  const totalDebit = transaction.accountingPreview
    .filter((line) => line.side === "debit")
    .reduce((sum, line) => sum + line.amount, 0);
  const totalCredit = transaction.accountingPreview
    .filter((line) => line.side === "credit")
    .reduce((sum, line) => sum + line.amount, 0);

  return (
    <section className="surface-card p-4">
      <h3 className="text-sm font-semibold text-finance">{tTx("panel.accountingImpact")}</h3>
      <div className="mt-3 space-y-2">
        {transaction.accountingPreview.map((line) => (
          <div
            key={line.id}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
          >
            <div>
              <p className="font-medium text-foreground">{line.account}</p>
              <p className="text-xs text-muted-foreground uppercase">{line.side}</p>
            </div>
            <p className={line.side === "debit" ? "text-primary" : "text-finance"}>
              {formatCurrency(line.amount, locale, line.currency)}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <p className="rounded-md bg-slate-50 p-2">
          Debit: {formatCurrency(totalDebit, locale, transaction.currency)}
        </p>
        <p className="rounded-md bg-slate-50 p-2">
          Credit: {formatCurrency(totalCredit, locale, transaction.currency)}
        </p>
      </div>
    </section>
  );
}
