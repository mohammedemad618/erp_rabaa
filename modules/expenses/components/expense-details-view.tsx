"use client";

import { ErpSection } from "@/components/layout/erp-page-layout";
import { Button } from "@/components/ui/button";
import type { ExpenseRecord, ExpenseStatus } from "../types";

function statusClass(status: ExpenseStatus): string {
    if (status === "approved") {
        return "bg-emerald-100 text-emerald-700";
    }
    if (status === "rejected") {
        return "bg-rose-100 text-rose-700";
    }
    if (status === "pending_manager" || status === "pending_finance") {
        return "bg-amber-100 text-amber-700";
    }
    return "bg-slate-100 text-slate-700";
}

interface ExpenseDetailsViewProps {
    selectedExpense: ExpenseRecord | null;
    approveSelected: () => void;
    rejectSelected: () => void;
    t: (key: string) => string;
}

export function ExpenseDetailsView({
    selectedExpense,
    approveSelected,
    rejectSelected,
    t,
}: ExpenseDetailsViewProps) {
    return (
        <div className="space-y-4">
            <ErpSection title={t("routing.title")}>
                {!selectedExpense ? (
                    <p className="mt-3 text-sm text-muted-foreground">{t("empty.selection")}</p>
                ) : (
                    <>
                        <div className="mt-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-finance">{selectedExpense.id}</p>
                            <span
                                className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass(
                                    selectedExpense.status,
                                )}`}
                            >
                                {t(`status.${selectedExpense.status}`)}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {selectedExpense.costCenterName} - {selectedExpense.employee}
                        </p>

                        <ol className="mt-3 space-y-2">
                            {selectedExpense.approvalRoute.map((step) => (
                                <li key={step.id} className="rounded-md border border-border p-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-medium text-finance">{step.role}</span>
                                        <span className="text-muted-foreground">{t(`routeStatus.${step.status}`)}</span>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">{step.actor}</p>
                                    {step.note ? (
                                        <p className="mt-1 text-[11px] text-muted-foreground">{step.note}</p>
                                    ) : null}
                                </li>
                            ))}
                        </ol>

                        <div className="mt-3 flex gap-2">
                            <Button
                                size="sm"
                                variant="secondary"
                                onClick={approveSelected}
                                disabled={
                                    selectedExpense.status === "approved" || selectedExpense.status === "rejected"
                                }
                            >
                                {t("routing.approveStep")}
                            </Button>
                            <Button
                                size="sm"
                                variant="danger"
                                onClick={rejectSelected}
                                disabled={
                                    selectedExpense.status === "approved" || selectedExpense.status === "rejected"
                                }
                            >
                                {t("routing.reject")}
                            </Button>
                        </div>
                    </>
                )}
            </ErpSection>
        </div>
    );
}
