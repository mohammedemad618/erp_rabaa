import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { CreateTravelRequestInput } from "@/modules/travel/types";
import { requireApiPermission } from "@/services/auth/api-guards";
import { mapEnterpriseRoleToTravelActorRole } from "@/services/auth/role-mapping";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { createTravelRequest, listTravelRequests } from "@/services/travel-request-store";

type CreateTravelRequestBody = CreateTravelRequestInput;

export async function GET() {
  const guard = await requireApiPermission("travel.view");
  if (!guard.ok) {
    return guard.response;
  }
  return NextResponse.json(listTravelRequests(), { status: 200 });
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("travel.create");
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = await parseJsonBodySafe<CreateTravelRequestBody>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  const actorRole = mapEnterpriseRoleToTravelActorRole(guard.user.role);
  if (!actorRole) {
    return NextResponse.json(
      {
        code: "forbidden",
        message: "Your role is not allowed to create travel requests.",
      },
      { status: 403 },
    );
  }

  const result = createTravelRequest({
    employeeName: body.employeeName,
    employeeEmail: body.employeeEmail,
    employeeGrade: body.employeeGrade,
    department: body.department,
    costCenter: body.costCenter,
    tripType: body.tripType,
    origin: body.origin,
    destination: body.destination,
    departureDate: body.departureDate,
    returnDate: body.returnDate,
    purpose: body.purpose,
    travelClass: body.travelClass,
    estimatedCost: body.estimatedCost,
    currency: body.currency,
    actorRole,
    actorName: guard.user.name,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        code: result.error.code,
        message: result.error.message,
      },
      { status: 422 },
    );
  }

  return NextResponse.json(result.result, { status: 201 });
}
