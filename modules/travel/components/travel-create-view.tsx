"use client";

import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useEffect, useMemo, useState } from "react";
import { ErpPageHeader, ErpPageLayout } from "@/components/layout/erp-page-layout";
import { Button } from "@/components/ui/button";
import { TravelRequestForm } from "./travel-request-form";
import type { CreateRequestPricingContext } from "./travel-request-form";
import { createTravelRequestApi } from "@/services/travel-workflow-api";
import { getTravelDictionary } from "../i18n";
import type { AnyServiceBooking } from "@/modules/services/types";
import type { Customer } from "@/modules/customers/types";
import type { TravelRequest } from "../types";
import type { EmployeeGrade, TravelClass, TripType } from "../types";
import { useWarnIfUnsaved } from "@/hooks/use-warn-if-unsaved";

interface FormState {
  customerId: string;
  linkedServiceBookingIds: string[];
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

interface TravelCreateViewProps {
  initialRequests: TravelRequest[];
  allServiceBookings: AnyServiceBooking[];
  customers: Customer[];
}

function toDateInputValue(now: Date, offsetDays: number): string {
  const copy = new Date(now);
  copy.setDate(copy.getDate() + offsetDays);
  return copy.toISOString().slice(0, 10);
}

function buildInitialFormState(now?: Date): FormState {
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
    departureDate: now ? toDateInputValue(now, 5) : "",
    returnDate: now ? toDateInputValue(now, 7) : "",
    purpose: "",
    travelClass: "economy",
    estimatedCost: "",
    currency: "SAR",
  };
}

export function TravelCreateView({
  initialRequests: _initialRequests, // required by parent, not used in create-only view
  allServiceBookings,
  customers,
}: TravelCreateViewProps) {
  void _initialRequests;
  const locale = useLocale();
  const router = useRouter();
  const isArabic = locale === "ar";
  const t = useMemo(() => getTravelDictionary(locale), [locale]);

  const [form, setForm] = useState<FormState>(buildInitialFormState);
  const [isCreating, setIsCreating] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [sessionPermissions, setSessionPermissions] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  // Hook to warn before unload
  useWarnIfUnsaved(hasUnsavedChanges, isArabic ? "لديك تغييرات غير محفوظة، هل أنت متأكد من المغادرة؟" : "You have unsaved changes, are you sure you want to leave?");

  useEffect(() => {
    const now = new Date();
    setForm((previous) =>
      previous.departureDate && previous.returnDate
        ? previous
        : buildInitialFormState(now),
    );
  }, []);

  // Load draft on mount
  useEffect(() => {
    try {
      const draft = localStorage.getItem("travel_request_draft");
      if (draft) {
        const parsed = JSON.parse(draft) as FormState;
        // Verify it matches the shape roughly
        if (parsed && typeof parsed === 'object' && 'destination' in parsed) {
          setForm(parsed);
          setHasUnsavedChanges(true);
        }
      }
    } catch {
      // ignore parsing errors
    }
  }, []);

  // Save draft whenever it changes
  useEffect(() => {
    if (hasUnsavedChanges && !isCreating) {
      const timeout = setTimeout(() => {
        localStorage.setItem("travel_request_draft", JSON.stringify(form));
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [form, hasUnsavedChanges, isCreating]);

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
        if (active) setSessionUser(null);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const canCreate = sessionPermissions.includes("travel.create");

  const layoutText = useMemo(
    () =>
      isArabic
        ? { previous: "السابق", next: "التالي", detailTabsTitle: "", detailOverview: "", detailOperations: "", detailWorkflow: "", detailAudit: "", quickAll: "", previousPage: "", nextPage: "", rowsInPage: "", matchedRecords: "", formFlowTitle: "", formFlowSubtitle: "", stepEmployee: "", stepTrip: "", stepSchedule: "" }
        : { previous: "Previous", next: "Next", detailTabsTitle: "", detailOverview: "", detailOperations: "", detailWorkflow: "", detailAudit: "", quickAll: "", previousPage: "", nextPage: "", rowsInPage: "", matchedRecords: "", formFlowTitle: "", formFlowSubtitle: "", stepEmployee: "", stepTrip: "", stepSchedule: "" },
    [isArabic],
  );

  const requestFormText = useMemo(
    () =>
      isArabic
        ? { subtitle: "أنشئ طلب سفر شامل في 4 خطوات.", employeeSection: "", employeeHint: "", tripSection: "", tripHint: "", scheduleSection: "", scheduleHint: "", requiredHint: "" }
        : { subtitle: "Create a comprehensive travel request in 4 steps.", employeeSection: "", employeeHint: "", tripSection: "", tripHint: "", scheduleSection: "", scheduleHint: "", requiredHint: "" },
    [isArabic],
  );

  function updateForm<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  }

  function notify(message: string, tone: "success" | "error" = "success") {
    setNotice({ message, tone });
    setTimeout(() => setNotice(null), 2500);
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
      await createTravelRequestApi({
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
      notify(t.notices.created, "success");
      setHasUnsavedChanges(false);
      localStorage.removeItem("travel_request_draft");
      setTimeout(() => router.push("/operations?type=travel"), 1200);
    } catch (err) {
      notify(err instanceof Error ? err.message : t.notices.validationFailed, "error");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={t.labels.createRequest}
        description={requestFormText.subtitle}
        actions={
          <Button variant="secondary" size="sm" onClick={() => router.push("/operations?type=travel")}>
            {isArabic ? "العودة لمركز العمليات" : "Back to Operations"}
          </Button>
        }
      />
      {notice && (
        <p
          className={`mb-4 rounded-md px-3 py-2 text-xs ${notice.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
        >
          {notice.message}
        </p>
      )}
      <div className="mx-auto max-w-3xl">
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
      </div>
    </ErpPageLayout>
  );
}
