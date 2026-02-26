"use client";

import { useLocale } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TravelRequestForm } from "./travel-request-form";
import type { CreateRequestPricingContext } from "./travel-request-form";
import { createTravelRequestApi } from "@/services/travel-workflow-api";
import { getTravelDictionary } from "../i18n";
import type { AnyServiceBooking } from "@/modules/services/types";
import type { Customer } from "@/modules/customers/types";
import type { TravelRequest } from "../types";
import type { FormState } from "./travel-request-form";

interface TravelCreateFormProps {
  customers: Customer[];
  allServiceBookings: AnyServiceBooking[];
  onSuccess: (request: TravelRequest) => void;
  onCancel: () => void;
}

const TRAVEL_CREATE_DRAFT_KEY = "travel_create_form_draft_v1";
const AUTO_SAVE_DELAY_MS = 900;
const NOTICE_DURATION_MS = 3000;
const REDIRECT_AFTER_SUCCESS_MS = 900;

const EMPLOYEE_GRADES = ["staff", "manager", "director", "executive"] as const;
const TRIP_TYPES = ["domestic", "international"] as const;
const TRAVEL_CLASSES = ["economy", "premium_economy", "business", "first"] as const;

function isOneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function toDateInputValue(now: Date, offsetDays: number): string {
  const copy = new Date(now);
  copy.setDate(copy.getDate() + offsetDays);
  return copy.toISOString().slice(0, 10);
}

function buildInitialFormState(): FormState {
  return {
    customerId: "",
    linkedServiceBookingIds: [],
    employeeName: "",
    employeeEmail: "",
    employeeGrade: "staff",
    department: "",
    costCenter: "",
    tripType: "domestic",
    origin: "",
    destination: "",
    departureDate: "",
    returnDate: "",
    purpose: "",
    travelClass: "economy",
    estimatedCost: "",
    currency: "SAR",
  };
}

function withDefaultDates(state: FormState): FormState {
  if (state.departureDate && state.returnDate) {
    return state;
  }
  const now = new Date();
  return {
    ...state,
    departureDate: state.departureDate || toDateInputValue(now, 5),
    returnDate: state.returnDate || toDateInputValue(now, 7),
  };
}

function sanitizeString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function parseDraft(rawDraft: string): FormState | null {
  try {
    const parsed = JSON.parse(rawDraft) as Partial<FormState> | null;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      customerId: sanitizeString(parsed.customerId),
      linkedServiceBookingIds: Array.isArray(parsed.linkedServiceBookingIds)
        ? parsed.linkedServiceBookingIds.filter((id): id is string => typeof id === "string")
        : [],
      employeeName: sanitizeString(parsed.employeeName),
      employeeEmail: sanitizeString(parsed.employeeEmail),
      employeeGrade: isOneOf(parsed.employeeGrade, EMPLOYEE_GRADES)
        ? parsed.employeeGrade
        : "staff",
      department: sanitizeString(parsed.department),
      costCenter: sanitizeString(parsed.costCenter),
      tripType: isOneOf(parsed.tripType, TRIP_TYPES) ? parsed.tripType : "domestic",
      origin: sanitizeString(parsed.origin),
      destination: sanitizeString(parsed.destination),
      departureDate: sanitizeString(parsed.departureDate),
      returnDate: sanitizeString(parsed.returnDate),
      purpose: sanitizeString(parsed.purpose),
      travelClass: isOneOf(parsed.travelClass, TRAVEL_CLASSES)
        ? parsed.travelClass
        : "economy",
      estimatedCost: sanitizeString(parsed.estimatedCost),
      currency: sanitizeString(parsed.currency, "SAR") || "SAR",
    };
  } catch {
    return null;
  }
}

export function TravelCreateForm({
  customers,
  allServiceBookings,
  onSuccess,
  onCancel,
}: TravelCreateFormProps) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const t = useMemo(() => getTravelDictionary(locale), [locale]);

  const [form, setForm] = useState<FormState>(buildInitialFormState);
  const [isCreating, setIsCreating] = useState(false);
  const [sessionUser, setSessionUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [sessionPermissions, setSessionPermissions] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  const noticeTimerRef = useRef<number | null>(null);
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await res.json();
        if (active && data.authenticated && data.user) {
          setSessionUser(data.user);
          setSessionPermissions(Array.isArray(data.permissions) ? data.permissions : []);
        }
      } catch {
        if (active) {
          setSessionUser(null);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // 1. Restore draft
    try {
      const rawDraft = window.localStorage.getItem(TRAVEL_CREATE_DRAFT_KEY);
      const parsedDraft = rawDraft ? parseDraft(rawDraft) : null;
      if (parsedDraft) {
        setForm(withDefaultDates(parsedDraft));
        setDraftRestored(true);
      } else {
        setForm((prev) => withDefaultDates(prev));
      }
    } catch {
      setForm((prev) => withDefaultDates(prev));
    } finally {
      setDraftReady(true);
    }
  }, []);

  // Optimization: Debounce the auto-save effect
  useEffect(() => {
    if (!draftReady || isCreating) {
      return;
    }

    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(TRAVEL_CREATE_DRAFT_KEY, JSON.stringify(form));
        setDraftSaved(true);
      } catch {
        // Ignore storage write failures.
      }
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [draftReady, form, isCreating]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const canCreate = sessionPermissions.includes("travel.create");

  const layoutText = useMemo(
    () =>
      isArabic
        ? {
            previous: "السابق",
            next: "التالي",
            detailTabsTitle: "",
            detailOverview: "",
            detailOperations: "",
            detailWorkflow: "",
            detailAudit: "",
            quickAll: "",
            previousPage: "",
            nextPage: "",
            rowsInPage: "",
            matchedRecords: "",
            formFlowTitle: "",
            formFlowSubtitle: "",
            stepEmployee: "",
            stepTrip: "",
            stepSchedule: "",
          }
        : {
            previous: "Previous",
            next: "Next",
            detailTabsTitle: "",
            detailOverview: "",
            detailOperations: "",
            detailWorkflow: "",
            detailAudit: "",
            quickAll: "",
            previousPage: "",
            nextPage: "",
            rowsInPage: "",
            matchedRecords: "",
            formFlowTitle: "",
            formFlowSubtitle: "",
            stepEmployee: "",
            stepTrip: "",
            stepSchedule: "",
          },
    [isArabic],
  );

  const requestFormText = useMemo(
    () =>
      isArabic
        ? {
            subtitle: "أنشئ طلب سفر متكامل عبر أربع خطوات.",
            employeeSection: "",
            employeeHint: "",
            tripSection: "تفاصيل الرحلة",
            tripHint: "حدد المسار والغرض من السفر.",
            scheduleSection: "الجدول الزمني والميزانية",
            scheduleHint: "أدخل تواريخ السفر والتكلفة التقديرية.",
            requiredHint: "",
          }
        : {
            subtitle: "Create a comprehensive travel request in four steps.",
            employeeSection: "",
            employeeHint: "",
            tripSection: "Trip Details",
            tripHint: "Define route and business purpose.",
            scheduleSection: "Schedule & Budget",
            scheduleHint: "Enter travel dates and estimated cost.",
            requiredHint: "",
          },
    [isArabic],
  );

  function updateForm<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function notify(message: string, tone: "success" | "error" = "success") {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }

    setNotice({ message, tone });
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
    }, NOTICE_DURATION_MS);
  }

  async function handleCreateRequest(
    event: React.FormEvent<HTMLFormElement>,
    pricing?: CreateRequestPricingContext,
  ) {
    event.preventDefault();

    if (!canCreate || !sessionUser?.name?.trim()) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    const baseEstimatedCost = pricing?.baseTripEstimatedCost ?? Number(form.estimatedCost);
    if (!Number.isFinite(baseEstimatedCost) || baseEstimatedCost <= 0) {
      notify(t.notices.validationFailed, "error");
      return;
    }
    const additionalServicesCost = pricing?.additionalServicesEstimatedCost ?? 0;
    const estimatedCost = pricing?.totalEstimatedCost ?? baseEstimatedCost + additionalServicesCost;

    try {
      setIsCreating(true);
      const request = await createTravelRequestApi({
        customerId: form.customerId || undefined,
        employeeName: sessionUser.name,
        employeeEmail: sessionUser.email ?? "",
        employeeGrade: form.employeeGrade,
        department: form.department,
        costCenter: form.costCenter,
        tripType: form.tripType,
        origin: form.origin,
        destination: form.destination,
        departureDate: form.departureDate,
        returnDate: form.returnDate,
        purpose: form.purpose,
        travelClass: form.travelClass,
        baseEstimatedCost,
        additionalServicesCost,
        estimatedCost,
        currency: form.currency,
        linkedServiceBookingIds: form.linkedServiceBookingIds,
        serviceCostOverrides: pricing?.serviceCostOverrides,
      });

      try {
        window.localStorage.removeItem(TRAVEL_CREATE_DRAFT_KEY);
      } catch {
        // Ignore storage remove failures.
      }

      setDraftRestored(false);
      setDraftSaved(false);

      notify(
        isArabic
          ? `تم إنشاء طلب السفر بنجاح. الرقم المرجعي: ${request.id}`
          : `Travel request created successfully. Reference: ${request.id}`,
        "success",
      );

      redirectTimerRef.current = window.setTimeout(() => {
        onSuccess(request);
      }, REDIRECT_AFTER_SUCCESS_MS);
    } catch (err) {
      notify(err instanceof Error ? err.message : t.notices.validationFailed, "error");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-finance">{t.labels.createRequest}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{requestFormText.subtitle}</p>
          {draftRestored ? (
            <p className="mt-1 text-xs text-primary">
              {isArabic ? "تمت استعادة المسودة المحفوظة تلقائياً." : "Auto-saved draft restored."}
            </p>
          ) : null}
          {!draftRestored && draftSaved ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {isArabic ? "الحفظ التلقائي للمسودة مفعل." : "Draft auto-save is active."}
            </p>
          ) : null}
        </div>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {isArabic ? "إلغاء" : "Cancel"}
        </Button>
      </div>

      {notice ? (
        <div
          aria-live="polite"
          className={`pointer-events-none fixed top-4 z-50 max-w-md rounded-lg px-4 py-2 text-sm shadow-lg ${
            isArabic ? "left-4" : "right-4"
          } ${
            notice.tone === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
          role="status"
        >
          {notice.message}
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-4">
        {draftReady ? (
          <TravelRequestForm
            form={form}
            updateForm={updateForm}
            onSubmit={handleCreateRequest}
            isCreating={isCreating}
            canCreate={canCreate}
            sessionUser={sessionUser}
            customers={customers}
            serviceBookings={allServiceBookings}
            locale={locale}
            layoutText={layoutText}
            requestFormText={requestFormText}
            t={t}
          />
        ) : (
          <div className="rounded-lg border border-border bg-white p-6 text-sm text-muted-foreground">
            {isArabic ? "جاري تحميل المسودة..." : "Loading saved draft..."}
          </div>
        )}
      </div>
    </div>
  );
}
