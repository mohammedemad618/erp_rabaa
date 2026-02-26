export type TravelActorRole =
  | "employee"
  | "manager"
  | "travel_desk"
  | "finance"
  | "admin"
  | "agent";

export type EmployeeGrade = "staff" | "manager" | "director" | "executive";

export type TripType = "domestic" | "international";

export type TravelClass = "economy" | "premium_economy" | "business" | "first";

export type TravelRequestStatus =
  | "draft"
  | "submitted"
  | "manager_approved"
  | "travel_review"
  | "finance_approved"
  | "booked"
  | "closed"
  | "rejected"
  | "cancelled";

export type ApprovalStepStatus = "waiting" | "pending" | "approved" | "rejected" | "skipped";

export interface TravelApprovalStep {
  id: string;
  role: TravelActorRole;
  status: ApprovalStepStatus;
  actorName?: string;
  actedAt?: string;
  note?: string;
}

export type PolicyFindingLevel = "info" | "warning" | "blocked";

export type PolicyComplianceLevel = "compliant" | "warning" | "blocked";

export interface PolicyFinding {
  code: string;
  level: PolicyFindingLevel;
  message: string;
  context?: string;
}

export interface TravelPolicyEvaluation {
  policyVersion: string;
  level: PolicyComplianceLevel;
  findings: PolicyFinding[];
  evaluatedAt: string;
}

export interface TravelAuditEvent {
  id: string;
  at: string;
  actorRole: TravelActorRole;
  actorName: string;
  action: string;
  fromStatus: TravelRequestStatus | null;
  toStatus: TravelRequestStatus;
  note?: string;
}

export interface TravelBookingRecord {
  vendor: string;
  bookingReference: string;
  ticketNumber?: string;
  bookedAt: string;
  totalBookedCost: number;
  currency: string;
  bookedBy: string;
}

export type TravelExpenseCategory =
  | "flight"
  | "hotel"
  | "ground_transport"
  | "meals"
  | "visa"
  | "other";

export type TravelExpenseStatus = "submitted" | "approved" | "rejected";

export interface TravelExpenseReceipt {
  fileName: string;
  mimeType: string;
  sizeInBytes: number;
  uploadedAt: string;
}

export interface TravelExpenseClaim {
  id: string;
  category: TravelExpenseCategory;
  amount: number;
  currency: string;
  expenseDate: string;
  merchant: string;
  description: string;
  status: TravelExpenseStatus;
  submittedBy: string;
  submittedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  syncedAt?: string;
  syncedBatchId?: string;
  receipt: TravelExpenseReceipt;
}

export type TravelFinanceSyncStatus = "not_synced" | "pending" | "succeeded" | "failed";

export interface TravelLedgerLine {
  id: string;
  expenseId: string;
  glAccount: string;
  costCenter: string;
  amount: number;
  currency: string;
  memo: string;
}

export interface TravelFinanceSyncState {
  status: TravelFinanceSyncStatus;
  attemptCount: number;
  lastAttemptAt?: string;
  lastError?: string;
  lastBatchId?: string;
  ledgerLines: TravelLedgerLine[];
}

export type TravelClosureCheckCode =
  | "trip_completed"
  | "booking_recorded"
  | "expenses_reviewed"
  | "approved_expenses_synced"
  | "finance_sync_not_failed";

export interface TravelClosureReadinessCheck {
  code: TravelClosureCheckCode;
  passed: boolean;
  message: string;
}

export interface TravelClosureReadiness {
  checkedAt: string;
  ready: boolean;
  requiresFinanceSync: boolean;
  pendingExpenses: number;
  approvedExpenses: number;
  approvedUnsyncedExpenses: number;
  rejectedExpenses: number;
  totalExpenses: number;
  totalApprovedAmount: number;
  totalApprovedSyncedAmount: number;
  financeSyncStatus: TravelFinanceSyncStatus;
  checks: TravelClosureReadinessCheck[];
}

export interface TravelTripClosureRecord {
  closedAt: string;
  closedBy: string;
  closureNote?: string;
  totalExpenses: number;
  totalApprovedAmount: number;
  totalSettledAmount: number;
  varianceFromBookedCost: number;
  varianceFromEstimatedCost: number;
  financeBatchId?: string;
  financeAttemptCount: number;
}

export interface TravelRequest {
  id: string;
  customerId?: string;
  linkedServiceBookings: string[];
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
  baseEstimatedCost?: number;
  additionalServicesCost?: number;
  estimatedCost: number;
  currency: string;
  status: TravelRequestStatus;
  approvalRoute: TravelApprovalStep[];
  policyEvaluation: TravelPolicyEvaluation;
  booking: TravelBookingRecord | null;
  expenses: TravelExpenseClaim[];
  financeSync: TravelFinanceSyncState;
  closure: TravelTripClosureRecord | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
  version: number;
  auditTrail: TravelAuditEvent[];
}

export interface TravelActorContext {
  actorRole: TravelActorRole;
  actorName: string;
}



export interface CreateTravelRequestInput {
  customerId?: string;
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
  baseEstimatedCost?: number;
  additionalServicesCost?: number;
  estimatedCost: number;
  currency: string;
  linkedServiceBookingIds?: string[];
  serviceCostOverrides?: Record<string, number>;
}

export interface BookingFormState {
  vendor: string;
  bookingReference: string;
  ticketNumber: string;
  bookedAt: string;
  totalBookedCost: string | number;
  currency: string;
}

export interface ExpenseFormState {
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
