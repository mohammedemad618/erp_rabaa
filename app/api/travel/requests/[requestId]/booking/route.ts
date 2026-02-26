import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireApiPermission } from "@/services/auth/api-guards";
import { mapEnterpriseRoleToTravelActorRole } from "@/services/auth/role-mapping";
import { parseJsonBodySafe } from "@/services/http/request-body";
import { upsertTravelBooking } from "@/services/travel-request-store";

interface BookingBody {
  vendor?: string;
  bookingReference?: string;
  ticketNumber?: string;
  bookedAt?: string;
  totalBookedCost?: number;
  currency?: string;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  const { requestId } = await context.params;
  if (!requestId) {
    return NextResponse.json(
      {
        code: "validation_failed",
        message: "requestId is required.",
      },
      { status: 400 },
    );
  }

  const guard = await requireApiPermission("travel.booking.manage");
  if (!guard.ok) {
    return guard.response;
  }

  const actorRole = mapEnterpriseRoleToTravelActorRole(guard.user.role);
  if (!actorRole) {
    return NextResponse.json(
      {
        code: "forbidden",
        message: "Your role is not allowed to manage booking details.",
      },
      { status: 403 },
    );
  }

  const parsedBody = await parseJsonBodySafe<BookingBody>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  const result = await upsertTravelBooking({
    requestId,
    actorRole,
    actorName: guard.user.name,
    vendor: body.vendor ?? "",
    bookingReference: body.bookingReference ?? "",
    ticketNumber: body.ticketNumber,
    bookedAt: body.bookedAt,
    totalBookedCost: body.totalBookedCost ?? Number.NaN,
    currency: body.currency ?? "",
  });

  if (!result.ok) {
    const statusByCode: Record<typeof result.error.code, number> = {
      request_not_found: 404,
      role_not_allowed: 403,
      invalid_state: 409,
      validation_failed: 422,
    };

    return NextResponse.json(
      {
        code: result.error.code,
        message: result.error.message,
      },
      { status: statusByCode[result.error.code] ?? 400 },
    );
  }

  return NextResponse.json(result.result, { status: 200 });
}
