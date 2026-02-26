"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/format";
import type {
    TravelRequest,
    TravelRequestStatus,
    ApprovalStepStatus,
    PolicyComplianceLevel,
    PolicyFindingLevel,
    TravelExpenseStatus,
    TravelClosureReadiness,
    TravelExpenseCategory,
    BookingFormState,
    ExpenseFormState,
} from "../types";
import type { AnyServiceBooking } from "@/modules/services/types";
import { SERVICE_CATEGORIES } from "@/modules/services/types";
import type { TravelTransitionId, TravelTransitionBlockReason } from "../workflow/travel-approval-engine";
import type { TravelDictionary } from "../i18n";

interface TravelRequestDetailsProps {
    request: TravelRequest;
    linkedBookings: AnyServiceBooking[];
    locale: string;
    isArabic: boolean;
    t: TravelDictionary;
    layoutText: Record<string, string>;
    travelOpsText: Record<string, string>;
    closureText: Record<string, string>;
    canTransition: boolean;
    canManageBooking: boolean;
    canSubmitExpense: boolean;
    canReviewExpense: boolean;
    canSyncFinance: boolean;
    transitionOptions: {
        id: TravelTransitionId;
        allowed: boolean;
        requiresNote: boolean;
        blockedReason?: string;
    }[];
    isActing: boolean;
    isSavingBooking: boolean;
    isSubmittingExpense: boolean;
    isReviewingExpense: boolean;
    isSyncingFinance: boolean;
    isLoadingClosureReadiness: boolean;
    closureReadiness: TravelClosureReadiness | null;
    actionNote: string;
    setActionNote: (note: string) => void;
    handleTransition: (id: TravelTransitionId) => void;
    bookingForm: BookingFormState;
    updateBookingForm: <K extends keyof BookingFormState>(field: K, val: BookingFormState[K]) => void;
    handleSaveBooking: (e: React.FormEvent<HTMLFormElement>) => void;
    expenseForm: ExpenseFormState;
    updateExpenseForm: <K extends keyof ExpenseFormState>(field: K, val: ExpenseFormState[K]) => void;
    handleSubmitExpense: (e: React.FormEvent<HTMLFormElement>) => void;
    expenseReviewNote: string;
    setExpenseReviewNote: (note: string) => void;
    handleReviewExpense: (id: string, decision: "approve" | "reject") => void;
    handleFinanceSync: () => void;
}

type TravelDetailTab = "overview" | "services" | "operations" | "workflow" | "audit";

const requestStatusStyles: Record<TravelRequestStatus, string> = {
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

const approvalStepStatusStyles: Record<ApprovalStepStatus, string> = {
    waiting: "bg-slate-100 text-slate-700",
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
    skipped: "bg-zinc-100 text-zinc-600",
};

const policyLevelStyles: Record<PolicyComplianceLevel, string> = {
    compliant: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    blocked: "bg-rose-100 text-rose-700",
};

const findingLevelStyles: Record<PolicyFindingLevel, string> = {
    info: "bg-slate-100 text-slate-700",
    warning: "bg-amber-100 text-amber-700",
    blocked: "bg-rose-100 text-rose-700",
};

const expenseStatusStyles: Record<TravelExpenseStatus, string> = {
    submitted: "bg-amber-100 text-amber-700",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
};

const financeSyncStatusStyles: Record<TravelRequest["financeSync"]["status"], string> = {
    not_synced: "bg-slate-100 text-slate-700",
    pending: "bg-blue-100 text-blue-700",
    succeeded: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
};

function expenseCategoryLabel(category: TravelExpenseCategory, locale: string): string {
    const dictionary: Record<TravelExpenseCategory, { en: string; ar: string }> = {
        flight: { en: "Flight", ar: "رحلة طيران" },
        hotel: { en: "Hotel", ar: "فندق" },
        ground_transport: { en: "Ground Transport", ar: "نقل بري" },
        meals: { en: "Meals", ar: "وجبات" },
        visa: { en: "Visa", ar: "تأشيرة" },
        other: { en: "Other", ar: "أخرى" },
    };
    const entry = dictionary[category];
    return locale === "ar" ? entry.ar : entry.en;
}

function expenseStatusLabel(status: TravelExpenseStatus, locale: string): string {
    const dictionary: Record<TravelExpenseStatus, { en: string; ar: string }> = {
        submitted: { en: "Submitted", ar: "مُرسل" },
        approved: { en: "Approved", ar: "مقبول" },
        rejected: { en: "Rejected", ar: "مرفوض" },
    };
    const entry = dictionary[status];
    return locale === "ar" ? entry.ar : entry.en;
}

function financeSyncStatusLabel(
    status: TravelRequest["financeSync"]["status"],
    locale: string
): string {
    const dictionary: Record<TravelRequest["financeSync"]["status"], { en: string; ar: string }> = {
        not_synced: { en: "Not Synced", ar: "غير مُزامن" },
        pending: { en: "Pending", ar: "قيد المزامنة" },
        succeeded: { en: "Succeeded", ar: "ناجح" },
        failed: { en: "Failed", ar: "فشل" },
    };
    const entry = dictionary[status];
    return locale === "ar" ? entry.ar : entry.en;
}

function isTerminalStatus(status: TravelRequestStatus): boolean {
    return status === "closed" || status === "rejected" || status === "cancelled";
}

function closureCheckLabel(
    code: TravelClosureReadiness["checks"][number]["code"],
    locale: string
): string {
    const dictionary: Record<
        TravelClosureReadiness["checks"][number]["code"],
        { en: string; ar: string }
    > = {
        trip_completed: {
            en: "Trip is completed (return date reached).",
            ar: "اكتملت الرحلة (تم الوصول إلى تاريخ العودة).",
        },
        booking_recorded: {
            en: "Booking details are recorded.",
            ar: "تم تسجيل بيانات الحجز.",
        },
        expenses_reviewed: {
            en: "All expense claims are reviewed.",
            ar: "تمت مراجعة جميع مطالبات المصروفات.",
        },
        approved_expenses_synced: {
            en: "Approved expenses are synchronized to ERP.",
            ar: "تمت مزامنة المصروفات المعتمدة مع نظام ERP.",
        },
        finance_sync_not_failed: {
            en: "Finance sync status is stable.",
            ar: "حالة مزامنة المالية مستقرة.",
        },
    };
    const entry = dictionary[code];
    return locale === "ar" ? entry.ar : entry.en;
}

const fieldLabelClass = "text-xs font-medium text-muted-foreground";
const fieldControlClass =
    "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/70";
const fieldTextareaClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/70";
const fieldControlUpperClass = `${fieldControlClass} uppercase tracking-wide`;
const formBlockClass = "rounded-lg border border-border bg-slate-50/70 p-3";

export function TravelRequestDetails({
    request,
    linkedBookings,
    locale,
    t,
    layoutText,
    travelOpsText,
    closureText,
    canTransition,
    canManageBooking,
    canSubmitExpense,
    canReviewExpense,
    canSyncFinance,
    transitionOptions,
    isActing,
    isSavingBooking,
    isSubmittingExpense,
    isReviewingExpense,
    isSyncingFinance,
    isLoadingClosureReadiness,
    closureReadiness,
    actionNote,
    setActionNote,
    handleTransition,
    bookingForm,
    updateBookingForm,
    handleSaveBooking,
    expenseForm,
    updateExpenseForm,
    handleSubmitExpense,
    expenseReviewNote,
    setExpenseReviewNote,
    handleReviewExpense,
    handleFinanceSync,
}: TravelRequestDetailsProps) {
    const [detailTab, setDetailTab] = useState<TravelDetailTab>("overview");

    const selectedExpenses = request?.expenses ?? [];
    const pendingExpenses = selectedExpenses.filter((expense) => expense.status === "submitted");
    const approvedUnsyncedExpenses = selectedExpenses.filter(
        (expense) => expense.status === "approved" && !expense.syncedAt
    );
    const closureChecks = closureReadiness?.checks ?? [];

    return (
        <div className="space-y-4">
            <section className="surface-card no-print p-3">
                <p className="text-xs font-semibold text-finance">{layoutText.detailTabsTitle}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                    {(
                        [
                            { id: "overview", label: layoutText.detailOverview },
                            { id: "services", label: locale === "ar" ? "الخدمات المرتبطة" : "Linked Services" },
                            { id: "operations", label: layoutText.detailOperations },
                            { id: "workflow", label: layoutText.detailWorkflow },
                            { id: "audit", label: layoutText.detailAudit },
                        ] as Array<{ id: TravelDetailTab; label: string }>
                    ).map((tab) => (
                        <Button
                            key={tab.id}
                            size="sm"
                            variant={detailTab === tab.id ? "primary" : "secondary"}
                            onClick={() => setDetailTab(tab.id)}
                        >
                            {tab.label}
                        </Button>
                    ))}
                </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
                {detailTab === "overview" && (
                    <>
                        <section className="surface-card p-4">
                            <h3 className="text-sm font-semibold text-finance">{t.labels.requestDetails}</h3>
                            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                                <dt className="text-muted-foreground">{t.form.employeeName}</dt>
                                <dd className="font-medium text-finance">{request.employeeName}</dd>
                                <dt className="text-muted-foreground">{t.form.employeeEmail}</dt>
                                <dd className="font-medium text-finance">{request.employeeEmail}</dd>
                                <dt className="text-muted-foreground">{t.form.employeeGrade}</dt>
                                <dd className="font-medium text-finance">{t.grade[request.employeeGrade]}</dd>
                                <dt className="text-muted-foreground">{t.form.tripType}</dt>
                                <dd className="font-medium text-finance">{t.tripType[request.tripType]}</dd>
                                <dt className="text-muted-foreground">{t.form.travelClass}</dt>
                                <dd className="font-medium text-finance">{t.travelClass[request.travelClass]}</dd>
                                <dt className="text-muted-foreground">{t.form.purpose}</dt>
                                <dd className="font-medium text-finance">{request.purpose}</dd>
                                <dt className="text-muted-foreground">{t.form.costCenter}</dt>
                                <dd className="font-medium text-finance">{request.costCenter}</dd>
                                <dt className="text-muted-foreground">{t.labels.status}</dt>
                                <dd className="font-medium text-finance">
                                    <span
                                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${requestStatusStyles[request.status]
                                            }`}
                                    >
                                        {t.status[request.status]}
                                    </span>
                                </dd>
                            </dl>
                        </section>

                        <section className="surface-card p-4">
                            <h3 className="text-sm font-semibold text-finance">{t.labels.policyEvaluation}</h3>
                            <div className="mt-3 flex items-center justify-between">
                                <span
                                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${policyLevelStyles[request.policyEvaluation.level]
                                        }`}
                                >
                                    {t.policyLevel[request.policyEvaluation.level]}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                    {request.policyEvaluation.policyVersion}
                                </span>
                            </div>
                            <div className="mt-3 space-y-2">
                                {request.policyEvaluation.findings.map((finding) => (
                                    <div
                                        key={`${request.id}-${finding.code}`}
                                        className="rounded-md border border-border px-3 py-2 text-xs"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-finance">{finding.message}</span>
                                            <span
                                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${findingLevelStyles[finding.level]
                                                    }`}
                                            >
                                                {t.findingLevel[finding.level]}
                                            </span>
                                        </div>
                                        {finding.context ? (
                                            <p className="mt-1 text-[11px] text-muted-foreground">{finding.context}</p>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="surface-card p-4 xl:col-span-2">
                            <h3 className="text-sm font-semibold text-finance">{t.labels.availableActions}</h3>
                            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
                                <label className={fieldLabelClass}>
                                    {t.labels.actionNote}
                                    <input
                                        value={actionNote}
                                        onChange={(event) => setActionNote(event.target.value)}
                                        placeholder={t.labels.actionNotePlaceholder}
                                        className={fieldControlClass}
                                    />
                                </label>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    {transitionOptions.map((option) => {
                                        const noteMissing = option.requiresNote && !actionNote.trim();
                                        const disabled = !option.allowed || isActing || noteMissing;
                                        const disabledReason = option.blockedReason
                                            ? t.transitionReason[option.blockedReason as TravelTransitionBlockReason]
                                            : noteMissing
                                                ? t.labels.actionNotePlaceholder
                                                : "";

                                        return (
                                            <Button
                                                key={option.id}
                                                variant={
                                                    option.id.includes("reject") || option.id.includes("cancel")
                                                        ? "danger"
                                                        : "secondary"
                                                }
                                                onClick={() => void handleTransition(option.id)}
                                                disabled={
                                                    disabled || !canTransition || isTerminalStatus(request.status)
                                                }
                                                title={disabledReason}
                                                loading={isActing}
                                            >
                                                {t.transition[option.id]}
                                            </Button>
                                        );
                                    })}
                                    {!transitionOptions.length ? (
                                        <p className="text-xs text-muted-foreground">{t.labels.noActions}</p>
                                    ) : null}
                                </div>
                            </div>
                        </section>
                    </>
                )}

                {detailTab === "services" && (
                    <section className="surface-card p-4 xl:col-span-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-finance">
                                {locale === "ar" ? "الخدمات المرتبطة بالرحلة" : "Services Linked to Trip"}
                            </h3>
                            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                                {linkedBookings.length} {locale === "ar" ? "خدمة" : "service(s)"}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {locale === "ar"
                                ? "حجوزات الفنادق والتأشيرات والتأمين والنقل المرتبطة بطلب السفر هذا."
                                : "Hotel, visa, insurance, and transfer bookings linked to this travel request."}
                        </p>

                        {linkedBookings.length > 0 ? (
                            <div className="mt-4 space-y-3">
                                {linkedBookings.map((booking) => {
                                    const catInfo = SERVICE_CATEGORIES.find((c) => c.id === booking.category);
                                    return (
                                        <article
                                            key={booking.id}
                                            className="rounded-lg border border-border bg-white p-3 text-xs transition hover:shadow-sm"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${catInfo?.bgColor ?? "bg-slate-50"}`}>
                                                        <span className="text-xs font-bold">{booking.id.split("-")[0]}</span>
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-finance">{booking.id}</p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {locale === "ar" ? catInfo?.labelAr : catInfo?.labelEn}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                    booking.status === "confirmed" ? "bg-emerald-100 text-emerald-700" :
                                                    booking.status === "pending" ? "bg-amber-100 text-amber-700" :
                                                    booking.status === "completed" ? "bg-slate-100 text-slate-600" :
                                                    "bg-blue-100 text-blue-700"
                                                }`}>
                                                    {booking.status}
                                                </span>
                                            </div>
                                            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">{locale === "ar" ? "العميل" : "Customer"}</span>
                                                    <span className="font-medium text-finance">{booking.customerName}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">{locale === "ar" ? "المبلغ" : "Amount"}</span>
                                                    <span className="font-medium text-finance">{formatCurrency(booking.totalAmount, locale, booking.currency)}</span>
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="mt-6 flex flex-col items-center justify-center py-8 text-center">
                                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                                    <span className="text-lg text-slate-400">🔗</span>
                                </div>
                                <p className="text-sm font-medium text-finance">
                                    {locale === "ar" ? "لا توجد خدمات مرتبطة" : "No Linked Services"}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {locale === "ar"
                                        ? "يمكن ربط حجوزات الخدمات بطلب السفر هذا لتتبع شامل."
                                        : "Service bookings can be linked to this travel request for comprehensive tracking."}
                                </p>
                            </div>
                        )}
                    </section>
                )}

                {detailTab === "operations" && (
                    <>
                        <section className="surface-card p-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-finance">{travelOpsText.bookingTitle}</h3>
                                <span
                                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${requestStatusStyles[request.status]
                                        }`}
                                >
                                    {t.status[request.status]}
                                </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{travelOpsText.bookingSubtitle}</p>

                            {request.booking ? (
                                <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                                    <dt className="text-muted-foreground">{travelOpsText.bookingVendor}</dt>
                                    <dd className="font-medium text-finance">{request.booking.vendor}</dd>
                                    <dt className="text-muted-foreground">{travelOpsText.bookingReference}</dt>
                                    <dd className="font-medium text-finance">
                                        {request.booking.bookingReference}
                                    </dd>
                                    <dt className="text-muted-foreground">{travelOpsText.bookingTicketNumber}</dt>
                                    <dd className="font-medium text-finance">
                                        {request.booking.ticketNumber || "-"}
                                    </dd>
                                    <dt className="text-muted-foreground">{travelOpsText.bookingBookedAt}</dt>
                                    <dd className="font-medium text-finance">
                                        {formatDate(request.booking.bookedAt, locale)}
                                    </dd>
                                </dl>
                            ) : (
                                <p className="mt-3 text-xs text-muted-foreground">{travelOpsText.notAvailable}</p>
                            )}

                            <form className="mt-3 space-y-3" onSubmit={handleSaveBooking}>
                                <div className={formBlockClass}>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <label className={fieldLabelClass}>
                                            {travelOpsText.bookingVendor}
                                            <input
                                                value={bookingForm.vendor}
                                                onChange={(event) => updateBookingForm("vendor", event.target.value)}
                                                className={fieldControlClass}
                                                required
                                            />
                                        </label>
                                        <label className={fieldLabelClass}>
                                            {travelOpsText.bookingReference}
                                            <input
                                                value={bookingForm.bookingReference}
                                                onChange={(event) => updateBookingForm("bookingReference", event.target.value)}
                                                className={fieldControlClass}
                                                required
                                            />
                                        </label>
                                        <label className={fieldLabelClass}>
                                            {travelOpsText.bookingTicketNumber}
                                            <input
                                                value={bookingForm.ticketNumber}
                                                onChange={(event) => updateBookingForm("ticketNumber", event.target.value)}
                                                className={fieldControlClass}
                                            />
                                        </label>
                                        <label className={fieldLabelClass}>
                                            {travelOpsText.bookingBookedAt}
                                            <input
                                                type="datetime-local"
                                                value={bookingForm.bookedAt}
                                                onChange={(event) => updateBookingForm("bookedAt", event.target.value)}
                                                className={fieldControlClass}
                                            />
                                        </label>
                                        <label className={fieldLabelClass}>
                                            {travelOpsText.bookingAmount}
                                            <input
                                                type="number"
                                                min="1"
                                                step="0.01"
                                                inputMode="decimal"
                                                value={bookingForm.totalBookedCost}
                                                onChange={(event) => updateBookingForm("totalBookedCost", event.target.value)}
                                                className={fieldControlClass}
                                                required
                                            />
                                        </label>
                                        <label className={fieldLabelClass}>
                                            {t.form.currency}
                                            <input
                                                value={bookingForm.currency}
                                                onChange={(event) =>
                                                    updateBookingForm("currency", event.target.value.toUpperCase())
                                                }
                                                className={fieldControlUpperClass}
                                                maxLength={3}
                                                required
                                            />
                                        </label>
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full"
                                    loading={isSavingBooking}
                                    disabled={
                                        isSavingBooking || !canManageBooking || request.status !== "booked"
                                    }
                                >
                                    {travelOpsText.bookingSave}
                                </Button>
                            </form>
                        </section>

                        <section className="surface-card p-4 xl:col-span-2">
                            <h3 className="text-sm font-semibold text-finance">{travelOpsText.expensesTitle}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">{travelOpsText.expensesSubtitle}</p>

                            <div className="mt-3 grid gap-4 xl:grid-cols-2">
                                <form className="space-y-3" onSubmit={handleSubmitExpense}>
                                    <div className={formBlockClass}>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <label className={fieldLabelClass}>
                                                {travelOpsText.expenseCategory}
                                                <select
                                                    value={expenseForm.category}
                                                    onChange={(event) =>
                                                        updateExpenseForm("category", event.target.value as TravelExpenseCategory)
                                                    }
                                                    className={fieldControlClass}
                                                >
                                                    {(
                                                        [
                                                            "flight",
                                                            "hotel",
                                                            "ground_transport",
                                                            "meals",
                                                            "visa",
                                                            "other",
                                                        ] as TravelExpenseCategory[]
                                                    ).map((category) => (
                                                        <option key={category} value={category}>
                                                            {expenseCategoryLabel(category, locale)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </label>
                                            <label className={fieldLabelClass}>
                                                {travelOpsText.expenseAmount}
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="0.01"
                                                    inputMode="decimal"
                                                    value={expenseForm.amount}
                                                    onChange={(event) => updateExpenseForm("amount", event.target.value)}
                                                    className={fieldControlClass}
                                                    required
                                                />
                                            </label>
                                            <label className={fieldLabelClass}>
                                                {travelOpsText.expenseDate}
                                                <input
                                                    type="date"
                                                    value={expenseForm.expenseDate}
                                                    onChange={(event) => updateExpenseForm("expenseDate", event.target.value)}
                                                    className={fieldControlClass}
                                                    required
                                                />
                                            </label>
                                            <label className={fieldLabelClass}>
                                                {t.form.currency}
                                                <input
                                                    value={expenseForm.currency}
                                                    onChange={(event) =>
                                                        updateExpenseForm("currency", event.target.value.toUpperCase())
                                                    }
                                                    className={fieldControlUpperClass}
                                                    maxLength={3}
                                                    required
                                                />
                                            </label>
                                            <label className={fieldLabelClass}>
                                                {travelOpsText.expenseMerchant}
                                                <input
                                                    value={expenseForm.merchant}
                                                    onChange={(event) => updateExpenseForm("merchant", event.target.value)}
                                                    className={fieldControlClass}
                                                    required
                                                />
                                            </label>
                                            <label className={fieldLabelClass}>
                                                {travelOpsText.expenseDescription}
                                                <textarea
                                                    value={expenseForm.description}
                                                    onChange={(event) => updateExpenseForm("description", event.target.value)}
                                                    className={fieldTextareaClass}
                                                    rows={2}
                                                    required
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <div className={formBlockClass}>
                                        <p className="text-xs font-semibold text-finance">
                                            {locale === "ar" ? "بيانات المرفقات" : "Attachment Metadata"}
                                        </p>
                                        <div className="mt-2 grid gap-3 sm:grid-cols-3">
                                            <label className={fieldLabelClass}>
                                                {travelOpsText.expenseReceiptName}
                                                <input
                                                    value={expenseForm.receiptFileName}
                                                    onChange={(event) =>
                                                        updateExpenseForm("receiptFileName", event.target.value)
                                                    }
                                                    className={fieldControlClass}
                                                    required
                                                />
                                            </label>
                                            <label className={fieldLabelClass}>
                                                {travelOpsText.expenseReceiptType}
                                                <input
                                                    value={expenseForm.receiptMimeType}
                                                    onChange={(event) =>
                                                        updateExpenseForm("receiptMimeType", event.target.value)
                                                    }
                                                    className={fieldControlClass}
                                                    required
                                                />
                                            </label>
                                            <label className={fieldLabelClass}>
                                                {travelOpsText.expenseReceiptSize}
                                                <input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    inputMode="numeric"
                                                    value={expenseForm.receiptSizeInBytes}
                                                    onChange={(event) =>
                                                        updateExpenseForm("receiptSizeInBytes", event.target.value)
                                                    }
                                                    className={fieldControlClass}
                                                    required
                                                />
                                            </label>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        loading={isSubmittingExpense}
                                        disabled={
                                            isSubmittingExpense || !canSubmitExpense || request.status !== "booked"
                                        }
                                    >
                                        {travelOpsText.expenseSubmit}
                                    </Button>
                                </form>

                                <div className="space-y-2">
                                    {canReviewExpense ? (
                                        <label className={fieldLabelClass}>
                                            {travelOpsText.expenseReviewNote}
                                            <input
                                                value={expenseReviewNote}
                                                onChange={(event) => setExpenseReviewNote(event.target.value)}
                                                className={fieldControlClass}
                                                placeholder={t.labels.actionNotePlaceholder}
                                            />
                                        </label>
                                    ) : null}

                                    <div className="rounded-md border border-border bg-slate-50 px-3 py-2 text-[11px] text-muted-foreground">
                                        {selectedExpenses.length} {locale === "ar" ? "مطالبة" : "claim(s)"} |{" "}
                                        {pendingExpenses.length} {locale === "ar" ? "قيد المراجعة" : "pending"} |{" "}
                                        {approvedUnsyncedExpenses.length}{" "}
                                        {locale === "ar" ? "جاهزة للمزامنة" : "ready to sync"}
                                    </div>

                                    <div className="max-h-[300px] space-y-2 overflow-auto pe-1">
                                        {selectedExpenses.map((expense) => (
                                            <article
                                                key={expense.id}
                                                className="rounded-md border border-border bg-white px-3 py-2 text-xs"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="font-medium text-finance">
                                                        {expenseCategoryLabel(expense.category, locale)}
                                                    </p>
                                                    <span
                                                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${expenseStatusStyles[expense.status]
                                                            }`}
                                                    >
                                                        {expenseStatusLabel(expense.status, locale)}
                                                    </span>
                                                </div>
                                                <p className="mt-1 text-[11px] text-muted-foreground">
                                                    {formatCurrency(expense.amount, locale, expense.currency)} |{" "}
                                                    {expense.merchant}
                                                </p>
                                                <p className="text-[11px] text-muted-foreground">{expense.description}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {expense.receipt.fileName} ({expense.receipt.mimeType})
                                                </p>
                                                {expense.syncedAt ? (
                                                    <p className="text-[11px] text-emerald-700">
                                                        {expense.syncedBatchId || "-"} | {formatDate(expense.syncedAt, locale)}
                                                    </p>
                                                ) : null}
                                                {canReviewExpense && expense.status === "submitted" ? (
                                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            onClick={() => handleReviewExpense(expense.id, "approve")}
                                                            disabled={isReviewingExpense}
                                                        >
                                                            {locale === "ar" ? "اعتماد" : "Approve"}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="danger"
                                                            onClick={() => handleReviewExpense(expense.id, "reject")}
                                                            disabled={isReviewingExpense}
                                                        >
                                                            {locale === "ar" ? "رفض" : "Reject"}
                                                        </Button>
                                                    </div>
                                                ) : null}
                                            </article>
                                        ))}
                                        {!selectedExpenses.length ? (
                                            <p className="text-xs text-muted-foreground">
                                                {travelOpsText.notAvailable}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="surface-card p-4">
                            <h3 className="text-sm font-semibold text-finance">{travelOpsText.financeTitle}</h3>
                            <p className="mt-1 text-xs text-muted-foreground">{travelOpsText.financeSubtitle}</p>
                            <div className="mt-3 flex items-center justify-between gap-2">
                                <span
                                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${financeSyncStatusStyles[request.financeSync.status]
                                        }`}
                                >
                                    {financeSyncStatusLabel(request.financeSync.status, locale)}
                                </span>
                                <Button
                                    size="sm"
                                    onClick={handleFinanceSync}
                                    loading={isSyncingFinance}
                                    disabled={isSyncingFinance || !canSyncFinance || !approvedUnsyncedExpenses.length}
                                >
                                    {travelOpsText.financeSync}
                                </Button>
                            </div>
                            <dl className="mt-3 space-y-1 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                    <dt className="text-muted-foreground">{travelOpsText.financeAttempts}</dt>
                                    <dd className="font-medium text-finance">{request.financeSync.attemptCount}</dd>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <dt className="text-muted-foreground">{travelOpsText.financeLastBatch}</dt>
                                    <dd className="font-medium text-finance">
                                        {request.financeSync.lastBatchId || "-"}
                                    </dd>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                    <dt className="text-muted-foreground">{travelOpsText.financeLines}</dt>
                                    <dd className="font-medium text-finance">
                                        {request.financeSync.ledgerLines.length}
                                    </dd>
                                </div>
                            </dl>
                            {request.financeSync.lastError ? (
                                <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                    {travelOpsText.financeLastError}: {request.financeSync.lastError}
                                </p>
                            ) : null}

                            <div className="mt-4 rounded-md border border-border bg-slate-50 p-3">
                                <div className="flex items-center justify-between gap-2">
                                    <h4 className="text-xs font-semibold text-finance">{closureText.title}</h4>
                                    <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${closureReadiness?.ready
                                            ? "bg-emerald-100 text-emerald-700"
                                            : "bg-amber-100 text-amber-700"
                                            }`}
                                    >
                                        {closureReadiness?.ready ? closureText.ready : closureText.notReady}
                                    </span>
                                </div>
                                <p className="mt-1 text-[11px] text-muted-foreground">{closureText.subtitle}</p>

                                {isLoadingClosureReadiness ? (
                                    <p className="mt-2 text-[11px] text-muted-foreground">{closureText.loading}</p>
                                ) : null}

                                {!isLoadingClosureReadiness && closureReadiness ? (
                                    <>
                                        <div className="mt-3 rounded-md border border-border bg-white p-2">
                                            <p className="text-[11px] font-medium text-finance">{closureText.checks}</p>
                                            <div className="mt-2 space-y-1">
                                                {closureChecks.map((check) => (
                                                    <div key={check.code} className="flex items-center justify-between gap-2">
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {closureCheckLabel(check.code, locale)}
                                                        </p>
                                                        <span
                                                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${check.passed
                                                                ? "bg-emerald-100 text-emerald-700"
                                                                : "bg-rose-100 text-rose-700"
                                                                }`}
                                                        >
                                                            {check.passed
                                                                ? locale === "ar"
                                                                    ? "مكتمل"
                                                                    : "Passed"
                                                                : locale === "ar"
                                                                    ? "غير مكتمل"
                                                                    : "Failed"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <dl className="mt-3 space-y-1 text-[11px]">
                                            <div className="flex items-center justify-between gap-2">
                                                <dt className="text-muted-foreground">{closureText.totalExpenses}</dt>
                                                <dd className="font-medium text-finance">
                                                    {closureReadiness.totalExpenses}
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <dt className="text-muted-foreground">{closureText.approvedAmount}</dt>
                                                <dd className="font-medium text-finance">
                                                    {formatCurrency(
                                                        closureReadiness.totalApprovedAmount,
                                                        locale,
                                                        request.currency
                                                    )}
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <dt className="text-muted-foreground">{closureText.settledAmount}</dt>
                                                <dd className="font-medium text-finance">
                                                    {formatCurrency(
                                                        closureReadiness.totalApprovedSyncedAmount,
                                                        locale,
                                                        request.currency
                                                    )}
                                                </dd>
                                            </div>
                                        </dl>
                                    </>
                                ) : null}

                                {request.closure ? (
                                    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2">
                                        <dl className="space-y-1 text-[11px]">
                                            <div className="flex items-center justify-between gap-2">
                                                <dt className="text-muted-foreground">{closureText.closedAt}</dt>
                                                <dd className="font-medium text-finance">
                                                    {formatDate(request.closure.closedAt, locale)}
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <dt className="text-muted-foreground">{closureText.closedBy}</dt>
                                                <dd className="font-medium text-finance">{request.closure.closedBy}</dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <dt className="text-muted-foreground">{closureText.totalExpenses}</dt>
                                                <dd className="font-medium text-finance">
                                                    {request.closure.totalExpenses}
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <dt className="text-muted-foreground">{closureText.approvedAmount}</dt>
                                                <dd className="font-medium text-finance">
                                                    {formatCurrency(
                                                        request.closure.totalApprovedAmount,
                                                        locale,
                                                        request.currency
                                                    )}
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <dt className="text-muted-foreground">{closureText.settledAmount}</dt>
                                                <dd className="font-medium text-finance">
                                                    {formatCurrency(
                                                        request.closure.totalSettledAmount,
                                                        locale,
                                                        request.currency
                                                    )}
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <dt className="text-muted-foreground">{closureText.varianceBooked}</dt>
                                                <dd className="font-medium text-finance">
                                                    {formatCurrency(
                                                        request.closure.varianceFromBookedCost,
                                                        locale,
                                                        request.currency
                                                    )}
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <dt className="text-muted-foreground">{closureText.varianceEstimated}</dt>
                                                <dd className="font-medium text-finance">
                                                    {formatCurrency(
                                                        request.closure.varianceFromEstimatedCost,
                                                        locale,
                                                        request.currency
                                                    )}
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <dt className="text-muted-foreground">{closureText.financeBatch}</dt>
                                                <dd className="font-medium text-finance">
                                                    {request.closure.financeBatchId || "-"}
                                                </dd>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                                <dt className="text-muted-foreground">{closureText.financeAttempts}</dt>
                                                <dd className="font-medium text-finance">
                                                    {request.closure.financeAttemptCount}
                                                </dd>
                                            </div>
                                            {request.closure.closureNote ? (
                                                <div className="flex items-start justify-between gap-2">
                                                    <dt className="text-muted-foreground">{closureText.note}</dt>
                                                    <dd className="max-w-[60%] text-end font-medium text-finance">
                                                        {request.closure.closureNote}
                                                    </dd>
                                                </div>
                                            ) : null}
                                        </dl>
                                    </div>
                                ) : null}
                            </div>
                        </section>
                    </>
                )}

                {detailTab === "workflow" && (
                    <section className="surface-card p-4 xl:col-span-2">
                        <h3 className="text-sm font-semibold text-finance">{t.labels.approvalRoute}</h3>
                        <div className="mt-3 space-y-2">
                            {request.approvalRoute.map((step) => (
                                <div key={step.id} className="rounded-md border border-border px-3 py-2 text-xs">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-finance">{t.roles[step.role]}</span>
                                        <span
                                            className={`inline-flex rounded-full px-2 py-0.5 font-medium ${approvalStepStatusStyles[step.status]
                                                }`}
                                        >
                                            {t.approvalStatus[step.status]}
                                        </span>
                                    </div>
                                    <div className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                                        <p>
                                            {t.route.actor}: {step.actorName || "-"}
                                        </p>
                                        <p>
                                            {t.route.at}: {step.actedAt ? formatDate(step.actedAt, locale) : "-"}
                                        </p>
                                        {step.note ? <p>{step.note}</p> : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {detailTab === "audit" && (
                    <section className="surface-card p-4 xl:col-span-2">
                        <h3 className="text-sm font-semibold text-finance">{t.labels.auditTrail}</h3>
                        <div className="mt-3 max-h-[360px] space-y-2 overflow-auto pe-1">
                            {request.auditTrail
                                .slice()
                                .reverse()
                                .map((event) => (
                                    <div key={event.id} className="rounded-md border border-border px-3 py-2 text-xs">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-medium text-finance">
                                                {t.transition[event.action as TravelTransitionId] ?? event.action}
                                            </span>
                                            <span className="text-[11px] text-muted-foreground">
                                                {formatDate(event.at, locale)}
                                            </span>
                                        </div>
                                        <div className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                                            <p>
                                                {t.audit.actor}: {event.actorName} ({t.roles[event.actorRole]})
                                            </p>
                                            <p>
                                                {t.audit.fromTo}: {event.fromStatus ? t.status[event.fromStatus] : "-"}
                                                {" -> "}
                                                {t.status[event.toStatus]}
                                            </p>
                                            {event.note ? (
                                                <p>
                                                    {t.audit.note}: {event.note}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
