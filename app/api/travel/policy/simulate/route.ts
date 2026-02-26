import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { evaluateTravelPolicy } from "@/modules/travel/policy/travel-policy-engine";
import type { EmployeeGrade, TravelClass, TripType } from "@/modules/travel/types";
import { requireApiPermission } from "@/services/auth/api-guards";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { getActiveTravelPolicy, getTravelPolicyVersion } from "@/services/travel-policy-store";

interface PolicySimulationBody {
  employeeGrade?: EmployeeGrade;
  tripType?: TripType;
  departureDate?: string;
  returnDate?: string;
  travelClass?: TravelClass;
  estimatedCost?: number;
  currency?: string;
  policyVersionId?: string;
}

const VALID_GRADES = new Set<EmployeeGrade>(["staff", "manager", "director", "executive"]);
const VALID_TRIP_TYPES = new Set<TripType>(["domestic", "international"]);
const VALID_CLASSES = new Set<TravelClass>([
  "economy",
  "premium_economy",
  "business",
  "first",
]);

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("travel.view");
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = await parseJsonBodySafe<PolicySimulationBody>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  if (!body.employeeGrade || !VALID_GRADES.has(body.employeeGrade)) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "employeeGrade is invalid.",
      },
      { status: 422 },
    );
  }
  if (!body.tripType || !VALID_TRIP_TYPES.has(body.tripType)) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "tripType is invalid.",
      },
      { status: 422 },
    );
  }
  if (!body.travelClass || !VALID_CLASSES.has(body.travelClass)) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "travelClass is invalid.",
      },
      { status: 422 },
    );
  }
  if (
    typeof body.estimatedCost !== "number" ||
    !Number.isFinite(body.estimatedCost) ||
    body.estimatedCost <= 0
  ) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "estimatedCost must be greater than zero.",
      },
      { status: 422 },
    );
  }
  if (!body.departureDate || !body.returnDate) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "departureDate and returnDate are required.",
      },
      { status: 422 },
    );
  }

  const resolvedPolicy = isNonEmptyText(body.policyVersionId)
    ? (await getTravelPolicyVersion(body.policyVersionId))?.config
    : await getActiveTravelPolicy();
  if (!resolvedPolicy) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "policyVersionId is invalid.",
      },
      { status: 422 },
    );
  }

  const evaluation = evaluateTravelPolicy({
    employeeGrade: body.employeeGrade,
    tripType: body.tripType,
    departureDate: body.departureDate,
    returnDate: body.returnDate,
    travelClass: body.travelClass,
    estimatedCost: body.estimatedCost,
    currency: body.currency ?? "SAR",
  }, resolvedPolicy);

  return NextResponse.json(evaluation, { status: 200 });
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
