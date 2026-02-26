import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import type { CreateTravelRequestInput } from "@/modules/travel/types";
import { getBooking } from "@/modules/services/services-store";
import { requireApiPermission } from "@/services/auth/api-guards";
import { mapEnterpriseRoleToTravelActorRole } from "@/services/auth/role-mapping";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { createTravelRequest, listTravelRequests } from "@/services/travel-request-store";
import { calculateNormalizedTotal } from "@/utils/pricing";

type CreateTravelRequestBody = CreateTravelRequestInput;

export async function GET() {
  try {
    const guard = await requireApiPermission("travel.view");
    if (!guard.ok) {
      return guard.response;
    }
    return NextResponse.json(await listTravelRequests(), { status: 200 });
  } catch (error) {
    console.error("[api/travel/requests][GET] failed", error);
    return NextResponse.json(
      {
        code: "internal_error",
        message: "Unable to list travel requests.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    const requestCurrency =
      typeof body.currency === "string" && body.currency.trim().length > 0
        ? body.currency.trim().toUpperCase()
        : "SAR";
    const baseEstimatedCost =
      typeof body.baseEstimatedCost === "number" &&
        Number.isFinite(body.baseEstimatedCost) &&
        body.baseEstimatedCost > 0
        ? body.baseEstimatedCost
        : typeof body.additionalServicesCost === "number" &&
          Number.isFinite(body.additionalServicesCost) &&
          body.additionalServicesCost >= 0
          ? Math.max(0, body.estimatedCost - body.additionalServicesCost)
          : body.estimatedCost;
    const serviceOverridesRaw =
      body.serviceCostOverrides && typeof body.serviceCostOverrides === "object"
        ? body.serviceCostOverrides
        : {};
    const normalizedServiceOverrides = Object.fromEntries(
      Object.entries(serviceOverridesRaw)
        .filter(([bookingId, amount]) => typeof bookingId === "string" && typeof amount === "number")
        .map(([bookingId, amount]) => [bookingId.trim(), amount as number])
        .filter(([bookingId, amount]) => (bookingId as string).length > 0 && Number.isFinite(amount) && (amount as number) > 0),
    ) as Record<string, number>;
    const linkedServiceBookingIds = Array.isArray(body.linkedServiceBookingIds)
      ? Array.from(
        new Set(
          body.linkedServiceBookingIds
            .filter((id): id is string => typeof id === "string")
            .map((id) => id.trim())
            .filter((id) => id.length > 0),
        ),
      )
      : [];
    const resolvedServiceLines = linkedServiceBookingIds
      .map((bookingId) => {
        const booking = getBooking(bookingId);
        if (!booking) {
          return null;
        }
        return {
          bookingId,
          cost: normalizedServiceOverrides[bookingId] ?? booking.totalAmount,
          currency: booking.currency,
        };
      })
      .filter((line): line is NonNullable<typeof line> => !!line);
    const additionalServicesCost = calculateNormalizedTotal(
      resolvedServiceLines.map((line) => ({
        cost: line.cost,
        currency: line.currency,
      })),
      { targetCurrency: requestCurrency },
    ).total;
    const normalizedBookingIds = resolvedServiceLines.map((line) => line.bookingId);
    const estimatedCost = Math.round((baseEstimatedCost + additionalServicesCost) * 100) / 100;

    const result = await createTravelRequest({
      customerId:
        typeof body.customerId === "string" && body.customerId.trim().length > 0
          ? body.customerId.trim()
          : undefined,
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
      baseEstimatedCost,
      additionalServicesCost,
      estimatedCost,
      currency: requestCurrency,
      linkedServiceBookingIds: normalizedBookingIds,
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

    revalidatePath("/operations");
    revalidatePath("/travel");

    return NextResponse.json(result.result, { status: 201 });
  } catch (error) {
    console.error("[api/travel/requests][POST] failed", error);
    return NextResponse.json(
      {
        code: "internal_error",
        message: "Unable to create travel request.",
      },
      { status: 500 },
    );
  }
}
