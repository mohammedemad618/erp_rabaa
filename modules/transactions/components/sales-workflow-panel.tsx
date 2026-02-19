"use client";

import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  evaluateSalesSla,
  getSalesTransitionOptions,
  type SalesTransitionId,
} from "@/modules/sales/workflow/sales-state-machine";
import { cn } from "@/utils/cn";
import type { Transaction } from "../types";

interface SalesWorkflowPanelProps {
  transaction: Transaction;
  onExecuteTransition?: (transitionId: SalesTransitionId) => void;
  isExecuting?: boolean;
}

export function SalesWorkflowPanel({
  transaction,
  onExecuteTransition,
  isExecuting = false,
}: SalesWorkflowPanelProps) {
  const tSales = useTranslations("salesFlow");
  const tTx = useTranslations("transactions");

  const sla = useMemo(
    () => evaluateSalesSla(transaction.status, transaction.createdAt),
    [transaction.createdAt, transaction.status],
  );

  const options = useMemo(
    () =>
      getSalesTransitionOptions({
        state: transaction.status,
        approvalState: transaction.approvalState,
      }),
    [transaction.approvalState, transaction.status],
  );

  const slaTone =
    sla.level === "ok"
      ? "bg-emerald-100 text-emerald-700"
      : sla.level === "warning"
        ? "bg-amber-100 text-amber-700"
        : "bg-rose-100 text-rose-700";

  return (
    <section className="surface-card p-4">
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-finance">{tSales("title")}</h3>
        <p className="text-xs text-muted-foreground">{tSales("subtitle")}</p>
      </header>

      <div className="mb-3 grid gap-2 md:grid-cols-2">
        <article className="rounded-md border border-border bg-white px-3 py-2">
          <p className="text-[11px] text-muted-foreground">{tSales("currentState")}</p>
          <p className="mt-1 text-sm font-semibold text-finance">
            {tTx(`statusValues.${transaction.status}`)}
          </p>
        </article>

        <article className="rounded-md border border-border bg-white px-3 py-2">
          <p className="text-[11px] text-muted-foreground">{tSales("sla")}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span
              className={cn("inline-flex rounded-full px-2 py-1 text-[11px] font-semibold", slaTone)}
            >
              {tSales(`level.${sla.level}`)}
            </span>
            <span className="text-xs text-muted-foreground">
              {tSales("slaElapsed", { hours: sla.elapsedHours.toString() })} /{" "}
              {tSales("slaTarget", { hours: sla.targetHours.toString() })}
            </span>
          </div>
        </article>
      </div>

      {options.length ? (
        <ul className="space-y-2">
          {options.map((option) => (
            <li key={option.id} className="rounded-md border border-border bg-white px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-finance">
                  {tSales(`actions.${option.id}`)}
                </p>
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-1 text-[11px] font-medium",
                    option.allowed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700",
                  )}
                >
                  {option.allowed ? tSales("allowed") : tSales("blocked")}
                </span>
              </div>

              <p className="mt-1 text-[11px] text-muted-foreground">
                {tSales("nextState")}: {tTx(`statusValues.${option.to}`)}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5">
                  <Clock3 className="h-3 w-3" />
                  {tSales(`risk.${option.risk}`)}
                </span>

                {option.requiresPin ? (
                  <span className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-amber-700">
                    <ShieldAlert className="h-3 w-3" />
                    {tSales("pinRequired")}
                  </span>
                ) : null}

                {option.allowed ? (
                  <span className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    {tSales("ready")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-rose-700">
                    <AlertTriangle className="h-3 w-3" />
                    {option.blockedReason
                      ? tSales(`reasons.${option.blockedReason}`)
                      : tSales("notReady")}
                  </span>
                )}
              </div>

              {option.allowed && onExecuteTransition ? (
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant={option.risk === "high" ? "danger" : "secondary"}
                    disabled={isExecuting}
                    onClick={() => onExecuteTransition(option.id)}
                  >
                    {option.requiresPin ? tSales("executeWithPin") : tSales("execute")}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-border bg-white px-3 py-6 text-center text-sm text-muted-foreground">
          {tSales("terminal")}
        </p>
      )}
    </section>
  );
}
