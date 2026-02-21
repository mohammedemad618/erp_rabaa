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
import type {
  TravelPolicyEditableConfig,
  TravelPolicyVersionRecord,
} from "@/modules/travel/policy/types";
import type { TravelTransitionId } from "@/modules/travel/workflow/travel-approval-engine";
import { getTravelTransitionOptions } from "@/modules/travel/workflow/travel-approval-engine";
import {
  activateTravelPolicyVersionApi,
  autoApproveTravelRequestsApi,
  createTravelPolicyDraftApi,
  createTravelRequestApi,
  fetchActiveTravelPolicyVersionApi,
  fetchTravelAuditCsv,
  fetchTravelTripClosureReadinessApi,
  fetchTravelPolicyVersionsApi,
  fetchTravelRequests,
  reviewTravelExpenseApi,
  simulateTravelPolicy,
  submitTravelExpenseApi,
  syncTravelFinanceApi,
  transitionTravelRequest,
  upsertTravelBookingApi,
} from "@/services/travel-workflow-api";
import { formatCurrency, formatDate } from "@/utils/format";
import { getTravelDictionary } from "../i18n";
import type {
  ApprovalStepStatus,
  EmployeeGrade,
  PolicyComplianceLevel,
  PolicyFindingLevel,
  TravelClosureReadiness,
  TravelActorRole,
  TravelClass,
  TravelExpenseCategory,
  TravelExpenseStatus,
  TravelPolicyEvaluation,
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

interface PolicySimulationFormState {
  employeeGrade: EmployeeGrade;
  tripType: TripType;
  departureDate: string;
  returnDate: string;
  travelClass: TravelClass;
  estimatedCost: string;
  currency: string;
}

interface BookingFormState {
  vendor: string;
  bookingReference: string;
  ticketNumber: string;
  bookedAt: string;
  totalBookedCost: string;
  currency: string;
}

interface ExpenseFormState {
  category: TravelExpenseCategory;
  amount: string;
  currency: string;
  expenseDate: string;
  merchant: string;
  description: string;
  receiptFileName: string;
  receiptMimeType: string;
  receiptSizeInBytes: string;
}

interface PolicyDraftFormState {
  domesticAdvanceDays: string;
  internationalAdvanceDays: string;
  staffBudget: string;
  managerBudget: string;
  directorBudget: string;
  executiveBudget: string;
  staffClass: TravelClass;
  managerClass: TravelClass;
  directorClass: TravelClass;
  executiveClass: TravelClass;
  budgetWarningThreshold: string;
  maxTripLengthDays: string;
  note: string;
}

type RequestFormStep = 1 | 2 | 3;
type TravelDetailTab = "overview" | "operations" | "workflow" | "audit";

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

const approvalStepStatusStyles: Record<ApprovalStepStatus, string> = {
  waiting: "bg-slate-100 text-slate-700",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  skipped: "bg-zinc-100 text-zinc-600",
};

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

const fieldLabelClass = "text-xs font-medium text-muted-foreground";
const fieldControlClass =
  "mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/70";
const fieldTextareaClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/70";
const fieldControlUpperClass = `${fieldControlClass} uppercase tracking-wide`;
const formBlockClass = "rounded-lg border border-border bg-slate-50/70 p-3";
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

function buildPolicySimulationInitialState(): PolicySimulationFormState {
  const now = new Date();
  return {
    employeeGrade: "staff",
    tripType: "domestic",
    departureDate: toDateInputValue(now, 4),
    returnDate: toDateInputValue(now, 6),
    travelClass: "economy",
    estimatedCost: "1200",
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

function buildPolicyDraftFormStateFromVersion(
  version: TravelPolicyVersionRecord | null,
): PolicyDraftFormState {
  const config = version?.config;
  return {
    domesticAdvanceDays: String(config?.minAdvanceDaysByTripType.domestic ?? 2),
    internationalAdvanceDays: String(config?.minAdvanceDaysByTripType.international ?? 7),
    staffBudget: String(config?.maxBudgetByGrade.staff ?? 3500),
    managerBudget: String(config?.maxBudgetByGrade.manager ?? 7500),
    directorBudget: String(config?.maxBudgetByGrade.director ?? 14000),
    executiveBudget: String(config?.maxBudgetByGrade.executive ?? 30000),
    staffClass: config?.maxTravelClassByGrade.staff ?? "economy",
    managerClass: config?.maxTravelClassByGrade.manager ?? "premium_economy",
    directorClass: config?.maxTravelClassByGrade.director ?? "business",
    executiveClass: config?.maxTravelClassByGrade.executive ?? "first",
    budgetWarningThreshold: String(config?.budgetWarningThreshold ?? 0.85),
    maxTripLengthDays: String(config?.maxTripLengthDays ?? 14),
    note: "",
  };
}

function versionStatusText(
  status: TravelPolicyVersionRecord["status"],
  locale: string,
): string {
  const labels: Record<TravelPolicyVersionRecord["status"], { en: string; ar: string }> = {
    draft: { en: "Draft", ar: "مسودة" },
    active: { en: "Active", ar: "مفعل" },
    scheduled: { en: "Scheduled", ar: "مجدول" },
    retired: { en: "Retired", ar: "مؤرشف" },
  };
  const entry = labels[status];
  return locale === "ar" ? entry.ar : entry.en;
}

function sortByUpdatedAtDesc(rows: TravelRequest[]): TravelRequest[] {
  return [...rows].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function isTerminalStatus(status: TravelRequestStatus): boolean {
  return status === "closed" || status === "rejected" || status === "cancelled";
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
  locale: string,
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

function closureCheckLabel(
  code: TravelClosureReadiness["checks"][number]["code"],
  locale: string,
): string {
  const dictionary: Record<TravelClosureReadiness["checks"][number]["code"], { en: string; ar: string }> =
    {
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
  const policyAdminText = useMemo(
    () =>
      locale === "ar"
        ? {
            title: "إدارة السياسات",
            subtitle: "إنشاء إصدارات سياسة مع تفعيل فوري أو مجدول.",
            version: "نسخة السياسة",
            status: "الحالة",
            effectiveFrom: "تاريخ التفعيل",
            createDraft: "إنشاء مسودة",
            activate: "تفعيل",
            activationDate: "تاريخ التفعيل (اختياري)",
            note: "ملاحظة",
            draftCreated: "تم إنشاء مسودة سياسة جديدة.",
            activated: "تم تفعيل نسخة السياسة.",
          }
        : {
            title: "Policy Management",
            subtitle: "Create versioned policy drafts and activate them now or on schedule.",
            version: "Policy Version",
            status: "Status",
            effectiveFrom: "Effective From",
            createDraft: "Create Draft",
            activate: "Activate",
            activationDate: "Activation Date (Optional)",
            note: "Note",
            draftCreated: "Policy draft created.",
            activated: "Policy version activated.",
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
  const workspaceText = useMemo(
    () =>
      locale === "ar"
        ? {
            sessionTitle: "سياق الجلسة",
            sessionSubtitle: "هوية المستخدم النشط وصلاحياته الحالية على سير العمل.",
            policyAdvancedTitle: "إدارة السياسات المتقدمة",
            policyAdvancedSubtitle:
              "إعدادات حساسة يتم استخدامها عادة من قبل المسؤولين فقط عند تحديث السياسة.",
            advanceRules: "قواعد التقديم المسبق",
            budgetCaps: "حدود الميزانية حسب الدرجة",
            policyLimits: "حدود التحكم",
          }
        : {
            sessionTitle: "Session Context",
            sessionSubtitle: "Current actor identity and effective workflow permissions.",
            policyAdvancedTitle: "Advanced Policy Management",
            policyAdvancedSubtitle:
              "Sensitive controls typically used by administrators during policy updates.",
            advanceRules: "Advance Booking Rules",
            budgetCaps: "Budget Caps by Grade",
            policyLimits: "Policy Limits",
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
  const [requestFormStep, setRequestFormStep] = useState<RequestFormStep>(1);
  const [detailTab, setDetailTab] = useState<TravelDetailTab>("overview");
  const [form, setForm] = useState<FormState>(buildInitialFormState);
  const [policySimulationForm, setPolicySimulationForm] = useState<PolicySimulationFormState>(
    buildPolicySimulationInitialState,
  );
  const [bookingForm, setBookingForm] = useState<BookingFormState>(buildBookingInitialState);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(buildExpenseInitialState);
  const [expenseReviewNote, setExpenseReviewNote] = useState("");
  const [policyVersions, setPolicyVersions] = useState<TravelPolicyVersionRecord[]>([]);
  const [activePolicyVersion, setActivePolicyVersion] = useState<TravelPolicyVersionRecord | null>(
    null,
  );
  const [simulationPolicyVersionId, setSimulationPolicyVersionId] = useState<string>("active");
  const [policyDraftForm, setPolicyDraftForm] = useState<PolicyDraftFormState>(() =>
    buildPolicyDraftFormStateFromVersion(null),
  );
  const [policyActivationDate, setPolicyActivationDate] = useState("");
  const [policySimulationResult, setPolicySimulationResult] =
    useState<TravelPolicyEvaluation | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSimulatingPolicy, setIsSimulatingPolicy] = useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
  const [isReviewingExpense, setIsReviewingExpense] = useState(false);
  const [isSyncingFinance, setIsSyncingFinance] = useState(false);
  const [isSyncingPolicies, setIsSyncingPolicies] = useState(false);
  const [isCreatingPolicyDraft, setIsCreatingPolicyDraft] = useState(false);
  const [isActivatingPolicyVersion, setIsActivatingPolicyVersion] = useState<string | null>(null);
  const [closureReadiness, setClosureReadiness] = useState<TravelClosureReadiness | null>(null);
  const [isLoadingClosureReadiness, setIsLoadingClosureReadiness] = useState(false);

  const actorRole = useMemo(
    () => mapEnterpriseRoleToTravelActorRole(sessionUser?.role),
    [sessionUser?.role],
  );
  const actorName = sessionUser?.name ?? "";
  const canCreate = sessionPermissions.includes("travel.create");
  const canTransition = sessionPermissions.includes("travel.transition") && !!actorRole;
  const canAutoApprove = sessionPermissions.includes("travel.auto_approve");
  const canExportAudit = sessionPermissions.includes("travel.audit_export");
  const canManageBooking = sessionPermissions.includes("travel.booking.manage");
  const canSubmitExpense = sessionPermissions.includes("travel.expense.submit");
  const canReviewExpense = sessionPermissions.includes("travel.expense.review");
  const canSyncFinance = sessionPermissions.includes("travel.finance.sync");
  const canViewPolicy = sessionPermissions.includes("travel.policy.view");
  const canManagePolicy = sessionPermissions.includes("travel.policy.manage");

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

  useEffect(() => {
    let active = true;

    async function loadPolicyVersions(): Promise<void> {
      if (!canViewPolicy) {
        if (!active) {
          return;
        }
        setPolicyVersions([]);
        setActivePolicyVersion(null);
        return;
      }

      try {
        setIsSyncingPolicies(true);
        const [activeVersion, versions] = await Promise.all([
          fetchActiveTravelPolicyVersionApi(),
          fetchTravelPolicyVersionsApi(),
        ]);
        if (!active) {
          return;
        }
        setActivePolicyVersion(activeVersion);
        setPolicyVersions(versions);
        setPolicyDraftForm(buildPolicyDraftFormStateFromVersion(activeVersion));
      } catch {
        if (!active) {
          return;
        }
        setActivePolicyVersion(null);
        setPolicyVersions([]);
      } finally {
        if (active) {
          setIsSyncingPolicies(false);
        }
      }
    }

    void loadPolicyVersions();

    return () => {
      active = false;
    };
  }, [canViewPolicy]);

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
      return;
    }
    setDetailTab("overview");
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

  useEffect(() => {
    if (simulationPolicyVersionId === "active") {
      return;
    }
    if (policyVersions.some((version) => version.versionId === simulationPolicyVersionId)) {
      return;
    }
    setSimulationPolicyVersionId("active");
  }, [policyVersions, simulationPolicyVersionId]);

  const kpi = useMemo(() => {
    const pendingCount = requests.filter((request) =>
      ["submitted", "manager_approved", "travel_review", "finance_approved"].includes(
        request.status,
      ),
    ).length;
    const blockedPolicyCount = requests.filter(
      (request) => request.policyEvaluation.level === "blocked",
    ).length;
    const bookedCount = requests.filter((request) => request.status === "booked").length;
    const closedCount = requests.filter((request) => request.status === "closed").length;
    return {
      total: requests.length,
      pendingCount,
      blockedPolicyCount,
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

  const selectedExpenses = selectedRequest?.expenses ?? [];
  const pendingExpenses = selectedExpenses.filter((expense) => expense.status === "submitted");
  const approvedUnsyncedExpenses = selectedExpenses.filter(
    (expense) => expense.status === "approved" && !expense.syncedAt,
  );
  const closureChecks = closureReadiness?.checks ?? [];
  const canProceedToTripStep = Boolean(
    form.employeeName.trim() &&
      form.employeeEmail.trim() &&
      form.department.trim() &&
      form.costCenter.trim(),
  );
  const canProceedToScheduleStep = Boolean(
    form.origin.trim() && form.destination.trim() && form.purpose.trim(),
  );

  function updateForm<K extends keyof FormState>(field: K, value: FormState[K]): void {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  function updatePolicySimulationForm<K extends keyof PolicySimulationFormState>(
    field: K,
    value: PolicySimulationFormState[K],
  ): void {
    setPolicySimulationForm((previous) => ({ ...previous, [field]: value }));
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

  function updatePolicyDraftForm<K extends keyof PolicyDraftFormState>(
    field: K,
    value: PolicyDraftFormState[K],
  ): void {
    setPolicyDraftForm((previous) => ({ ...previous, [field]: value }));
  }

  function buildPolicyEditableConfigFromDraft(): TravelPolicyEditableConfig | null {
    const domesticAdvanceDays = Number(policyDraftForm.domesticAdvanceDays);
    const internationalAdvanceDays = Number(policyDraftForm.internationalAdvanceDays);
    const staffBudget = Number(policyDraftForm.staffBudget);
    const managerBudget = Number(policyDraftForm.managerBudget);
    const directorBudget = Number(policyDraftForm.directorBudget);
    const executiveBudget = Number(policyDraftForm.executiveBudget);
    const budgetWarningThreshold = Number(policyDraftForm.budgetWarningThreshold);
    const maxTripLengthDays = Number(policyDraftForm.maxTripLengthDays);

    const numericValues = [
      domesticAdvanceDays,
      internationalAdvanceDays,
      staffBudget,
      managerBudget,
      directorBudget,
      executiveBudget,
      budgetWarningThreshold,
      maxTripLengthDays,
    ];
    if (numericValues.some((value) => !Number.isFinite(value))) {
      return null;
    }

    return {
      minAdvanceDaysByTripType: {
        domestic: domesticAdvanceDays,
        international: internationalAdvanceDays,
      },
      maxBudgetByGrade: {
        staff: staffBudget,
        manager: managerBudget,
        director: directorBudget,
        executive: executiveBudget,
      },
      maxTravelClassByGrade: {
        staff: policyDraftForm.staffClass,
        manager: policyDraftForm.managerClass,
        director: policyDraftForm.directorClass,
        executive: policyDraftForm.executiveClass,
      },
      budgetWarningThreshold,
      maxTripLengthDays,
    };
  }

  async function refreshPolicyState(): Promise<void> {
    if (!canViewPolicy) {
      return;
    }
    try {
      setIsSyncingPolicies(true);
      const [activeVersion, versions] = await Promise.all([
        fetchActiveTravelPolicyVersionApi(),
        fetchTravelPolicyVersionsApi(),
      ]);
      setActivePolicyVersion(activeVersion);
      setPolicyVersions(versions);
      setPolicyDraftForm((previous) => ({
        ...buildPolicyDraftFormStateFromVersion(activeVersion),
        note: previous.note,
      }));
    } catch {
      return;
    } finally {
      setIsSyncingPolicies(false);
    }
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
      setRequestFormStep(1);
      notify(t.notices.created, "success");
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
      if (canViewPolicy) {
        await refreshPolicyState();
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.validationFailed, "error");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleAutoApprove(): Promise<void> {
    if (!canAutoApprove) {
      notify(t.notices.validationFailed, "error");
      return;
    }
    try {
      setIsSyncing(true);
      const result = await autoApproveTravelRequestsApi({
      });
      const rows = await fetchTravelRequests();
      setRequests(sortByUpdatedAtDesc(rows));
      notify(
        `${t.notices.autoApproved} (${result.updated}/${result.scanned})`,
        "success",
      );
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

  async function handlePolicySimulation(): Promise<void> {
    const estimatedCost = Number(policySimulationForm.estimatedCost);
    if (!Number.isFinite(estimatedCost) || estimatedCost <= 0) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    try {
      setIsSimulatingPolicy(true);
      const result = await simulateTravelPolicy({
        employeeGrade: policySimulationForm.employeeGrade,
        tripType: policySimulationForm.tripType,
        departureDate: policySimulationForm.departureDate,
        returnDate: policySimulationForm.returnDate,
        travelClass: policySimulationForm.travelClass,
        estimatedCost,
        currency: policySimulationForm.currency,
        policyVersionId:
          simulationPolicyVersionId === "active" ? undefined : simulationPolicyVersionId,
      });
      setPolicySimulationResult(result);
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.validationFailed, "error");
    } finally {
      setIsSimulatingPolicy(false);
    }
  }

  async function handleCreatePolicyDraft(): Promise<void> {
    if (!canManagePolicy) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    const config = buildPolicyEditableConfigFromDraft();
    if (!config) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    try {
      setIsCreatingPolicyDraft(true);
      await createTravelPolicyDraftApi({
        config,
        note: policyDraftForm.note.trim() || undefined,
      });
      await refreshPolicyState();
      setPolicyDraftForm((previous) => ({ ...previous, note: "" }));
      notify(policyAdminText.draftCreated, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.validationFailed, "error");
    } finally {
      setIsCreatingPolicyDraft(false);
    }
  }

  async function handleActivatePolicyVersion(versionId: string): Promise<void> {
    if (!canManagePolicy) {
      notify(t.notices.validationFailed, "error");
      return;
    }

    try {
      setIsActivatingPolicyVersion(versionId);
      await activateTravelPolicyVersionApi({
        versionId,
        effectiveFrom: policyActivationDate
          ? new Date(`${policyActivationDate}T00:00:00`).toISOString()
          : undefined,
        note: policyDraftForm.note.trim() || undefined,
      });
      await refreshPolicyState();
      notify(policyAdminText.activated, "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : t.notices.validationFailed, "error");
    } finally {
      setIsActivatingPolicyVersion(null);
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
            onClick={() => void handleAutoApprove()}
            disabled={isSyncing || !canAutoApprove}
          >
            {t.labels.autoApprove}
          </Button>
        </div>
        {notice ? (
          <p
            className={`mt-3 rounded-md px-3 py-2 text-xs ${
              notice.tone === "success"
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

      <div className="col-span-12 grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <section className="surface-card p-4">
            <h3 className="text-sm font-semibold text-finance">{workspaceText.sessionTitle}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{workspaceText.sessionSubtitle}</p>
            <div className="mt-3 grid gap-2">
              <p className="rounded-md border border-border bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                {t.labels.signedInAs}: <bdi className="font-semibold text-finance">{actorName || "-"}</bdi>
              </p>
              <p className="rounded-md border border-border bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                {t.labels.currentRole}: <bdi className="font-semibold text-finance">{sessionUser?.role || "-"}</bdi>
              </p>
              {!sessionUser ? (
                <p className="text-xs text-rose-600">{t.labels.sessionUnavailable}</p>
              ) : null}
            </div>
          </section>

          <section className="surface-card p-4">
            <h3 className="text-sm font-semibold text-finance">{t.labels.simulatePolicy}</h3>
            <div className="mt-3 grid gap-2">
              <div className="grid grid-cols-1 gap-2">
                <p className="rounded-md border border-border bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
                  {policyAdminText.version}:{" "}
                  <bdi className="font-semibold text-finance">
                    {activePolicyVersion?.versionId ?? "-"}
                  </bdi>
                </p>
                <label className="text-xs text-muted-foreground">
                  {locale === "ar" ? "نسخة المحاكاة" : "Simulation Version"}
                  <select
                    value={simulationPolicyVersionId}
                    onChange={(event) => setSimulationPolicyVersionId(event.target.value)}
                    className={fieldControlClass}
                    disabled={!canViewPolicy || isSyncingPolicies}
                  >
                    <option value="active">
                      {locale === "ar" ? "السياسة الفعالة حاليًا" : "Current Active Policy"}
                    </option>
                    {policyVersions.map((version) => (
                      <option key={version.versionId} value={version.versionId}>
                        {version.versionId} ({versionStatusText(version.status, locale)})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  {t.form.employeeGrade}
                  <select
                    value={policySimulationForm.employeeGrade}
                    onChange={(event) =>
                      updatePolicySimulationForm(
                        "employeeGrade",
                        event.target.value as EmployeeGrade,
                      )
                    }
                    className={fieldControlClass}
                  >
                    {(["staff", "manager", "director", "executive"] as EmployeeGrade[]).map(
                      (grade) => (
                        <option key={grade} value={grade}>
                          {t.grade[grade]}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  {t.form.tripType}
                  <select
                    value={policySimulationForm.tripType}
                    onChange={(event) =>
                      updatePolicySimulationForm("tripType", event.target.value as TripType)
                    }
                    className={fieldControlClass}
                  >
                    {(["domestic", "international"] as TripType[]).map((tripType) => (
                      <option key={tripType} value={tripType}>
                        {t.tripType[tripType]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  {t.form.departureDate}
                  <input
                    type="date"
                    value={policySimulationForm.departureDate}
                    onChange={(event) =>
                      updatePolicySimulationForm("departureDate", event.target.value)
                    }
                    className={fieldControlClass}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  {t.form.returnDate}
                  <input
                    type="date"
                    value={policySimulationForm.returnDate}
                    onChange={(event) =>
                      updatePolicySimulationForm("returnDate", event.target.value)
                    }
                    className={fieldControlClass}
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-muted-foreground">
                  {t.form.travelClass}
                  <select
                    value={policySimulationForm.travelClass}
                    onChange={(event) =>
                      updatePolicySimulationForm(
                        "travelClass",
                        event.target.value as TravelClass,
                      )
                    }
                    className={fieldControlClass}
                  >
                    {(
                      ["economy", "premium_economy", "business", "first"] as TravelClass[]
                    ).map((travelClass) => (
                      <option key={travelClass} value={travelClass}>
                        {t.travelClass[travelClass]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  {t.form.estimatedCost}
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={policySimulationForm.estimatedCost}
                    onChange={(event) =>
                      updatePolicySimulationForm("estimatedCost", event.target.value)
                    }
                    className={fieldControlClass}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  {t.form.currency}
                  <input
                    value={policySimulationForm.currency}
                    onChange={(event) =>
                      updatePolicySimulationForm("currency", event.target.value.toUpperCase())
                    }
                    className={fieldControlUpperClass}
                  />
                </label>
              </div>
              <Button
                variant="secondary"
                onClick={() => void handlePolicySimulation()}
                disabled={isSimulatingPolicy || !sessionPermissions.includes("travel.view")}
              >
                {t.labels.runSimulation}
              </Button>
            </div>

            {policySimulationResult ? (
              <div className="mt-3 rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-finance">{t.labels.simulationResult}</p>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${
                      policyLevelStyles[policySimulationResult.level]
                    }`}
                  >
                    {t.policyLevel[policySimulationResult.level]}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {policySimulationResult.findings.map((finding) => (
                    <div
                      key={`simulation-${finding.code}`}
                      className="rounded-md border border-border px-2 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-finance">{finding.message}</span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            findingLevelStyles[finding.level]
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
              </div>
            ) : null}

            {canViewPolicy ? (
              <details className="mt-4 rounded-lg border border-border bg-slate-50">
                <summary className="cursor-pointer list-none px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-finance">{workspaceText.policyAdvancedTitle}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {workspaceText.policyAdvancedSubtitle}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-muted-foreground">
                      {policyAdminText.status}
                    </span>
                  </div>
                </summary>

                <div className="space-y-3 border-t border-border px-3 py-3">
                  <div className={formBlockClass}>
                    <label className={fieldLabelClass}>
                      {policyAdminText.activationDate}
                      <input
                        type="date"
                        value={policyActivationDate}
                        onChange={(event) => setPolicyActivationDate(event.target.value)}
                        className={fieldControlClass}
                      />
                    </label>
                    <label className={`${fieldLabelClass} mt-2 block`}>
                      {policyAdminText.note}
                      <input
                        value={policyDraftForm.note}
                        onChange={(event) => updatePolicyDraftForm("note", event.target.value)}
                        className={fieldControlClass}
                      />
                    </label>
                  </div>

                  <div className={formBlockClass}>
                    <p className="text-xs font-semibold text-finance">{workspaceText.advanceRules}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className={fieldLabelClass}>
                        {locale === "ar" ? "تقديم مسبق داخلي" : "Domestic Advance"}
                        <input
                          type="number"
                          min="0"
                          value={policyDraftForm.domesticAdvanceDays}
                          onChange={(event) =>
                            updatePolicyDraftForm("domesticAdvanceDays", event.target.value)
                          }
                          className={fieldControlClass}
                        />
                      </label>
                      <label className={fieldLabelClass}>
                        {locale === "ar" ? "تقديم مسبق دولي" : "International Advance"}
                        <input
                          type="number"
                          min="0"
                          value={policyDraftForm.internationalAdvanceDays}
                          onChange={(event) =>
                            updatePolicyDraftForm("internationalAdvanceDays", event.target.value)
                          }
                          className={fieldControlClass}
                        />
                      </label>
                    </div>
                  </div>

                  <div className={formBlockClass}>
                    <p className="text-xs font-semibold text-finance">{workspaceText.budgetCaps}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className={fieldLabelClass}>
                        {locale === "ar" ? "حد ميزانية موظف" : "Staff Budget Cap"}
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={policyDraftForm.staffBudget}
                          onChange={(event) => updatePolicyDraftForm("staffBudget", event.target.value)}
                          className={fieldControlClass}
                        />
                      </label>
                      <label className={fieldLabelClass}>
                        {locale === "ar" ? "حد ميزانية مدير" : "Manager Budget Cap"}
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={policyDraftForm.managerBudget}
                          onChange={(event) => updatePolicyDraftForm("managerBudget", event.target.value)}
                          className={fieldControlClass}
                        />
                      </label>
                      <label className={fieldLabelClass}>
                        {locale === "ar" ? "حد ميزانية مدير عام" : "Director Budget Cap"}
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={policyDraftForm.directorBudget}
                          onChange={(event) =>
                            updatePolicyDraftForm("directorBudget", event.target.value)
                          }
                          className={fieldControlClass}
                        />
                      </label>
                      <label className={fieldLabelClass}>
                        {locale === "ar" ? "حد ميزانية تنفيذي" : "Executive Budget Cap"}
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={policyDraftForm.executiveBudget}
                          onChange={(event) =>
                            updatePolicyDraftForm("executiveBudget", event.target.value)
                          }
                          className={fieldControlClass}
                        />
                      </label>
                    </div>
                  </div>

                  <div className={formBlockClass}>
                    <p className="text-xs font-semibold text-finance">{workspaceText.policyLimits}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className={fieldLabelClass}>
                        {locale === "ar" ? "تحذير الميزانية" : "Budget Warning Threshold"}
                        <input
                          type="number"
                          min="0.01"
                          max="0.99"
                          step="0.01"
                          value={policyDraftForm.budgetWarningThreshold}
                          onChange={(event) =>
                            updatePolicyDraftForm("budgetWarningThreshold", event.target.value)
                          }
                          className={fieldControlClass}
                        />
                      </label>
                      <label className={fieldLabelClass}>
                        {locale === "ar" ? "الحد الأقصى لأيام الرحلة" : "Max Trip Length Days"}
                        <input
                          type="number"
                          min="1"
                          value={policyDraftForm.maxTripLengthDays}
                          onChange={(event) =>
                            updatePolicyDraftForm("maxTripLengthDays", event.target.value)
                          }
                          className={fieldControlClass}
                        />
                      </label>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() => void handleCreatePolicyDraft()}
                    disabled={isCreatingPolicyDraft || !canManagePolicy}
                  >
                    {policyAdminText.createDraft}
                  </Button>

                  <div className="max-h-[220px] space-y-2 overflow-auto pe-1">
                    {policyVersions.map((version) => (
                      <article
                        key={version.versionId}
                        className="rounded-md border border-border bg-white px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium text-finance">{version.versionId}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                            {versionStatusText(version.status, locale)}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {policyAdminText.effectiveFrom}: {formatDate(version.effectiveFrom, locale)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {policyAdminText.status}: {versionStatusText(version.status, locale)}
                        </p>
                        <div className="mt-2">
                          <Button
                            size="sm"
                            onClick={() => void handleActivatePolicyVersion(version.versionId)}
                            disabled={
                              !canManagePolicy ||
                              isActivatingPolicyVersion === version.versionId ||
                              version.status === "active"
                            }
                          >
                            {policyAdminText.activate}
                          </Button>
                        </div>
                      </article>
                    ))}
                    {!policyVersions.length ? (
                      <p className="text-xs text-muted-foreground">
                        {isSyncingPolicies
                          ? locale === "ar"
                            ? "جاري تحميل الإصدارات..."
                            : "Loading policy versions..."
                          : travelOpsText.notAvailable}
                      </p>
                    ) : null}
                  </div>
                </div>
              </details>
            ) : null}
          </section>

          <section className="surface-card p-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-finance">{t.labels.createRequest}</h3>
              <p className="text-xs text-muted-foreground">{requestFormText.subtitle}</p>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleCreateRequest}>
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
                    className={`rounded-md border px-3 py-2 text-start text-xs transition ${
                      requestFormStep === item.step
                        ? "border-primary bg-blue-50 text-finance"
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
                        {(["staff", "manager", "director", "executive"] as EmployeeGrade[]).map(
                          (grade) => (
                            <option key={grade} value={grade}>
                              {t.grade[grade]}
                            </option>
                          ),
                        )}
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
                        onChange={(event) =>
                          updateForm("travelClass", event.target.value as TravelClass)
                        }
                        className={fieldControlClass}
                      >
                        {(
                          ["economy", "premium_economy", "business", "first"] as TravelClass[]
                        ).map((travelClass) => (
                          <option key={travelClass} value={travelClass}>
                            {t.travelClass[travelClass]}
                          </option>
                        ))}
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
                          onChange={(event) =>
                            updateForm("currency", event.target.value.toUpperCase())
                          }
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
                </>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setRequestFormStep((previous) => (previous === 3 ? 2 : 1))
                  }
                  disabled={requestFormStep === 1}
                >
                  {layoutText.previous}
                </Button>

                {requestFormStep < 3 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (requestFormStep === 1 && !canProceedToTripStep) {
                        notify(t.notices.validationFailed, "error");
                        return;
                      }
                      if (requestFormStep === 2 && !canProceedToScheduleStep) {
                        notify(t.notices.validationFailed, "error");
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
                    className="w-full"
                    disabled={isCreating || !canCreate || !sessionUser}
                  >
                    {t.labels.submitDraft}
                  </Button>
                )}
              </div>
            </form>
          </section>
        </div>

        <div className="space-y-4">
          <section className="surface-card p-4">
            <div className="grid gap-2 md:grid-cols-[1fr_220px]">
              <label className="text-xs text-muted-foreground">
                {t.labels.search}
                <div className="relative mt-1">
                  <Search
                    className={`pointer-events-none absolute top-2.5 h-4 w-4 text-muted-foreground ${
                      isArabic ? "right-2" : "left-2"
                    }`}
                  />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t.filters.searchPlaceholder}
                    className={`h-10 w-full rounded-lg border border-slate-300 bg-white text-sm text-foreground shadow-sm transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/70 ${
                      isArabic ? "pr-8 pl-3" : "pr-3 pl-8"
                    }`}
                  />
                </div>
              </label>
              <label className="text-xs text-muted-foreground">
                {t.labels.status}
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as TravelRequestStatus | "all")
                  }
                  className={fieldControlClass}
                >
                  {statusValues.map((status) => (
                    <option key={status} value={status}>
                      {status === "all" ? t.labels.allStatuses : t.status[status]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
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
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start">{t.table.id}</th>
                    <th className="px-3 py-2 text-start">{t.table.employee}</th>
                    <th className="px-3 py-2 text-start">{t.table.trip}</th>
                    <th className="px-3 py-2 text-start">{t.table.departure}</th>
                    <th className="px-3 py-2 text-end">{t.table.amount}</th>
                    <th className="px-3 py-2 text-start">{t.table.status}</th>
                    <th className="px-3 py-2 text-start">{t.table.updatedAt}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRequests.map((request) => (
                    <tr
                      key={request.id}
                      onClick={() => setSelectedId(request.id)}
                      className={`cursor-pointer border-t border-border ${
                        request.id === selectedRequest?.id ? "bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-2 font-medium text-finance">{request.id}</td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-finance">{request.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{request.department}</p>
                      </td>
                      <td className="px-3 py-2">
                        {request.origin}
                        {" -> "}
                        {request.destination}
                      </td>
                      <td className="px-3 py-2">{formatDate(request.departureDate, locale)}</td>
                      <td className="px-3 py-2 text-end">
                        {formatCurrency(request.estimatedCost, locale, request.currency)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            requestStatusStyles[request.status]
                          }`}
                        >
                          {t.status[request.status]}
                        </span>
                      </td>
                      <td className="px-3 py-2">{formatDate(request.updatedAt, locale)}</td>
                    </tr>
                  ))}
                  {!visibleRequests.length ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-5 text-center text-sm text-muted-foreground">
                        {t.labels.noRows}
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
              <section className="surface-card no-print p-3">
                <p className="text-xs font-semibold text-finance">{layoutText.detailTabsTitle}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    [
                      { id: "overview", label: layoutText.detailOverview },
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
                {detailTab === "overview" ? (
                  <>
              <section className="surface-card p-4">
                <h3 className="text-sm font-semibold text-finance">{t.labels.requestDetails}</h3>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <dt className="text-muted-foreground">{t.form.employeeName}</dt>
                  <dd className="font-medium text-finance">{selectedRequest.employeeName}</dd>
                  <dt className="text-muted-foreground">{t.form.employeeEmail}</dt>
                  <dd className="font-medium text-finance">{selectedRequest.employeeEmail}</dd>
                  <dt className="text-muted-foreground">{t.form.employeeGrade}</dt>
                  <dd className="font-medium text-finance">
                    {t.grade[selectedRequest.employeeGrade]}
                  </dd>
                  <dt className="text-muted-foreground">{t.form.tripType}</dt>
                  <dd className="font-medium text-finance">
                    {t.tripType[selectedRequest.tripType]}
                  </dd>
                  <dt className="text-muted-foreground">{t.form.travelClass}</dt>
                  <dd className="font-medium text-finance">
                    {t.travelClass[selectedRequest.travelClass]}
                  </dd>
                  <dt className="text-muted-foreground">{t.form.purpose}</dt>
                  <dd className="font-medium text-finance">{selectedRequest.purpose}</dd>
                  <dt className="text-muted-foreground">{t.form.costCenter}</dt>
                  <dd className="font-medium text-finance">{selectedRequest.costCenter}</dd>
                  <dt className="text-muted-foreground">{t.labels.status}</dt>
                  <dd className="font-medium text-finance">{t.status[selectedRequest.status]}</dd>
                </dl>
              </section>

              <section className="surface-card p-4">
                <h3 className="text-sm font-semibold text-finance">{t.labels.policyEvaluation}</h3>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      policyLevelStyles[selectedRequest.policyEvaluation.level]
                    }`}
                  >
                    {t.policyLevel[selectedRequest.policyEvaluation.level]}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {selectedRequest.policyEvaluation.policyVersion}
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  {selectedRequest.policyEvaluation.findings.map((finding) => (
                    <div
                      key={`${selectedRequest.id}-${finding.code}`}
                      className="rounded-md border border-border px-3 py-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-finance">{finding.message}</span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            findingLevelStyles[finding.level]
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
                        ? t.transitionReason[option.blockedReason]
                        : noteMissing
                          ? t.labels.actionNotePlaceholder
                          : "";

                      return (
                        <Button
                          key={option.id}
                          variant={option.id.includes("reject") || option.id.includes("cancel")
                            ? "danger"
                            : "secondary"}
                          onClick={() => void handleTransition(option.id)}
                          disabled={disabled || !canTransition || isTerminalStatus(selectedRequest.status)}
                          title={disabledReason}
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
                ) : null}

                {detailTab === "operations" ? (
                  <>
              <section className="surface-card p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-finance">{travelOpsText.bookingTitle}</h3>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      requestStatusStyles[selectedRequest.status]
                    }`}
                  >
                    {t.status[selectedRequest.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{travelOpsText.bookingSubtitle}</p>

                {selectedRequest.booking ? (
                  <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                    <dt className="text-muted-foreground">{travelOpsText.bookingVendor}</dt>
                    <dd className="font-medium text-finance">{selectedRequest.booking.vendor}</dd>
                    <dt className="text-muted-foreground">{travelOpsText.bookingReference}</dt>
                    <dd className="font-medium text-finance">
                      {selectedRequest.booking.bookingReference}
                    </dd>
                    <dt className="text-muted-foreground">{travelOpsText.bookingTicketNumber}</dt>
                    <dd className="font-medium text-finance">
                      {selectedRequest.booking.ticketNumber || "-"}
                    </dd>
                    <dt className="text-muted-foreground">{travelOpsText.bookingBookedAt}</dt>
                    <dd className="font-medium text-finance">
                      {formatDate(selectedRequest.booking.bookedAt, locale)}
                    </dd>
                  </dl>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">{travelOpsText.notAvailable}</p>
                )}

                <form className="mt-3 space-y-3" onSubmit={(event) => void handleSaveBooking(event)}>
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
                    disabled={
                      isSavingBooking || !canManageBooking || selectedRequest.status !== "booked"
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
                  <form className="space-y-3" onSubmit={(event) => void handleSubmitExpense(event)}>
                    <div className={formBlockClass}>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className={fieldLabelClass}>
                          {travelOpsText.expenseCategory}
                          <select
                            value={expenseForm.category}
                            onChange={(event) =>
                              updateExpenseForm(
                                "category",
                                event.target.value as TravelExpenseCategory,
                              )
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
                      disabled={
                        isSubmittingExpense || !canSubmitExpense || selectedRequest.status !== "booked"
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
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                expenseStatusStyles[expense.status]
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
                                onClick={() => void handleReviewExpense(expense.id, "approve")}
                                disabled={isReviewingExpense}
                              >
                                {locale === "ar" ? "اعتماد" : "Approve"}
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => void handleReviewExpense(expense.id, "reject")}
                                disabled={isReviewingExpense}
                              >
                                {locale === "ar" ? "رفض" : "Reject"}
                              </Button>
                            </div>
                          ) : null}
                        </article>
                      ))}
                      {!selectedExpenses.length ? (
                        <p className="text-xs text-muted-foreground">{travelOpsText.notAvailable}</p>
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
                    className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                      financeSyncStatusStyles[selectedRequest.financeSync.status]
                    }`}
                  >
                    {financeSyncStatusLabel(selectedRequest.financeSync.status, locale)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => void handleFinanceSync()}
                    disabled={isSyncingFinance || !canSyncFinance || !approvedUnsyncedExpenses.length}
                  >
                    {travelOpsText.financeSync}
                  </Button>
                </div>
                <dl className="mt-3 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">{travelOpsText.financeAttempts}</dt>
                    <dd className="font-medium text-finance">
                      {selectedRequest.financeSync.attemptCount}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">{travelOpsText.financeLastBatch}</dt>
                    <dd className="font-medium text-finance">
                      {selectedRequest.financeSync.lastBatchId || "-"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">{travelOpsText.financeLines}</dt>
                    <dd className="font-medium text-finance">
                      {selectedRequest.financeSync.ledgerLines.length}
                    </dd>
                  </div>
                </dl>
                {selectedRequest.financeSync.lastError ? (
                  <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {travelOpsText.financeLastError}: {selectedRequest.financeSync.lastError}
                  </p>
                ) : null}

                <div className="mt-4 rounded-md border border-border bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-finance">{closureText.title}</h4>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        closureReadiness?.ready
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
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  check.passed
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
                          <dd className="font-medium text-finance">{closureReadiness.totalExpenses}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{closureText.approvedAmount}</dt>
                          <dd className="font-medium text-finance">
                            {formatCurrency(
                              closureReadiness.totalApprovedAmount,
                              locale,
                              selectedRequest.currency,
                            )}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{closureText.settledAmount}</dt>
                          <dd className="font-medium text-finance">
                            {formatCurrency(
                              closureReadiness.totalApprovedSyncedAmount,
                              locale,
                              selectedRequest.currency,
                            )}
                          </dd>
                        </div>
                      </dl>
                    </>
                  ) : null}

                  {selectedRequest.closure ? (
                    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2">
                      <dl className="space-y-1 text-[11px]">
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{closureText.closedAt}</dt>
                          <dd className="font-medium text-finance">
                            {formatDate(selectedRequest.closure.closedAt, locale)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{closureText.closedBy}</dt>
                          <dd className="font-medium text-finance">{selectedRequest.closure.closedBy}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{closureText.totalExpenses}</dt>
                          <dd className="font-medium text-finance">
                            {selectedRequest.closure.totalExpenses}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{closureText.approvedAmount}</dt>
                          <dd className="font-medium text-finance">
                            {formatCurrency(
                              selectedRequest.closure.totalApprovedAmount,
                              locale,
                              selectedRequest.currency,
                            )}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{closureText.settledAmount}</dt>
                          <dd className="font-medium text-finance">
                            {formatCurrency(
                              selectedRequest.closure.totalSettledAmount,
                              locale,
                              selectedRequest.currency,
                            )}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{closureText.varianceBooked}</dt>
                          <dd className="font-medium text-finance">
                            {formatCurrency(
                              selectedRequest.closure.varianceFromBookedCost,
                              locale,
                              selectedRequest.currency,
                            )}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{closureText.varianceEstimated}</dt>
                          <dd className="font-medium text-finance">
                            {formatCurrency(
                              selectedRequest.closure.varianceFromEstimatedCost,
                              locale,
                              selectedRequest.currency,
                            )}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{closureText.financeBatch}</dt>
                          <dd className="font-medium text-finance">
                            {selectedRequest.closure.financeBatchId || "-"}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-muted-foreground">{closureText.financeAttempts}</dt>
                          <dd className="font-medium text-finance">
                            {selectedRequest.closure.financeAttemptCount}
                          </dd>
                        </div>
                        {selectedRequest.closure.closureNote ? (
                          <div className="flex items-start justify-between gap-2">
                            <dt className="text-muted-foreground">{closureText.note}</dt>
                            <dd className="max-w-[60%] text-end font-medium text-finance">
                              {selectedRequest.closure.closureNote}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  ) : null}
                </div>
              </section>
                  </>
                ) : null}

                {detailTab === "workflow" ? (
              <section className="surface-card p-4 xl:col-span-2">
                <h3 className="text-sm font-semibold text-finance">{t.labels.approvalRoute}</h3>
                <div className="mt-3 space-y-2">
                  {selectedRequest.approvalRoute.map((step) => (
                    <div key={step.id} className="rounded-md border border-border px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-finance">{t.roles[step.role]}</span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 font-medium ${
                            approvalStepStatusStyles[step.status]
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
                ) : null}

                {detailTab === "audit" ? (
              <section className="surface-card p-4 xl:col-span-2">
                <h3 className="text-sm font-semibold text-finance">{t.labels.auditTrail}</h3>
                <div className="mt-3 max-h-[360px] space-y-2 overflow-auto pe-1">
                  {selectedRequest.auditTrail
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
                            {t.audit.fromTo}:{" "}
                            {event.fromStatus ? t.status[event.fromStatus] : "-"}
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
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </ErpPageLayout>
  );
}
