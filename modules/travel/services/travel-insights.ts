import type { TravelAuditEvent, TravelRequest, TravelRequestStatus } from "@/modules/travel/types";

export interface TravelSlaAlert {
  requestId: string;
  status: TravelRequestStatus;
  employeeName: string;
  costCenter: string;
  elapsedHours: number;
  targetHours: number;
  exceededHours: number;
}

export interface CostCenterRiskRow {
  costCenter: string;
  requests: number;
  totalEstimatedCost: number;
  budgetCap: number;
  utilizationRatio: number;
  riskLevel: "low" | "medium" | "high";
}

export interface TravelInsights {
  generatedAt: string;
  totalRequests: number;
  bookedRequests: number;
  complianceRate: number;
  blockedPolicyRate: number;
  averageLeadTimeDays: number;
  averageApprovalCycleHours: number;
  slaBreaches: TravelSlaAlert[];
  budgetRisks: CostCenterRiskRow[];
}

const DEFAULT_BUDGET_CAP_BY_COST_CENTER: Record<string, number> = {
  "CC-SALES-001": 25000,
  "CC-OPS-009": 32000,
  "CC-CUST-014": 20000,
  "CC-FIN-002": 60000,
  "CC-MKT-005": 40000,
  "CC-STR-003": 50000,
  "CC-SUP-011": 18000,
  "CC-HR-004": 30000,
  "CC-IT-013": 45000,
  "CC-SALES-017": 25000,
};

const SLA_TARGET_BY_STATUS: Partial<Record<TravelRequestStatus, number>> = {
  submitted: 12,
  manager_approved: 16,
  travel_review: 18,
  finance_approved: 8,
};

function hoursBetween(start: string, end: string): number {
  const left = new Date(start).getTime();
  const right = new Date(end).getTime();
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return 0;
  }
  return Math.max(0, (right - left) / (1000 * 60 * 60));
}

function daysBetween(start: string, end: string): number {
  return hoursBetween(start, end) / 24;
}

function findEventAt(events: TravelAuditEvent[], action: string): string | null {
  const match = events.find((event) => event.action === action);
  return match?.at ?? null;
}

function safeAverage(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function getBudgetCap(costCenter: string): number {
  if (DEFAULT_BUDGET_CAP_BY_COST_CENTER[costCenter]) {
    return DEFAULT_BUDGET_CAP_BY_COST_CENTER[costCenter];
  }
  return 30000;
}

export function buildTravelInsights(requests: TravelRequest[], now: Date = new Date()): TravelInsights {
  const totalRequests = requests.length;
  const bookedRequests = requests.filter(
    (request) => request.status === "booked" || request.status === "closed",
  ).length;
  const compliantCount = requests.filter(
    (request) => request.policyEvaluation.level === "compliant",
  ).length;
  const blockedCount = requests.filter(
    (request) => request.policyEvaluation.level === "blocked",
  ).length;

  const leadTimes = requests.map((request) =>
    daysBetween(request.createdAt, request.departureDate),
  );

  const approvalCycles = requests
    .filter((request) => request.status === "booked")
    .map((request) => {
      const submitAt = findEventAt(request.auditTrail, "submit_request");
      const bookedAt = findEventAt(request.auditTrail, "confirm_booking");
      if (!submitAt || !bookedAt) {
        return 0;
      }
      return hoursBetween(submitAt, bookedAt);
    })
    .filter((value) => value > 0);

  const slaBreaches: TravelSlaAlert[] = requests
    .filter(
      (request) =>
        !["booked", "closed", "rejected", "cancelled", "draft"].includes(request.status),
    )
    .map((request) => {
      const targetHours = SLA_TARGET_BY_STATUS[request.status];
      if (!targetHours) {
        return null;
      }
      const elapsedHours = hoursBetween(request.updatedAt, now.toISOString());
      if (elapsedHours <= targetHours) {
        return null;
      }
      return {
        requestId: request.id,
        status: request.status,
        employeeName: request.employeeName,
        costCenter: request.costCenter,
        elapsedHours: round(elapsedHours),
        targetHours,
        exceededHours: round(elapsedHours - targetHours),
      } satisfies TravelSlaAlert;
    })
    .filter((item): item is TravelSlaAlert => item !== null)
    .sort((left, right) => right.exceededHours - left.exceededHours);

  const budgetMap = new Map<
    string,
    {
      requests: number;
      totalEstimatedCost: number;
    }
  >();

  requests.forEach((request) => {
    if (request.status === "rejected" || request.status === "cancelled") {
      return;
    }
    const current = budgetMap.get(request.costCenter) ?? {
      requests: 0,
      totalEstimatedCost: 0,
    };
    current.requests += 1;
    current.totalEstimatedCost += request.estimatedCost;
    budgetMap.set(request.costCenter, current);
  });

  const budgetRisks: CostCenterRiskRow[] = Array.from(budgetMap.entries())
    .map(([costCenter, data]) => {
      const budgetCap = getBudgetCap(costCenter);
      const utilizationRatio = budgetCap > 0 ? data.totalEstimatedCost / budgetCap : 0;
      const riskLevel: CostCenterRiskRow["riskLevel"] =
        utilizationRatio >= 1 ? "high" : utilizationRatio >= 0.8 ? "medium" : "low";
      return {
        costCenter,
        requests: data.requests,
        totalEstimatedCost: round(data.totalEstimatedCost),
        budgetCap,
        utilizationRatio: round(utilizationRatio),
        riskLevel,
      };
    })
    .sort((left, right) => right.utilizationRatio - left.utilizationRatio);

  return {
    generatedAt: now.toISOString(),
    totalRequests,
    bookedRequests,
    complianceRate: totalRequests ? round((compliantCount / totalRequests) * 100) : 0,
    blockedPolicyRate: totalRequests ? round((blockedCount / totalRequests) * 100) : 0,
    averageLeadTimeDays: round(safeAverage(leadTimes)),
    averageApprovalCycleHours: round(safeAverage(approvalCycles)),
    slaBreaches,
    budgetRisks,
  };
}
