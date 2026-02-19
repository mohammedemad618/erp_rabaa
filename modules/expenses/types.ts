export type Department =
  | "sales"
  | "operations"
  | "finance"
  | "it"
  | "hr";

export type ExpenseStatus =
  | "draft"
  | "pending_manager"
  | "pending_finance"
  | "approved"
  | "rejected";

export interface ExpenseRouteStep {
  id: string;
  role: string;
  actor: string;
  status: "pending" | "approved" | "rejected";
  at?: string;
  note?: string;
}

export interface CostCenter {
  id: string;
  name: string;
  department: Department;
  budget: number;
  spent: number;
}

export interface ExpenseRecord {
  id: string;
  date: string;
  department: Department;
  costCenterId: string;
  costCenterName: string;
  category: string;
  description: string;
  vendor: string;
  employee: string;
  amount: number;
  currency: string;
  status: ExpenseStatus;
  paymentMethod: "cash" | "card" | "bank";
  approvalRoute: ExpenseRouteStep[];
  linkedTransactionId?: string;
}

export interface ExpenseDataset {
  expenses: ExpenseRecord[];
  costCenters: CostCenter[];
  departments: Department[];
  categories: string[];
}
