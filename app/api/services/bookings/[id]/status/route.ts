import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateBookingStatus } from "@/modules/services/services-store";
import type { BookingStatus } from "@/modules/services/types";
import { requireApiPermission } from "@/services/auth/api-guards";
import { parseJsonBodySafe } from "@/services/http/request-body";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireApiPermission("travel.transition");
  if (!guard.ok) {
    return guard.response;
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Booking id is required" }, { status: 400 });
  }

  const parsedBody = await parseJsonBodySafe<{ status?: BookingStatus }>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }
  const body = parsedBody.data;

  if (!body.status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const updated = updateBookingStatus(id, body.status);
  if (!updated) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
