"use client";

import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PermissionButton } from "@/components/ui/permission-button";
import { StatusPill } from "@/components/ui/status-pill";
import { SlideOver } from "@/components/ui/slide-over";
import { formatCurrency, formatDate } from "@/utils/format";
import { AccountingImpactPreview } from "./accounting-impact-preview";
import { ApprovalTimeline } from "./approval-timeline";
import { SalesWorkflowPanel } from "./sales-workflow-panel";
import type { Transaction } from "../types";
import type { SalesTransitionId } from "@/modules/sales/workflow/sales-state-machine";
import { useState } from "react";

interface TransactionDetailsSlideOverProps {
    transaction: Transaction | null;
    isOpen: boolean;
    onClose: () => void;
    isApplyingTransition: boolean;
    onRequestTransition: (transitionId: SalesTransitionId) => void;
    pendingTransitionId: SalesTransitionId | null;
    onCancelPinFlow: () => void;
    onConfirmPinFlow: (pin: string) => void;
    pinError: string;
}

export function TransactionDetailsSlideOver({
    transaction,
    isOpen,
    onClose,
    isApplyingTransition,
    onRequestTransition,
    pendingTransitionId,
    onCancelPinFlow,
    onConfirmPinFlow,
    pinError,
}: TransactionDetailsSlideOverProps) {
    const tTx = useTranslations("transactions");
    const tSales = useTranslations("salesFlow");
    const locale = useLocale();

    const [pinValue, setPinValue] = useState("");

    if (!transaction) return null;

    return (
        <>
            <SlideOver
                isOpen={isOpen}
                onClose={onClose}
                title={tTx("panel.summary")}
                description={`${transaction.pnr} - ${transaction.ticketNumber}`}
                size="md"
            >
                <div className="space-y-4">
                    <section className="surface-card p-4">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-semibold text-finance">{tTx("panel.summary")}</h3>
                            <StatusPill status={transaction.status} />
                        </div>

                        <p className="mt-2 text-sm font-semibold text-finance">
                            <bdi className="font-mono">{transaction.id}</bdi>
                        </p>

                        <dl className="mt-4 grid gap-x-3 gap-y-3 text-xs text-muted-foreground sm:grid-cols-2">
                            <div>
                                <dt className="text-[11px] font-medium">{tTx("table.customer")}</dt>
                                <dd className="mt-0.5 text-sm font-medium text-foreground">
                                    <bdi>{transaction.customerName}</bdi>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-medium">{tTx("panel.customerPhone")}</dt>
                                <dd className="mt-0.5 text-sm font-medium text-foreground">
                                    <bdi>{transaction.customerPhone}</bdi>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-medium">{tTx("table.airline")}</dt>
                                <dd className="mt-0.5 text-sm font-medium text-foreground">
                                    <bdi>{transaction.airline}</bdi>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-medium">{tTx("panel.branch")}</dt>
                                <dd className="mt-0.5 text-sm font-medium text-foreground">
                                    <bdi>{transaction.branch}</bdi>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-medium">{tTx("panel.agent")}</dt>
                                <dd className="mt-0.5 text-sm font-medium text-foreground">
                                    <bdi>{transaction.agent}</bdi>
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-medium">{tTx("panel.paymentMethod")}</dt>
                                <dd className="mt-0.5 text-sm font-medium text-foreground">
                                    {tTx(`paymentMethods.${transaction.paymentMethod}`)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-medium">{tTx("table.total")}</dt>
                                <dd className="mt-0.5 text-sm font-bold text-finance">
                                    {formatCurrency(transaction.totalAmount, locale, transaction.currency)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-medium">{tTx("table.createdAt")}</dt>
                                <dd className="mt-0.5 text-sm font-medium text-foreground">
                                    {formatDate(transaction.createdAt, locale)}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-[11px] font-medium">{tTx("panel.issuedAt")}</dt>
                                <dd className="mt-0.5 text-sm font-medium text-foreground">
                                    {formatDate(transaction.issuedAt, locale)}
                                </dd>
                            </div>
                        </dl>
                    </section>

                    <section className="surface-card p-4">
                        <h3 className="text-sm font-semibold text-finance">{tTx("panel.quickActions")}</h3>
                        <div className="no-print mt-3 flex flex-wrap gap-2">
                            <PermissionButton
                                action="refund"
                                transaction={transaction}
                                label={tTx("actions.refund")}
                                requiresPinLabel={tTx("actions.requiresPin")}
                                disabled={isApplyingTransition}
                                onClick={() => onRequestTransition("refund_sale")}
                            />
                            <PermissionButton
                                action="void"
                                transaction={transaction}
                                label={tTx("actions.void")}
                                requiresPinLabel={tTx("actions.requiresPin")}
                                disabled={isApplyingTransition}
                                onClick={() => onRequestTransition("void_sale")}
                            />
                        </div>
                    </section>

                    <AccountingImpactPreview transaction={transaction} />

                    <SalesWorkflowPanel
                        transaction={transaction}
                        onExecuteTransition={onRequestTransition}
                        isExecuting={isApplyingTransition}
                    />

                    <ApprovalTimeline transaction={transaction} />

                    <section className="surface-card p-4 text-sm">
                        <h3 className="text-sm font-semibold text-finance">{tTx("panel.auditMeta")}</h3>
                        <dl className="mt-3 space-y-2 text-muted-foreground">
                            <div className="flex items-center justify-between">
                                <dt>{tTx("panel.createdBy")}</dt>
                                <dd className="font-medium text-foreground">{transaction.auditMetadata.createdBy}</dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt>{tTx("panel.updatedBy")}</dt>
                                <dd className="font-medium text-foreground">{transaction.auditMetadata.updatedBy}</dd>
                            </div>
                            <div className="flex items-center justify-between">
                                <dt>{tTx("panel.version")}</dt>
                                <dd className="font-medium text-foreground">{transaction.auditMetadata.version}</dd>
                            </div>
                        </dl>
                    </section>
                </div>
            </SlideOver>

            {/* PIN Confirmation Modal layer on top if activated */}
            {pendingTransitionId ? (
                <div className="no-print fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
                    <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-5 shadow-2xl">
                        <h3 className="text-base font-semibold text-finance">{tSales("pinTitle")}</h3>
                        <p className="mt-1.5 text-sm text-muted-foreground">{tSales("pinSubtitle")}</p>

                        <label className="mt-4 block text-xs font-medium text-slate-700">
                            {tSales("pinLabel")}
                            <input
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                value={pinValue}
                                onChange={(event) => setPinValue(event.target.value)}
                                className="mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                                autoFocus
                            />
                        </label>

                        {pinError ? (
                            <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 border border-rose-100">
                                {pinError}
                            </p>
                        ) : null}

                        <div className="mt-6 flex items-center justify-end gap-3">
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={isApplyingTransition}
                                onClick={() => {
                                    setPinValue("");
                                    onCancelPinFlow();
                                }}
                            >
                                {tSales("cancel")}
                            </Button>
                            <Button
                                size="sm"
                                variant="primary"
                                disabled={isApplyingTransition || pinValue.length < 4}
                                onClick={() => {
                                    onConfirmPinFlow(pinValue);
                                    setPinValue("");
                                }}
                            >
                                {tSales("confirm")}
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
