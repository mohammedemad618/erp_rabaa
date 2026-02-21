import type {
  EmployeeGrade,
  PolicyComplianceLevel,
  PolicyFinding,
  TravelClass,
  TravelPolicyEvaluation,
  TripType,
} from "@/modules/travel/types";

export interface TravelPolicyConfig {
  version: string;
  minAdvanceDaysByTripType: Record<TripType, number>;
  maxBudgetByGrade: Record<EmployeeGrade, number>;
  maxTravelClassByGrade: Record<EmployeeGrade, TravelClass>;
  budgetWarningThreshold: number;
  maxTripLengthDays: number;
}

interface TravelPolicyInput {
  employeeGrade: EmployeeGrade;
  tripType: TripType;
  departureDate: string;
  returnDate: string;
  travelClass: TravelClass;
  estimatedCost: number;
  currency: string;
  now?: Date;
}

const TRAVEL_CLASS_RANK: Record<TravelClass, number> = {
  economy: 1,
  premium_economy: 2,
  business: 3,
  first: 4,
};

export const DEFAULT_TRAVEL_POLICY: TravelPolicyConfig = {
  version: "policy-v1.0.0",
  minAdvanceDaysByTripType: {
    domestic: 2,
    international: 7,
  },
  maxBudgetByGrade: {
    staff: 3500,
    manager: 7500,
    director: 14000,
    executive: 30000,
  },
  maxTravelClassByGrade: {
    staff: "economy",
    manager: "premium_economy",
    director: "business",
    executive: "first",
  },
  budgetWarningThreshold: 0.85,
  maxTripLengthDays: 14,
};

function startOfDay(input: Date): Date {
  const copy = new Date(input);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function differenceInDays(left: Date, right: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = startOfDay(left).getTime() - startOfDay(right).getTime();
  return Math.floor(diff / msPerDay);
}

function maxLevel(findings: PolicyFinding[]): PolicyComplianceLevel {
  if (findings.some((item) => item.level === "blocked")) {
    return "blocked";
  }
  if (findings.some((item) => item.level === "warning")) {
    return "warning";
  }
  return "compliant";
}

export function evaluateTravelPolicy(
  input: TravelPolicyInput,
  policy: TravelPolicyConfig = DEFAULT_TRAVEL_POLICY,
): TravelPolicyEvaluation {
  const now = input.now ?? new Date();
  const findings: PolicyFinding[] = [];
  const departure = new Date(input.departureDate);
  const returnDate = new Date(input.returnDate);

  if (Number.isNaN(departure.getTime()) || Number.isNaN(returnDate.getTime())) {
    findings.push({
      code: "invalid_dates",
      level: "blocked",
      message: "Departure and return dates must be valid.",
    });
  } else {
    const leadDays = differenceInDays(departure, now);
    const minAdvance = policy.minAdvanceDaysByTripType[input.tripType];
    const tripLength = Math.max(0, differenceInDays(returnDate, departure));

    if (leadDays < minAdvance) {
      findings.push({
        code: "insufficient_advance_booking",
        level: "blocked",
        message: `Trip requires at least ${minAdvance} day(s) advance booking.`,
        context: `${leadDays} day(s) provided`,
      });
    }

    if (returnDate < departure) {
      findings.push({
        code: "invalid_trip_window",
        level: "blocked",
        message: "Return date cannot be earlier than departure date.",
      });
    }

    if (tripLength > policy.maxTripLengthDays) {
      findings.push({
        code: "extended_trip_window",
        level: "warning",
        message: `Trip length exceeds ${policy.maxTripLengthDays} days and may require extra justification.`,
        context: `${tripLength} day(s)`,
      });
    }
  }

  const budgetCap = policy.maxBudgetByGrade[input.employeeGrade];
  if (!Number.isFinite(input.estimatedCost) || input.estimatedCost <= 0) {
    findings.push({
      code: "invalid_estimated_cost",
      level: "blocked",
      message: "Estimated cost must be greater than zero.",
    });
  } else if (input.estimatedCost > budgetCap) {
    findings.push({
      code: "budget_cap_exceeded",
      level: "blocked",
      message: `Estimated cost exceeds allowed budget cap for ${input.employeeGrade}.`,
      context: `${input.currency} ${input.estimatedCost.toFixed(2)} / ${budgetCap.toFixed(2)}`,
    });
  } else if (input.estimatedCost / budgetCap >= policy.budgetWarningThreshold) {
    findings.push({
      code: "budget_near_cap",
      level: "warning",
      message: "Estimated cost is close to budget cap.",
      context: `${Math.round((input.estimatedCost / budgetCap) * 100)}% used`,
    });
  }

  const maxClass = policy.maxTravelClassByGrade[input.employeeGrade];
  if (TRAVEL_CLASS_RANK[input.travelClass] > TRAVEL_CLASS_RANK[maxClass]) {
    findings.push({
      code: "travel_class_not_allowed",
      level: "blocked",
      message: `Requested travel class is above allowed class (${maxClass}) for ${input.employeeGrade}.`,
    });
  }

  if (!findings.length) {
    findings.push({
      code: "policy_compliant",
      level: "info",
      message: "Request complies with active travel policy.",
    });
  }

  return {
    policyVersion: policy.version,
    level: maxLevel(findings),
    findings,
    evaluatedAt: now.toISOString(),
  };
}
