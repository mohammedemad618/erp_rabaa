import type { Transaction } from "@/modules/transactions/types";
import type {
  CostCenter,
  Department,
  ExpenseDataset,
  ExpenseRecord,
  ExpenseStatus,
  ExpenseRouteStep,
} from "../types";

const BASE_COST_CENTERS: Array<Omit<CostCenter, "spent">> = [
  {
    id: "CC-SALES-001",
    name: "Sales Incentives",
    department: "sales",
    budget: 90000,
  },
  {
    id: "CC-SALES-002",
    name: "Marketing Campaigns",
    department: "sales",
    budget: 120000,
  },
  {
    id: "CC-OPS-001",
    name: "Operations Support",
    department: "operations",
    budget: 150000,
  },
  {
    id: "CC-OPS-002",
    name: "Branch Logistics",
    department: "operations",
    budget: 110000,
  },
  {
    id: "CC-FIN-001",
    name: "Finance Controls",
    department: "finance",
    budget: 80000,
  },
  {
    id: "CC-IT-001",
    name: "IT Infrastructure",
    department: "it",
    budget: 170000,
  },
  {
    id: "CC-HR-001",
    name: "Training & HR",
    department: "hr",
    budget: 95000,
  },
];

const CATEGORIES = [
  "Office Supplies",
  "Branch Utilities",
  "Software Licenses",
  "Vendor Service",
  "Travel Allowance",
  "Training",
  "Maintenance",
];

const VENDORS = [
  "Saudi Telecom",
  "Oracle Services",
  "AlFaisaliah Supplies",
  "TravelCom Vendor",
  "CloudPoint Systems",
  "Arabian Utilities",
];

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function statusFromSeed(seed: number): ExpenseStatus {
  if (seed % 11 === 0) {
    return "rejected";
  }
  if (seed % 7 === 0) {
    return "pending_manager";
  }
  if (seed % 5 === 0) {
    return "pending_finance";
  }
  if (seed % 13 === 0) {
    return "draft";
  }
  return "approved";
}

function routeByStatus(
  status: ExpenseStatus,
  employee: string,
  date: string,
): ExpenseRouteStep[] {
  const managerApproved =
    status === "pending_finance" || status === "approved" || status === "rejected";
  const financeApproved = status === "approved";
  const financeRejected = status === "rejected";

  return [
    {
      id: "rt-1",
      role: "Requester",
      actor: employee,
      status: "approved",
      at: date,
      note: "Expense submitted",
    },
    {
      id: "rt-2",
      role: "Department Manager",
      actor: "Department Manager",
      status: managerApproved ? "approved" : "pending",
      at: managerApproved ? date : undefined,
      note: managerApproved ? "Policy check completed" : "Waiting for manager review",
    },
    {
      id: "rt-3",
      role: "Finance Controller",
      actor: "Finance Controller",
      status: financeApproved ? "approved" : financeRejected ? "rejected" : "pending",
      at: financeApproved || financeRejected ? date : undefined,
      note:
        financeApproved
          ? "Payment authorized"
          : financeRejected
            ? "Rejected due to non-compliance"
            : "Awaiting finance validation",
    },
  ];
}

function departmentFromAgent(agent: string): Department {
  const seed = hashString(agent) % 5;
  if (seed === 0) {
    return "sales";
  }
  if (seed === 1) {
    return "operations";
  }
  if (seed === 2) {
    return "finance";
  }
  if (seed === 3) {
    return "it";
  }
  return "hr";
}

function paymentMethodFromSeed(seed: number): "cash" | "card" | "bank" {
  const mode = seed % 3;
  if (mode === 0) {
    return "cash";
  }
  if (mode === 1) {
    return "card";
  }
  return "bank";
}

export function buildExpenseDataset(transactions: Transaction[]): ExpenseDataset {
  const expenses: ExpenseRecord[] = [];
  let counter = 1;

  for (let index = 0; index < transactions.length; index += 2) {
    const transaction = transactions[index];
    if (!transaction) {
      continue;
    }

    const department = departmentFromAgent(transaction.agent);
    const candidateCostCenters = BASE_COST_CENTERS.filter(
      (center) => center.department === department,
    );
    const costCenter = candidateCostCenters[index % candidateCostCenters.length];
    if (!costCenter) {
      continue;
    }

    const seed = hashString(transaction.id);
    const status = statusFromSeed(seed);
    const amount = roundMoney(
      180 + (transaction.totalAmount * ((seed % 23) + 8)) / 100,
    );
    const category = CATEGORIES[seed % CATEGORIES.length];
    const vendor = VENDORS[seed % VENDORS.length];

    expenses.push({
      id: `EXP-${counter.toString().padStart(6, "0")}`,
      date: transaction.createdAt,
      department,
      costCenterId: costCenter.id,
      costCenterName: costCenter.name,
      category,
      description: `${category} for ${transaction.branch}`,
      vendor,
      employee: transaction.agent,
      amount,
      currency: transaction.currency,
      status,
      paymentMethod: paymentMethodFromSeed(seed),
      approvalRoute: routeByStatus(status, transaction.agent, transaction.createdAt),
      linkedTransactionId: transaction.id,
    });
    counter += 1;
  }

  const spentByCostCenter = new Map<string, number>();
  for (const expense of expenses) {
    if (expense.status === "rejected") {
      continue;
    }
    spentByCostCenter.set(
      expense.costCenterId,
      roundMoney((spentByCostCenter.get(expense.costCenterId) ?? 0) + expense.amount),
    );
  }

  const costCenters: CostCenter[] = BASE_COST_CENTERS.map((center) => ({
    ...center,
    spent: spentByCostCenter.get(center.id) ?? 0,
  }));

  const departments = Array.from(
    new Set(BASE_COST_CENTERS.map((center) => center.department)),
  ) as Department[];

  return {
    expenses: expenses.sort((a, b) => b.date.localeCompare(a.date)),
    costCenters,
    departments,
    categories: CATEGORIES,
  };
}
