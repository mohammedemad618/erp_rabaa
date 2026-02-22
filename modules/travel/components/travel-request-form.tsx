"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AdvisorPanel } from "./advisor-panel";
import type { EmployeeGrade, TravelClass, TripType } from "../types";
import type { TravelDictionary } from "../i18n";

export interface FormState {
    employeeName: string;
    employeeEmail: string;
    employeeGrade: EmployeeGrade;
    department: string;
    costCenter: string;
    tripType: TripType;
    origin: string;
    destination: string;
    departureDate: string;
    returnDate: string;
    purpose: string;
    travelClass: TravelClass;
    estimatedCost: string;
    currency: string;
}

interface TravelRequestFormProps {
    form: FormState;
    updateForm: <K extends keyof FormState>(field: K, value: FormState[K]) => void;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    isCreating: boolean;
    canCreate: boolean;
    sessionAvailable: boolean;
    layoutText: Record<string, string>;
    requestFormText: Record<string, string>;
    t: TravelDictionary;
}

type RequestFormStep = 1 | 2 | 3;

const fieldLabelClass = "text-xs font-medium text-muted-foreground";
const fieldControlClass =
    "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/70";
const fieldTextareaClass =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/70";
const fieldControlUpperClass = `${fieldControlClass} uppercase tracking-wide`;
const formBlockClass = "rounded-lg border border-border bg-slate-50/70 p-3";

export function TravelRequestForm({
    form,
    updateForm,
    onSubmit,
    isCreating,
    canCreate,
    sessionAvailable,
    layoutText,
    requestFormText,
    t,
}: TravelRequestFormProps) {
    const [requestFormStep, setRequestFormStep] = useState<RequestFormStep>(1);

    const canProceedToTripStep = Boolean(
        form.employeeName.trim() &&
        form.employeeEmail.trim() &&
        form.department.trim() &&
        form.costCenter.trim()
    );
    const canProceedToScheduleStep = Boolean(
        form.origin.trim() && form.destination.trim() && form.purpose.trim()
    );

    return (
        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
            <div>
                <p className="text-xs font-semibold text-finance">{layoutText.formFlowTitle}</p>
                <p className="text-[11px] text-muted-foreground">{layoutText.formFlowSubtitle}</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
                {[
                    { step: 1 as RequestFormStep, label: layoutText.stepEmployee },
                    { step: 2 as RequestFormStep, label: layoutText.stepTrip },
                    { step: 3 as RequestFormStep, label: layoutText.stepSchedule },
                ].map((item) => (
                    <button
                        key={item.step}
                        type="button"
                        onClick={() => setRequestFormStep(item.step)}
                        className={`rounded-md border px-3 py-2 text-start text-xs transition ${requestFormStep === item.step
                            ? "border-primary bg-blue-50 text-finance shadow-sm"
                            : "border-border bg-white text-muted-foreground hover:bg-slate-50"
                            }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {requestFormStep === 1 ? (
                <div className={formBlockClass}>
                    <div className="mb-3">
                        <p className="text-xs font-semibold text-finance">{requestFormText.employeeSection}</p>
                        <p className="text-[11px] text-muted-foreground">{requestFormText.employeeHint}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className={fieldLabelClass}>
                            {t.form.employeeName}
                            <input
                                value={form.employeeName}
                                onChange={(event) => updateForm("employeeName", event.target.value)}
                                className={fieldControlClass}
                                autoComplete="name"
                                required
                            />
                        </label>
                        <label className={fieldLabelClass}>
                            {t.form.employeeEmail}
                            <input
                                type="email"
                                value={form.employeeEmail}
                                onChange={(event) => updateForm("employeeEmail", event.target.value)}
                                className={fieldControlClass}
                                autoComplete="email"
                                required
                            />
                        </label>
                        <label className={fieldLabelClass}>
                            {t.form.employeeGrade}
                            <select
                                value={form.employeeGrade}
                                onChange={(event) =>
                                    updateForm("employeeGrade", event.target.value as EmployeeGrade)
                                }
                                className={fieldControlClass}
                            >
                                {(["staff", "manager", "director", "executive"] as EmployeeGrade[]).map((grade) => (
                                    <option key={grade} value={grade}>
                                        {t.grade[grade]}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className={fieldLabelClass}>
                            {t.form.department}
                            <input
                                value={form.department}
                                onChange={(event) => updateForm("department", event.target.value)}
                                className={fieldControlClass}
                                required
                            />
                        </label>
                        <label className={fieldLabelClass}>
                            {t.form.costCenter}
                            <input
                                value={form.costCenter}
                                onChange={(event) => updateForm("costCenter", event.target.value)}
                                className={fieldControlClass}
                                required
                            />
                        </label>
                    </div>
                </div>
            ) : null}

            {requestFormStep === 2 ? (
                <div className={formBlockClass}>
                    <div className="mb-3">
                        <p className="text-xs font-semibold text-finance">{requestFormText.tripSection}</p>
                        <p className="text-[11px] text-muted-foreground">{requestFormText.tripHint}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className={fieldLabelClass}>
                            {t.form.tripType}
                            <select
                                value={form.tripType}
                                onChange={(event) => updateForm("tripType", event.target.value as TripType)}
                                className={fieldControlClass}
                            >
                                {(["domestic", "international"] as TripType[]).map((tripType) => (
                                    <option key={tripType} value={tripType}>
                                        {t.tripType[tripType]}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className={fieldLabelClass}>
                            {t.form.travelClass}
                            <select
                                value={form.travelClass}
                                onChange={(event) => updateForm("travelClass", event.target.value as TravelClass)}
                                className={fieldControlClass}
                            >
                                {(["economy", "premium_economy", "business", "first"] as TravelClass[]).map(
                                    (travelClass) => (
                                        <option key={travelClass} value={travelClass}>
                                            {t.travelClass[travelClass]}
                                        </option>
                                    )
                                )}
                            </select>
                        </label>
                        <label className={fieldLabelClass}>
                            {t.form.origin}
                            <input
                                value={form.origin}
                                onChange={(event) => updateForm("origin", event.target.value)}
                                className={fieldControlClass}
                                required
                            />
                        </label>
                        <label className={fieldLabelClass}>
                            {t.form.destination}
                            <input
                                value={form.destination}
                                onChange={(event) => updateForm("destination", event.target.value)}
                                className={fieldControlClass}
                                required
                            />
                        </label>
                    </div>
                    <label className={`${fieldLabelClass} mt-3 block`}>
                        {t.form.purpose}
                        <textarea
                            value={form.purpose}
                            onChange={(event) => updateForm("purpose", event.target.value)}
                            className={fieldTextareaClass}
                            rows={2}
                            required
                        />
                    </label>
                </div>
            ) : null}

            {requestFormStep === 3 ? (
                <>
                    <div className={formBlockClass}>
                        <div className="mb-3">
                            <p className="text-xs font-semibold text-finance">{requestFormText.scheduleSection}</p>
                            <p className="text-[11px] text-muted-foreground">{requestFormText.scheduleHint}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <label className={fieldLabelClass}>
                                {t.form.departureDate}
                                <input
                                    type="date"
                                    value={form.departureDate}
                                    onChange={(event) => updateForm("departureDate", event.target.value)}
                                    className={fieldControlClass}
                                    required
                                />
                            </label>
                            <label className={fieldLabelClass}>
                                {t.form.returnDate}
                                <input
                                    type="date"
                                    value={form.returnDate}
                                    onChange={(event) => updateForm("returnDate", event.target.value)}
                                    className={fieldControlClass}
                                    required
                                />
                            </label>
                            <label className={fieldLabelClass}>
                                {t.form.estimatedCost}
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    inputMode="decimal"
                                    value={form.estimatedCost}
                                    onChange={(event) => updateForm("estimatedCost", event.target.value)}
                                    className={fieldControlClass}
                                    required
                                />
                            </label>
                            <label className={fieldLabelClass}>
                                {t.form.currency}
                                <input
                                    value={form.currency}
                                    onChange={(event) => updateForm("currency", event.target.value.toUpperCase())}
                                    className={fieldControlUpperClass}
                                    maxLength={3}
                                    required
                                />
                            </label>
                        </div>
                    </div>

                    <div className="rounded-lg border border-dashed border-border px-3 py-2 text-[11px] text-muted-foreground">
                        {requestFormText.requiredHint}
                    </div>
                    <AdvisorPanel
                        input={{
                            employeeGrade: form.employeeGrade,
                            tripType: form.tripType,
                            departureDate: form.departureDate,
                            estimatedCost: Number(form.estimatedCost) || undefined,
                        }}
                    />
                </>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setRequestFormStep((previous) => (previous === 3 ? 2 : 1))}
                    disabled={requestFormStep === 1}
                >
                    {layoutText.previous}
                </Button>

                {requestFormStep < 3 ? (
                    <Button
                        type="button"
                        onClick={() => {
                            if (requestFormStep === 1 && !canProceedToTripStep) {
                                // Not ideal, we're mimicking the previous logic, in production we might leverage react-hook-form
                                alert(t.notices.validationFailed);
                                return;
                            }
                            if (requestFormStep === 2 && !canProceedToScheduleStep) {
                                alert(t.notices.validationFailed);
                                return;
                            }
                            setRequestFormStep((previous) => (previous === 1 ? 2 : 3));
                        }}
                    >
                        {layoutText.next}
                    </Button>
                ) : (
                    <Button
                        type="submit"
                        loading={isCreating}
                        className="w-full"
                        disabled={isCreating || !canCreate || !sessionAvailable}
                    >
                        {t.labels.submitDraft}
                    </Button>
                )}
            </div>
        </form>
    );
}
