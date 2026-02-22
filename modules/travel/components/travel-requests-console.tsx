"use client";

import { Search } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ErpKpiGrid,
  ErpPageHeader,
  ErpPageLayout,
  ErpSection,
} from "@/components/layout/erp-page-layout";
import { Button } from "@/components/ui/button";
import { SlideOver } from "@/components/ui/slide-over";
import { TravelRequestForm } from "./travel-request-form";
import { TravelRequestDetails } from "./travel-request-details";
import type { TravelTransitionId } from "@/modules/travel/workflow/travel-approval-engine";
import { getTravelTransitionOptions } from "@/modules/travel/workflow/travel-approval-engine";
import {
  createTravelRequestApi,
  fetchTravelRequests,
  transitionTravelRequest,
  fetchTravelAuditCsv,
  submitTravelExpenseApi,
  reviewTravelExpenseApi,
  syncTravelFinanceApi,
  fetchTravelTripClosureReadinessApi,
  upsertTravelBookingApi,
} from "@/services/travel-workflow-api";
import { formatCurrency, formatDate } from "@/utils/format";
import { getTravelDictionary } from "../i18n";
import type {
  EmployeeGrade,
  TravelClosureReadiness,
  TravelActorRole,
  TravelClass,
  TravelExpenseCategory,
  TravelRequest,
  TravelRequestStatus,
  TripType,
} from "../types";

interface TravelRequestsConsoleProps {
  initialRequests: TravelRequest[];
}

interface NoticeState {
  tone: "success" | "error";
  message: string;
}

interface FormState {
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

interface SessionUserPayload {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface SessionApiResponse {
  authenticated: boolean;
  user?: SessionUserPayload;
  permissions?: string[];
}

interface BookingFormState {
  vendor: string;
  bookingReference: string;
  ticketNumber: string;
  bookedAt: string;
  totalBookedCost: string | number;
  currency: string;
}

interface ExpenseFormState {
  category: TravelExpenseCategory;
  amount: string | number;
  currency: string;
  expenseDate: string;
  merchant: string;
  description: string;
  receiptFileName: string;
  receiptMimeType: string;
  receiptSizeInBytes: string | number;
}


const NEW_REQUEST_BUTTON_TEXT_EN = "Create Request";
const NEW_REQUEST_BUTTON_TEXT_AR = "إنشاء طلب جديد";

const statusValues: Array<TravelRequestStatus | "all"> = [
  "all",
  "draft",
  "submitted",
  "manager_approved",
  "travel_review",
  "finance_approved",
  "booked",
  "closed",
  "rejected",
  "cancelled",
];



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

const REQUESTS_PAGE_SIZE = 12;

function toDateInputValue(now: Date, offsetDays: number): string {
  const copy = new Date(now);
  copy.setDate(copy.getDate() + offsetDays);
  return copy.toISOString().slice(0, 10);
}

function toDateTimeLocalInputValue(now: Date): string {
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

function buildInitialFormState(): FormState {
  const now = new Date();
  return {
    employeeName: "New Employee",
    employeeEmail: "new.employee@enterprise.local",
    employeeGrade: "staff",
    department: "Operations",
    costCenter: "CC-OPS-001",
    tripType: "domestic",
    origin: "Riyadh",
    destination: "Jeddah",
    departureDate: toDateInputValue(now, 5),
    returnDate: toDateInputValue(now, 7),
    purpose: "Client meeting",
    travelClass: "economy",
    estimatedCost: "1500",
    currency: "SAR",
  };
}

function buildBookingInitialState(): BookingFormState {
  const now = new Date();
  return {
    vendor: "Global Travel GDS",
    bookingReference: "BK-NEW-001",
    ticketNumber: "",
    bookedAt: toDateTimeLocalInputValue(now),
    totalBookedCost: "0",
    currency: "SAR",
  };
}

function buildExpenseInitialState(): ExpenseFormState {
  const now = new Date();
  return {
    category: "hotel",
    amount: "450",
    currency: "SAR",
    expenseDate: toDateInputValue(now, 0),
    merchant: "Hotel Vendor",
    description: "Hotel stay expense",
    receiptFileName: "receipt.pdf",
    receiptMimeType: "application/pdf",
    receiptSizeInBytes: "204800",
  };
}

function sortByUpdatedAtDesc(rows: TravelRequest[]): TravelRequest[] {
  return [...rows].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function mapEnterpriseRoleToTravelActorRole(role?: string): TravelActorRole | null {
  switch (role) {
    case "admin":
      return "admin";
    case "finance_manager":
      return "finance";
    case "agent":
      return "employee";
    case "manager":
      return "manager";
    case "travel_desk":
      return "travel_desk";
    default:
      return null;
  }
}

export function TravelRequestsConsole({ initialRequests }: TravelRequestsConsoleProps) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const t = useMemo(() => getTravelDictionary(locale), [locale]);
  const travelOpsText = useMemo(
    () =>
      locale === "ar"
        ? {
          bookingTitle: "بيانات الحجز",
          bookingSubtitle: "حفظ مرجع الحجز والتذكرة بعد اكتمال الحجز.",
          bookingVendor: "المورّد",
          bookingReference: "مرجع الحجز",
          bookingTicketNumber: "رقم التذكرة",
          bookingBookedAt: "تاريخ الحجز",
          bookingAmount: "تكلفة الحجز",
          bookingSave: "حفظ بيانات الحجز",
          expensesTitle: "مصروفات الرحلة",
          expensesSubtitle: "رفع المطالبات ومراجعتها من المالية.",
          expenseCategory: "الفئة",
          expenseAmount: "المبلغ",
          expenseDate: "تاريخ المصروف",
          expenseMerchant: "المورّد",
          expenseDescription: "الوصف",
          expenseReceiptName: "اسم الملف",
          expenseReceiptType: "نوع الملف",
          expenseReceiptSize: "حجم الملف (بايت)",
          expenseSubmit: "إرسال مطالبة",
          expenseReviewNote: "ملاحظة المراجعة",
          financeTitle: "التكامل المالي",
          financeSubtitle: "ترحيل بنود المصروفات إلى ERP مع إعادة المحاولة عند الفشل.",
          financeSync: "مزامنة مع ERP",
          financeAttempts: "عدد المحاولات",
          financeLastBatch: "آخر دفعة",
          financeLastError: "آخر خطأ",
          financeLines: "قيود دفتر الأستاذ",
          notAvailable: "غير متاح",
          bookingSaved: "تم حفظ بيانات الحجز.",
          expenseSubmitted: "تم إرسال مطالبة المصروفات.",
          expenseReviewed: "تمت مراجعة المطالبة.",
          financeSynced: "تمت مزامنة المصروفات مع ERP.",
        }
        : {
          bookingTitle: "Booking Details",
          bookingSubtitle: "Capture booking reference and ticket details after booking.",
          bookingVendor: "Vendor",
          bookingReference: "Booking Reference",
          bookingTicketNumber: "Ticket Number",
          bookingBookedAt: "Booked At",
          bookingAmount: "Booked Cost",
          bookingSave: "Save Booking Details",
          expensesTitle: "Travel Expenses",
          expensesSubtitle: "Submit and review travel expense claims.",
          expenseCategory: "Category",
          expenseAmount: "Amount",
          expenseDate: "Expense Date",
          expenseMerchant: "Merchant",
          expenseDescription: "Description",
          expenseReceiptName: "Receipt File Name",
          expenseReceiptType: "Receipt MIME Type",
          expenseReceiptSize: "Receipt Size (bytes)",
          expenseSubmit: "Submit Expense",
          expenseReviewNote: "Review Note",
          financeTitle: "Finance Integration",
          financeSubtitle: "Post approved expenses to ERP with retry handling.",
          financeSync: "Sync to ERP",
          financeAttempts: "Attempts",
          financeLastBatch: "Last Batch",
          financeLastError: "Last Error",
          financeLines: "Ledger Lines",
          notAvailable: "Not available",
          bookingSaved: "Booking details saved.",
          expenseSubmitted: "Expense claim submitted.",
          expenseReviewed: "Expense claim reviewed.",
          financeSynced: "Expenses synchronized to ERP.",
        },
    [locale],
  );
  const closureText = useMemo(
    () =>
      locale === "ar"
        ? {
          title: "إغلاق الرحلة",
          subtitle: "فحوصات الجاهزية قبل الإغلاق النهائي وملخص التسوية بعد الإغلاق.",
          ready: "جاهز للإغلاق",
          notReady: "غير جاهز للإغلاق",
          loading: "جارٍ تحميل حالة جاهزية الإغلاق...",
          checks: "فحوصات الإغلاق",
          closedAt: "تاريخ الإغلاق",
          closedBy: "تم الإغلاق بواسطة",
          totalExpenses: "إجمالي المطالبات",
          approvedAmount: "إجمالي المعتمد",
          settledAmount: "إجمالي المسوى",
          varianceBooked: "الانحراف عن تكلفة الحجز",
          varianceEstimated: "الانحراف عن التكلفة التقديرية",
          financeBatch: "دفعة التسوية",
          financeAttempts: "محاولات المزامنة",
          note: "ملاحظة الإغلاق",
        }
        : {
          title: "Trip Closure",
          subtitle: "Readiness checks before final closure and settlement summary after closing.",
          ready: "Ready to Close",
          notReady: "Not Ready to Close",
          loading: "Loading closure readiness...",
          checks: "Closure Checks",
          closedAt: "Closed At",
          closedBy: "Closed By",
          totalExpenses: "Total Claims",
          approvedAmount: "Approved Total",
          settledAmount: "Settled Total",
          varianceBooked: "Variance vs Booked Cost",
          varianceEstimated: "Variance vs Estimated Cost",
          financeBatch: "Settlement Batch",
          financeAttempts: "Sync Attempts",
          note: "Closure Note",
        },
    [locale],
  );
  const requestFormText = useMemo(
    () =>
      locale === "ar"
        ? {
          subtitle: "أدخل بيانات الموظف والرحلة في أقسام واضحة ثم أنشئ مسودة الطلب.",
          employeeSection: "بيانات الموظف",
          employeeHint: "معلومات تعريف مقدم الطلب والمركز الإداري.",
          tripSection: "تفاصيل الرحلة",
          tripHint: "معلومات خط السير وسبب السفر.",
          scheduleSection: "الجدولة والميزانية",
          scheduleHint: "تواريخ الرحلة وتكلفة وتنسيق العملة.",
          requiredHint: "الحقول الإلزامية يجب تعبئتها قبل حفظ المسودة.",
        }
        : {
          subtitle:
            "Enter employee and trip details in structured sections, then create a request draft.",
          employeeSection: "Employee Information",
          employeeHint: "Requester identity and organizational ownership.",
          tripSection: "Trip Details",
          tripHint: "Route and business purpose details.",
          scheduleSection: "Schedule and Budget",
          scheduleHint: "Travel dates, estimated cost, and currency format.",
          requiredHint: "Required fields must be completed before saving the draft.",
        },
    [locale],
  );
  const layoutText = useMemo(
    () =>
      locale === "ar"
        ? {
          formFlowTitle: "تدفق إنشاء الطلب",
          formFlowSubtitle: "أكمل الحقول على خطوات مرتبة بدل نموذج طويل متشعب.",
          stepEmployee: "1. بيانات الموظف",
          stepTrip: "2. تفاصيل الرحلة",
          stepSchedule: "3. الجدولة والميزانية",
          previous: "السابق",
          next: "التالي",
          detailTabsTitle: "عرض تفاصيل الطلب",
          detailOverview: "نظرة عامة",
          detailOperations: "التشغيل المالي",
          detailWorkflow: "مسار الموافقات",
          detailAudit: "سجل التدقيق",
          quickAll: "الكل",
          quickPending: "المعلقة",
          quickBooked: "المحجوزة",
          quickClosed: "المغلقة",
          page: "صفحة",
          previousPage: "السابق",
          nextPage: "التالي",
          rowsInPage: "صفوف في الصفحة",
          matchedRecords: "سجلات مطابقة",
        }
        : {
          formFlowTitle: "Request Creation Flow",
          formFlowSubtitle: "Complete fields in guided steps instead of one long fragmented form.",
          stepEmployee: "1. Employee",
          stepTrip: "2. Trip",
          stepSchedule: "3. Schedule & Budget",
          previous: "Previous",
          next: "Next",
          detailTabsTitle: "Request Details View",
          detailOverview: "Overview",
          detailOperations: "Operations",
          detailWorkflow: "Workflow",
          detailAudit: "Audit",
          quickAll: "All",
          quickPending: "Pending",
          quickBooked: "Booked",
          quickClosed: "Closed",
          page: "Page",
          previousPage: "Previous",
          nextPage: "Next",
          rowsInPage: "rows in page",
          matchedRecords: "matched records",
        },
    [locale],
  );

  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [requests, setRequests] = useState<TravelRequest[]>(() =>
    sortByUpdatedAtDesc(initialRequests),
  );
  const [selectedId, setSelectedId] = useState<string>(initialRequests[0]?.id ?? "");
  const [sessionUser, setSessionUser] = useState<SessionUserPayload | null>(null);
  const [sessionPermissions, setSessionPermissions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TravelRequestStatus | "all">("all");
  const [requestsPage, setRequestsPage] = useState(0);
  const [actionNote, setActionNote] = useState("");
  const [form, setForm] = useState<FormState>(buildInitialFormState);
  const [bookingForm, setBookingForm] = useState<BookingFormState>(buildBookingInitialState);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(buildExpenseInitialState);
  const [expenseReviewNote, setExpenseReviewNote] = useState("");
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [isReviewingExpense, setIsReviewingExpense] = useState(false);
  const [isSyncingFinance, setIsSyncingFinance] = useState(false);

  const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
  const [closureReadiness, setClosureReadiness] = useState<TravelClosureReadiness | null>(null);
  const [isLoadingClosureReadiness, setIsLoadingClosureReadiness] = useState(false);

  const actorRole = useMemo(
    () => mapEnterpriseRoleToTravelActorRole(sessionUser?.role),
    [sessionUser?.role],
  );
  const actorName = sessionUser?.name ?? "";
  const canCreate = sessionPermissions.includes("travel.create");
  const canTransition = sessionPermissions.includes("travel.transition") && !!actorRole;
  const canExportAudit = sessionPermissions.includes("travel.audit_export");
  const canManageBooking = sessionPermissions.includes("travel.booking.manage");
  const canSubmitExpense = sessionPermissions.includes("travel.expense.submit");
  const canReviewExpense = sessionPermissions.includes("travel.expense.review");
  const canSyncFinance = sessionPermissions.includes("travel.finance.sync");

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setRequests(sortByUpdatedAtDesc(initialRequests));
    setSelectedId(initialRequests[0]?.id ?? "");
  }, [initialRequests]);

  useEffect(() => {
    let active = true;

    async function loadSession(): Promise<void> {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          cache: "no-store",
        });
        const payload = (await response.json()) as SessionApiResponse;
        if (!active) {
          return;
        }
        if (payload.authenticated && payload.user) {
          setSessionUser(payload.user);
          setSessionPermissions(Array.isArray(payload.permissions) ? payload.permissions : []);
        } else {
          setSessionUser(null);
          setSessionPermissions([]);
        }
      } catch {
        if (!active) {
          return;
        }
        setSessionUser(null);
        setSessionPermissions([]);
      }
    }

    void loadSession();

    return () => {
      active = false;
    };
  }, []);

  function notify(message: string, tone: NoticeState["tone"] = "success"): void {
    setNotice({ message, tone });
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => setNotice(null), 2500);
  }

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return [
        request.id,
        request.employeeName,
        request.destination,
        request.costCenter,
        request.department,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [requests, search, statusFilter]);
  const requestsPageCount = Math.max(
    1,
    Math.ceil(filteredRequests.length / REQUESTS_PAGE_SIZE),
  );
  const safeRequestsPage = Math.min(requestsPage, requestsPageCount - 1);
  const visibleRequests = filteredRequests.slice(
    safeRequestsPage * REQUESTS_PAGE_SIZE,
    safeRequestsPage * REQUESTS_PAGE_SIZE + REQUESTS_PAGE_SIZE,
  );

  const selectedRequest = useMemo(() => {
    return filteredRequests.find((item) => item.id === selectedId) ?? filteredRequests[0] ?? null;
  }, [filteredRequests, selectedId]);
  const selectedRequestId = selectedRequest?.id ?? "";
  const selectedRequestUpdatedAt = selectedRequest?.updatedAt ?? "";

  useEffect(() => {
    if (!selectedRequest) {
      setSelectedId("");
      return;
    }
    if (selectedRequest.id !== selectedId) {
      setSelectedId(selectedRequest.id);
    }
  }, [selectedId, selectedRequest]);

  useEffect(() => {
    setRequestsPage(0);
  }, [search, statusFilter]);

  useEffect(() => {
    if (!selectedRequestId) {
      // setDetailTab("overview"); // Removed unused state
    }
  }, [selectedRequestId]);

  useEffect(() => {
    if (!selectedRequest) {
      return;
    }

    setBookingForm({
      vendor: selectedRequest.booking?.vendor ?? "Global Travel GDS",
      bookingReference:
        selectedRequest.booking?.bookingReference ?? `BK-${selectedRequest.id.replace("TRV-", "")}`,
      ticketNumber: selectedRequest.booking?.ticketNumber ?? "",
      bookedAt: toDateTimeLocalInputValue(
        selectedRequest.booking?.bookedAt
          ? new Date(selectedRequest.booking.bookedAt)
          : new Date(),
      ),
      totalBookedCost: String(
        selectedRequest.booking?.totalBookedCost ?? selectedRequest.estimatedCost,
      ),
      currency: selectedRequest.booking?.currency ?? selectedRequest.currency,
    });

    setExpenseForm((previous) => ({
      ...previous,
      currency: selectedRequest.currency,
      expenseDate: toDateInputValue(new Date(), 0),
    }));
    setExpenseReviewNote("");
  }, [selectedRequest]);

  useEffect(() => {
    if (!selectedRequestId) {
      setClosureReadiness(null);
      setIsLoadingClosureReadiness(false);
      return;
    }

    let active = true;

    async function loadClosureReadiness(): Promise<void> {
      try {
        setIsLoadingClosureReadiness(true);
        const response = await fetchTravelTripClosureReadinessApi(selectedRequestId);
        if (!active) {
          return;
        }
        setClosureReadiness(response.readiness);
      } catch {
        if (!active) {
          return;
        }
        setClosureReadiness(null);
      } finally {
        if (active) {
          setIsLoadingClosureReadiness(false);
        }
      }
    }

    void loadClosureReadiness();

    return () => {
      active = false;
    };
  }, [selectedRequestId, selectedRequestUpdatedAt]);

  const kpi = useMemo(() => {
    const pendingCount = requests.filter((request) =>
      ["submitted", "manager_approved", "travel_review", "finance_approved"].includes(
        request.status,
      ),
    ).length;
    const bookedCount = requests.filter((request) => request.status === "booked").length;
    const closedCount = requests.filter((request) => request.status === "closed").length;
    return {
      total: requests.length,
      pendingCount,
      blockedPolicyCount: 0,
      bookedCount: bookedCount + closedCount,
    };
  }, [requests]);

  const transitionOptions = useMemo(() => {
    if (!selectedRequest || !actorRole) {
      return [];
    }
    return getTravelTransitionOptions({
      request: selectedRequest,
      actorRole,
    });
  }, [actorRole, selectedRequest]);


  function updateForm<K extends keyof FormState>(field: K, value: FormState[K]): void {
    setForm((previous: FormState) => ({ ...previous, [field]: value }));
  }

  function updateBookingForm<K extends keyof BookingFormState>(
    field: K,
    value: BookingFormState[K],
  ): void {
    setBookingForm((previous) => ({ ...previous, [field]: value }));
  }

  function updateExpenseForm<K extends keyof ExpenseFormState>(
    field: K,
    value: ExpenseFormState[K],
  ): void {
    setExpenseForm((previous) => ({ ...previous, [field]: value }));
  }

  function mergeUpdatedRequest(updatedRequest: TravelRequest): void {
    setRequests((previous) => {
      const exists = previous.some((row) => row.id === updatedRequest.id);
      if (!exists) {
        return sortByUpdatedAtDesc([updatedRequest, ...previous]);
      }
      return sortByUpdatedAtDesc(
        previous.map((row) => (row.id === updatedRequest.id ? updatedRequest : row)),
      );
    });
    setSelectedId(updatedRequest.id);
  }

  async function handleCreateRequest(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canCreate || !actorRole || !actorName.trim()) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    const estimatedCost = Number(form.estimatedCost);
    if (!Number.isFinite(estimatedCost) || estimatedCost <= 0) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    try {
      setIsCreating(true);
      const created = await createTravelRequestApi({
        employeeName: form.employeeName,
        employeeEmail: form.employeeEmail,
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
        estimatedCost,
        currency: form.currency,
      });
      setRequests((previous) => sortByUpdatedAtDesc([created, ...previous]));
      setSelectedId(created.id);
      setForm(buildInitialFormState());
      notify(t.notices.created, "success");
      setIsRequestFormOpen(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.validationFailed, "error");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleTransition(transitionId: TravelTransitionId): Promise<void> {
    if (!selectedRequest || !canTransition) {
      return;
    }
    try {
      setIsActing(true);
      const response = await transitionTravelRequest({
        requestId: selectedRequest.id,
        transitionId,
        note: actionNote.trim() || undefined,
      });
      setRequests((previous) =>
        sortByUpdatedAtDesc(
          previous.map((row) => (row.id === response.request.id ? response.request : row)),
        ),
      );
      setActionNote("");
      notify(t.notices.actionCompleted, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.validationFailed, "error");
    } finally {
      setIsActing(false);
    }
  }

  async function handleRefresh(): Promise<void> {
    try {
      setIsSyncing(true);
      const rows = await fetchTravelRequests();
      setRequests(sortByUpdatedAtDesc(rows));
      if (!rows.find((row) => row.id === selectedId)) {
        setSelectedId(rows[0]?.id ?? "");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.validationFailed, "error");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleExportAudit(): Promise<void> {
    if (!canExportAudit) {
      notify(t.notices.validationFailed, "error");
      return;
    }
    try {
      setIsSyncing(true);
      const csv = await fetchTravelAuditCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "travel-audit-report.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notify(t.notices.exportReady, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.validationFailed, "error");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleSaveBooking(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedRequest || !canManageBooking) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    const totalBookedCost = Number(bookingForm.totalBookedCost);
    if (!Number.isFinite(totalBookedCost) || totalBookedCost <= 0) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    try {
      setIsSavingBooking(true);
      const updated = await upsertTravelBookingApi({
        requestId: selectedRequest.id,
        vendor: bookingForm.vendor,
        bookingReference: bookingForm.bookingReference,
        ticketNumber: bookingForm.ticketNumber || undefined,
        bookedAt: bookingForm.bookedAt
          ? new Date(bookingForm.bookedAt).toISOString()
          : undefined,
        totalBookedCost,
        currency: bookingForm.currency,
      });
      mergeUpdatedRequest(updated);
      notify(travelOpsText.bookingSaved, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.validationFailed, "error");
    } finally {
      setIsSavingBooking(false);
    }
  }

  async function handleSubmitExpense(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedRequest || !canSubmitExpense) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    const amount = Number(expenseForm.amount);
    const receiptSize = Number(expenseForm.receiptSizeInBytes);
    if (
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !Number.isFinite(receiptSize) ||
      receiptSize <= 0
    ) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    try {
      setIsSubmittingExpense(true);
      const response = await submitTravelExpenseApi({
        requestId: selectedRequest.id,
        category: expenseForm.category,
        amount,
        currency: expenseForm.currency,
        expenseDate: expenseForm.expenseDate,
        merchant: expenseForm.merchant,
        description: expenseForm.description,
        receiptFileName: expenseForm.receiptFileName,
        receiptMimeType: expenseForm.receiptMimeType,
        receiptSizeInBytes: receiptSize,
      });
      mergeUpdatedRequest(response.request);
      setExpenseForm(() => ({
        ...buildExpenseInitialState(),
        currency: selectedRequest.currency,
      }));
      notify(travelOpsText.expenseSubmitted, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.validationFailed, "error");
    } finally {
      setIsSubmittingExpense(false);
    }
  }

  async function handleReviewExpense(
    expenseId: string,
    decision: "approve" | "reject",
  ): Promise<void> {
    if (!selectedRequest || !canReviewExpense) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    if (decision === "reject" && !expenseReviewNote.trim()) {
      notify(t.labels.actionNotePlaceholder, "error");
      return;
    }

    try {
      setIsReviewingExpense(true);
      const response = await reviewTravelExpenseApi({
        requestId: selectedRequest.id,
        expenseId,
        decision,
        note: expenseReviewNote.trim() || undefined,
      });
      mergeUpdatedRequest(response.request);
      setExpenseReviewNote("");
      notify(travelOpsText.expenseReviewed, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.validationFailed, "error");
    } finally {
      setIsReviewingExpense(false);
    }
  }

  async function handleFinanceSync(): Promise<void> {
    if (!selectedRequest || !canSyncFinance) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    try {
      setIsSyncingFinance(true);
      const response = await syncTravelFinanceApi({
        requestId: selectedRequest.id,
      });
      mergeUpdatedRequest(response.request);
      notify(`${travelOpsText.financeSynced} (${response.batchId})`, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.validationFailed, "error");
    } finally {
      setIsSyncingFinance(false);
    }
  }

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={t.title}
        description={t.subtitle}
        meta={
          <>
            {t.labels.signedInAs}: {actorName || "-"} | {t.labels.currentRole}:{" "}
            {sessionUser?.role || "-"}
          </>
        }
      />

      <ErpSection
        className="col-span-12 no-print"
        title={locale === "ar" ? "عناصر قابلة للتنفيذ" : "Actionable Controls"}
        description={
          locale === "ar"
            ? "أدر التحديث والتصدير والاعتماد الآلي من نقطة موحدة."
            : "Manage refresh, audit export, and auto-approval from one control zone."
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={isSyncing}
          >
            {t.labels.refresh}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleExportAudit()}
            disabled={isSyncing || !canExportAudit}
          >
            {t.labels.exportAudit}
          </Button>
          <Button
            size="sm"
            onClick={() => setIsRequestFormOpen(true)}
            disabled={isSyncing || !sessionUser}
          >
            {locale === "ar" ? NEW_REQUEST_BUTTON_TEXT_AR : NEW_REQUEST_BUTTON_TEXT_EN}
          </Button>
        </div>
        {notice ? (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-xs ${notice.tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-rose-50 text-rose-700"
              }`}
          >
            {notice.message}
          </p>
        ) : null}
      </ErpSection>

      <ErpKpiGrid className="xl:grid-cols-4">
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{t.kpi.total}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{kpi.total}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{t.kpi.pending}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{kpi.pendingCount}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{t.kpi.blocked}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{kpi.blockedPolicyCount}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{t.kpi.booked}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{kpi.bookedCount}</p>
        </article>
      </ErpKpiGrid>

      <div className="col-span-12 xl:col-span-12">
        <SlideOver
          isOpen={isRequestFormOpen}
          onClose={() => setIsRequestFormOpen(false)}
          title={t.labels.createRequest}
          description={requestFormText.subtitle}
        >
          <TravelRequestForm
            form={form}
            updateForm={updateForm}
            onSubmit={handleCreateRequest}
            isCreating={isCreating}
            canCreate={canCreate}
            sessionAvailable={!!sessionUser}
            layoutText={layoutText}
            requestFormText={requestFormText}
            t={t}
          />
        </SlideOver>

        <div className="space-y-4">
          <section className="surface-card p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-1 gap-4 md:max-w-xl">
                <label className="flex-1 text-xs font-medium text-finance">
                  {t.labels.search}
                  <div className="relative mt-1.5">
                    <Search
                      className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${isArabic ? "right-3" : "left-3"
                        }`}
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t.filters.searchPlaceholder}
                      className={`h-10 w-full rounded-xl border border-border bg-slate-50/50 text-sm text-foreground shadow-sm transition hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10 ${isArabic ? "pr-10 pl-4" : "pr-4 pl-10"
                        }`}
                    />
                  </div>
                </label>
                <label className="flex-1 text-xs font-medium text-finance max-w-[200px]">
                  {t.labels.status}
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as TravelRequestStatus | "all")
                    }
                    className="mt-1.5 h-10 w-full appearance-none rounded-xl border border-border bg-slate-50/50 px-4 text-sm text-foreground shadow-sm transition hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
                  >
                    {statusValues.map((status) => (
                      <option key={status} value={status}>
                        {status === "all" ? t.labels.allStatuses : t.status[status]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button
                size="sm"
                variant="ghost"
                className={statusFilter === "all" ? "bg-slate-100" : ""}
                onClick={() => setStatusFilter("all")}
              >
                {layoutText.quickAll}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={statusFilter === "submitted" ? "bg-slate-100" : ""}
                onClick={() => setStatusFilter("submitted")}
              >
                {layoutText.quickPending}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={statusFilter === "booked" ? "bg-slate-100" : ""}
                onClick={() => setStatusFilter("booked")}
              >
                {layoutText.quickBooked}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className={statusFilter === "closed" ? "bg-slate-100" : ""}
                onClick={() => setStatusFilter("closed")}
              >
                {layoutText.quickClosed}
              </Button>
            </div>
          </section>

          <section className="surface-card overflow-hidden">
            <div className="overflow-x-auto border-b border-border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50/80 text-xs font-semibold text-finance">
                  <tr>
                    <th className="px-4 py-3 text-start">{t.table.id}</th>
                    <th className="px-4 py-3 text-start">{t.table.employee}</th>
                    <th className="px-4 py-3 text-start">{t.table.trip}</th>
                    <th className="px-4 py-3 text-start">{t.table.departure}</th>
                    <th className="px-4 py-3 text-end">{t.table.amount}</th>
                    <th className="px-4 py-3 text-start">{t.table.status}</th>
                    <th className="px-4 py-3 text-start">{t.table.updatedAt}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleRequests.map((request) => (
                    <tr
                      key={request.id}
                      onClick={() => setSelectedId(request.id)}
                      className={`cursor-pointer transition-colors ${request.id === selectedRequest?.id
                        ? "bg-blue-50/50 hover:bg-blue-50/80"
                        : "hover:bg-slate-50/80"
                        }`}
                    >
                      <td className="px-4 py-3 font-medium text-finance">{request.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-finance">{request.employeeName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{request.department}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{request.origin}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium">{request.destination}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-medium">{formatDate(request.departureDate, locale)}</td>
                      <td className="px-4 py-3 text-end font-medium text-finance">
                        {formatCurrency(request.estimatedCost, locale, request.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium shadow-sm ring-1 ring-inset ${requestStatusStyles[request.status]
                            }`}
                        >
                          {t.status[request.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(request.updatedAt, locale)}</td>
                    </tr>
                  ))}
                  {!visibleRequests.length ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center">
                        <div className="mx-auto flex max-w-[420px] flex-col items-center justify-center text-center">
                          <p className="mt-4 text-sm font-semibold text-finance">{t.labels.noRows}</p>
                          <p className="mt-2 text-xs text-muted-foreground">Adjust filters or search to find specific items.</p>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  {visibleRequests.length} {layoutText.rowsInPage}, {filteredRequests.length}{" "}
                  {layoutText.matchedRecords}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={safeRequestsPage <= 0}
                    onClick={() => setRequestsPage((previous) => Math.max(previous - 1, 0))}
                  >
                    {layoutText.previousPage}
                  </Button>
                  <span>
                    {layoutText.page} {safeRequestsPage + 1} / {requestsPageCount}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={safeRequestsPage >= requestsPageCount - 1}
                    onClick={() =>
                      setRequestsPage((previous) =>
                        Math.min(previous + 1, requestsPageCount - 1),
                      )
                    }
                  >
                    {layoutText.nextPage}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {!selectedRequest ? (
            <section className="surface-card p-6 text-sm text-muted-foreground">
              {t.labels.noSelection}
            </section>
          ) : (
            <div className="space-y-4">
              <TravelRequestDetails
                request={selectedRequest}
                locale={locale}
                isArabic={isArabic}
                t={t}
                layoutText={layoutText}
                travelOpsText={travelOpsText}
                closureText={closureText}
                canTransition={canTransition}
                canManageBooking={canManageBooking}
                canSubmitExpense={canSubmitExpense}
                canReviewExpense={canReviewExpense}
                canSyncFinance={canSyncFinance}
                transitionOptions={transitionOptions}
                isActing={isActing}
                isSavingBooking={isSavingBooking}
                isSubmittingExpense={isSubmittingExpense}
                isReviewingExpense={isReviewingExpense}
                isSyncingFinance={isSyncingFinance}
                isLoadingClosureReadiness={isLoadingClosureReadiness}
                closureReadiness={closureReadiness}
                actionNote={actionNote}
                setActionNote={setActionNote}
                handleTransition={handleTransition}
                bookingForm={bookingForm}
                updateBookingForm={updateBookingForm}
                handleSaveBooking={handleSaveBooking}
                expenseForm={expenseForm}
                updateExpenseForm={updateExpenseForm}
                handleSubmitExpense={handleSubmitExpense}
                expenseReviewNote={expenseReviewNote}
                setExpenseReviewNote={setExpenseReviewNote}
                handleReviewExpense={handleReviewExpense}
                handleFinanceSync={handleFinanceSync}
              />
            </div>
          )}
        </div>
      </div>
    </ErpPageLayout >
  );
}
