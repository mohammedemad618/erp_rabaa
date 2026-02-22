import type {
  ApprovalStepStatus,
  EmployeeGrade,
  PolicyComplianceLevel,
  PolicyFindingLevel,
  TravelActorRole,
  TravelClass,
  TravelRequestStatus,
  TripType,
} from "@/modules/travel/types";
import type {
  TravelTransitionBlockReason,
  TravelTransitionId,
} from "@/modules/travel/workflow/travel-approval-engine";

type SupportedLocale = "en" | "ar";

export interface TravelDictionary {
  title: string;
  subtitle: string;
  notices: {
    created: string;
    actionCompleted: string;
    autoApproved: string;
    exportReady: string;
    validationFailed: string;
  };
  labels: {
    actingRole: string;
    actingName: string;
    signedInAs: string;
    currentRole: string;
    sessionUnavailable: string;
    search: string;
    status: string;
    allStatuses: string;
    actionNote: string;
    actionNotePlaceholder: string;
    submitDraft: string;
    createRequest: string;
    requestDetails: string;
    policyEvaluation: string;
    availableActions: string;
    approvalRoute: string;
    auditTrail: string;
    noSelection: string;
    noRows: string;
    noActions: string;
    refresh: string;
    autoApprove: string;
    exportAudit: string;
    insightsTitle: string;
    insightsSubtitle: string;
    complianceRate: string;
    blockedRate: string;
    avgLeadTime: string;
    avgApprovalCycle: string;
    slaBreaches: string;
    budgetRisks: string;
    simulatePolicy: string;
    runSimulation: string;
    simulationResult: string;
    noSlaBreaches: string;
    noBudgetRisks: string;
  };
  filters: {
    searchPlaceholder: string;
  };
  table: {
    id: string;
    employee: string;
    trip: string;
    departure: string;
    amount: string;
    status: string;
    updatedAt: string;
    elapsed: string;
    exceeded: string;
    utilization: string;
    riskLevel: string;
  };
  form: {
    employeeName: string;
    employeeEmail: string;
    employeeGrade: string;
    department: string;
    costCenter: string;
    tripType: string;
    origin: string;
    destination: string;
    departureDate: string;
    returnDate: string;
    purpose: string;
    travelClass: string;
    estimatedCost: string;
    currency: string;
  };
  kpi: {
    total: string;
    pending: string;
    blocked: string;
    booked: string;
  };
  route: {
    role: string;
    status: string;
    actor: string;
    at: string;
  };
  audit: {
    action: string;
    actor: string;
    fromTo: string;
    note: string;
  };
  status: Record<TravelRequestStatus, string>;
  roles: Record<TravelActorRole, string>;
  transition: Record<TravelTransitionId, string>;
  transitionReason: Record<TravelTransitionBlockReason, string>;
  grade: Record<EmployeeGrade, string>;
  tripType: Record<TripType, string>;
  travelClass: Record<TravelClass, string>;
  approvalStatus: Record<ApprovalStepStatus, string>;
  policyLevel: Record<PolicyComplianceLevel, string>;
  findingLevel: Record<PolicyFindingLevel, string>;
  riskLevel: Record<"low" | "medium" | "high", string>;
  units: {
    days: string;
    hours: string;
    percent: string;
  };
}

const dictionary: Record<SupportedLocale, TravelDictionary> = {
  en: {
    title: "Travel Request Hub",
    subtitle:
      "Professional travel workflow with policy checks, role-based approvals, and full audit history.",
    notices: {
      created: "Travel request draft created successfully.",
      actionCompleted: "Workflow action completed successfully.",
      autoApproved: "Auto-approval executed for eligible low-risk requests.",
      exportReady: "Audit report exported successfully.",
      validationFailed: "Please complete all required fields correctly.",
    },
    labels: {
      actingRole: "Acting role",
      actingName: "Acting name",
      signedInAs: "Signed in as",
      currentRole: "Current role",
      sessionUnavailable: "Session data unavailable. Please sign in again.",
      search: "Search",
      status: "Status",
      allStatuses: "All statuses",
      actionNote: "Action note",
      actionNotePlaceholder: "Required for reject/cancel actions.",
      submitDraft: "Create draft request",
      createRequest: "Create Request",
      requestDetails: "Request Details",
      policyEvaluation: "Policy Evaluation",
      availableActions: "Available Actions",
      approvalRoute: "Approval Route",
      auditTrail: "Audit Trail",
      noSelection: "Select a request to view details.",
      noRows: "No travel requests found for current filters.",
      noActions: "No workflow actions available for this role and state.",
      refresh: "Refresh",
      autoApprove: "Auto-Approve Low Risk",
      exportAudit: "Export Audit CSV",
      insightsTitle: "Executive Insights",
      insightsSubtitle:
        "Live operational and financial indicators for travel workflow performance.",
      complianceRate: "Compliance Rate",
      blockedRate: "Blocked Policy Rate",
      avgLeadTime: "Average Lead Time",
      avgApprovalCycle: "Average Approval Cycle",
      slaBreaches: "SLA Breaches",
      budgetRisks: "Budget Risks",
      simulatePolicy: "Policy Simulator",
      runSimulation: "Run Simulation",
      simulationResult: "Simulation Result",
      noSlaBreaches: "No active SLA breaches.",
      noBudgetRisks: "No active budget risks.",
    },
    filters: {
      searchPlaceholder: "Search by ID, employee, destination, or cost center",
    },
    table: {
      id: "ID",
      employee: "Employee",
      trip: "Trip",
      departure: "Departure",
      amount: "Amount",
      status: "Status",
      updatedAt: "Updated",
      elapsed: "Elapsed",
      exceeded: "Exceeded",
      utilization: "Utilization",
      riskLevel: "Risk Level",
    },
    form: {
      employeeName: "Employee name",
      employeeEmail: "Employee email",
      employeeGrade: "Employee grade",
      department: "Department",
      costCenter: "Cost center",
      tripType: "Trip type",
      origin: "Origin",
      destination: "Destination",
      departureDate: "Departure date",
      returnDate: "Return date",
      purpose: "Purpose",
      travelClass: "Travel class",
      estimatedCost: "Estimated cost",
      currency: "Currency",
    },
    kpi: {
      total: "Total Requests",
      pending: "Pending Workflow",
      blocked: "Policy Blocked",
      booked: "Booked/Closed",
    },
    route: {
      role: "Role",
      status: "Status",
      actor: "Actor",
      at: "At",
    },
    audit: {
      action: "Action",
      actor: "Actor",
      fromTo: "From -> To",
      note: "Note",
    },
    status: {
      draft: "Draft",
      submitted: "Submitted",
      manager_approved: "Manager Approved",
      travel_review: "Travel Desk Review",
      finance_approved: "Finance Approved",
      booked: "Booked",
      closed: "Closed",
      rejected: "Rejected",
      cancelled: "Cancelled",
    },
    roles: {
      employee: "Employee",
      manager: "Manager",
      travel_desk: "Travel Desk",
      finance: "Finance",
      admin: "Admin",
    },
    transition: {
      submit_request: "Submit Request",
      approve_manager: "Manager Approve",
      reject_manager: "Manager Reject",
      start_travel_review: "Complete Travel Desk Review",
      approve_finance: "Finance Approve",
      reject_finance: "Finance Reject",
      confirm_booking: "Confirm Booking",
      close_trip: "Close Trip",
      cancel_request: "Cancel Request",
    },
    transitionReason: {
      role_not_allowed: "Your current role cannot execute this action.",
      state_not_allowed: "Action is not valid for the current request status.",
      policy_blocked: "Policy violations must be resolved before submission.",
      trip_not_completed: "Trip cannot be closed before the return date.",
      booking_not_recorded: "Booking details must be recorded before closing.",
      expenses_pending: "All pending expense claims must be reviewed before closing.",
      finance_sync_incomplete: "Approved expenses must be synced before closing.",
    },
    grade: {
      staff: "Staff",
      manager: "Manager",
      director: "Director",
      executive: "Executive",
    },
    tripType: {
      domestic: "Domestic",
      international: "International",
    },
    travelClass: {
      economy: "Economy",
      premium_economy: "Premium Economy",
      business: "Business",
      first: "First",
    },
    approvalStatus: {
      waiting: "Waiting",
      pending: "Pending",
      approved: "Approved",
      rejected: "Rejected",
      skipped: "Skipped",
    },
    policyLevel: {
      compliant: "Compliant",
      warning: "Warning",
      blocked: "Blocked",
    },
    findingLevel: {
      info: "Info",
      warning: "Warning",
      blocked: "Blocked",
    },
    riskLevel: {
      low: "Low",
      medium: "Medium",
      high: "High",
    },
    units: {
      days: "days",
      hours: "hours",
      percent: "%",
    },
  },
  ar: {
    title: "مركز طلبات السفر",
    subtitle: "سير عمل احترافي لطلبات السفر مع فحص السياسات والموافقات وسجل تدقيق كامل.",
    notices: {
      created: "تم إنشاء مسودة طلب السفر بنجاح.",
      actionCompleted: "تم تنفيذ الإجراء بنجاح.",
      autoApproved: "تم تنفيذ الاعتماد التلقائي للطلبات منخفضة المخاطر.",
      exportReady: "تم تصدير تقرير التدقيق بنجاح.",
      validationFailed: "يرجى إكمال جميع الحقول المطلوبة بشكل صحيح.",
    },
    labels: {
      actingRole: "الدور الحالي",
      actingName: "اسم المنفذ",
      signedInAs: "المستخدم الحالي",
      currentRole: "الدور الحالي",
      sessionUnavailable: "لا يمكن قراءة الجلسة الحالية. يرجى تسجيل الدخول مرة أخرى.",
      search: "بحث",
      status: "الحالة",
      allStatuses: "كل الحالات",
      actionNote: "ملاحظة الإجراء",
      actionNotePlaceholder: "مطلوبة في حالات الرفض أو الإلغاء.",
      submitDraft: "إنشاء مسودة طلب",
      createRequest: "إنشاء طلب",
      requestDetails: "تفاصيل الطلب",
      policyEvaluation: "تقييم السياسة",
      availableActions: "الإجراءات المتاحة",
      approvalRoute: "مسار الموافقات",
      auditTrail: "سجل التدقيق",
      noSelection: "اختر طلبًا لعرض التفاصيل.",
      noRows: "لا توجد طلبات سفر مطابقة للمرشحات الحالية.",
      noActions: "لا توجد إجراءات متاحة لهذا الدور في الحالة الحالية.",
      refresh: "تحديث",
      autoApprove: "اعتماد تلقائي منخفض المخاطر",
      exportAudit: "تصدير تقرير التدقيق CSV",
      insightsTitle: "المؤشرات التنفيذية",
      insightsSubtitle: "مؤشرات تشغيلية ومالية لحظية لأداء سير عمل السفر.",
      complianceRate: "نسبة الالتزام",
      blockedRate: "نسبة الإيقاف بالسياسة",
      avgLeadTime: "متوسط مهلة الحجز",
      avgApprovalCycle: "متوسط دورة الموافقة",
      slaBreaches: "تجاوزات SLA",
      budgetRisks: "مخاطر الميزانية",
      simulatePolicy: "محاكي السياسة",
      runSimulation: "تشغيل المحاكاة",
      simulationResult: "نتيجة المحاكاة",
      noSlaBreaches: "لا توجد تجاوزات SLA حالية.",
      noBudgetRisks: "لا توجد مخاطر ميزانية حالية.",
    },
    filters: {
      searchPlaceholder: "ابحث بالرقم أو الموظف أو الوجهة أو مركز التكلفة",
    },
    table: {
      id: "الرقم",
      employee: "الموظف",
      trip: "الرحلة",
      departure: "المغادرة",
      amount: "المبلغ",
      status: "الحالة",
      updatedAt: "آخر تحديث",
      elapsed: "المنقضي",
      exceeded: "التجاوز",
      utilization: "نسبة الاستخدام",
      riskLevel: "مستوى المخاطر",
    },
    form: {
      employeeName: "اسم الموظف",
      employeeEmail: "بريد الموظف",
      employeeGrade: "الدرجة الوظيفية",
      department: "الإدارة",
      costCenter: "مركز التكلفة",
      tripType: "نوع الرحلة",
      origin: "من",
      destination: "إلى",
      departureDate: "تاريخ المغادرة",
      returnDate: "تاريخ العودة",
      purpose: "سبب السفر",
      travelClass: "درجة السفر",
      estimatedCost: "التكلفة التقديرية",
      currency: "العملة",
    },
    kpi: {
      total: "إجمالي الطلبات",
      pending: "طلبات قيد الإجراء",
      blocked: "طلبات موقوفة بالسياسة",
      booked: "محجوز/مغلق",
    },
    route: {
      role: "الدور",
      status: "الحالة",
      actor: "المنفذ",
      at: "التاريخ",
    },
    audit: {
      action: "الإجراء",
      actor: "المنفذ",
      fromTo: "من -> إلى",
      note: "ملاحظة",
    },
    status: {
      draft: "مسودة",
      submitted: "مرسل",
      manager_approved: "اعتماد المدير",
      travel_review: "مراجعة السفر",
      finance_approved: "اعتماد المالية",
      booked: "محجوز",
      closed: "مغلق",
      rejected: "مرفوض",
      cancelled: "ملغي",
    },
    roles: {
      employee: "موظف",
      manager: "مدير",
      travel_desk: "مكتب السفر",
      finance: "المالية",
      admin: "مدير النظام",
    },
    transition: {
      submit_request: "إرسال الطلب",
      approve_manager: "اعتماد المدير",
      reject_manager: "رفض المدير",
      start_travel_review: "إكمال مراجعة مكتب السفر",
      approve_finance: "اعتماد المالية",
      reject_finance: "رفض المالية",
      confirm_booking: "تأكيد الحجز",
      close_trip: "إغلاق الرحلة",
      cancel_request: "إلغاء الطلب",
    },
    transitionReason: {
      role_not_allowed: "الدور الحالي غير مخول لتنفيذ هذا الإجراء.",
      state_not_allowed: "الإجراء غير متاح في الحالة الحالية للطلب.",
      policy_blocked: "يجب معالجة مخالفات السياسة قبل إرسال الطلب.",
      trip_not_completed: "تعذر إغلاق الرحلة قبل تاريخ العودة.",
      booking_not_recorded: "يجب تسجيل بيانات الحجز قبل إغلاق الرحلة.",
      expenses_pending: "يجب مراجعة جميع مطالبات المصروفات المعلقة قبل الإغلاق.",
      finance_sync_incomplete: "يجب مزامنة المصروفات المعتمدة قبل الإغلاق.",
    },
    grade: {
      staff: "موظف",
      manager: "مدير",
      director: "مدير عام",
      executive: "تنفيذي",
    },
    tripType: {
      domestic: "داخلية",
      international: "دولية",
    },
    travelClass: {
      economy: "اقتصادية",
      premium_economy: "اقتصادية مميزة",
      business: "أعمال",
      first: "أولى",
    },
    approvalStatus: {
      waiting: "بانتظار البدء",
      pending: "قيد الانتظار",
      approved: "مقبول",
      rejected: "مرفوض",
      skipped: "تم التخطي",
    },
    policyLevel: {
      compliant: "متوافق",
      warning: "تحذير",
      blocked: "موقوف",
    },
    findingLevel: {
      info: "معلومة",
      warning: "تحذير",
      blocked: "موقوف",
    },
    riskLevel: {
      low: "منخفض",
      medium: "متوسط",
      high: "مرتفع",
    },
    units: {
      days: "يوم",
      hours: "ساعة",
      percent: "%",
    },
  },
};

export function getTravelDictionary(locale: string): TravelDictionary {
  return locale === "ar" ? dictionary.ar : dictionary.en;
}
