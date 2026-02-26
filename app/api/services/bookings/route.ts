import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { addBooking, listBookings } from "@/modules/services/services-store";
import type { AnyServiceBooking } from "@/modules/services/types";
import { requireApiPermission } from "@/services/auth/api-guards";
import { parseJsonBodySafe } from "@/services/http/request-body";

export async function GET() {
  const guard = await requireApiPermission("dashboard.view");
  if (!guard.ok) {
    return guard.response;
  }

  return NextResponse.json(listBookings());
}

export async function POST(request: NextRequest) {
  const guard = await requireApiPermission("travel.transition");
  if (!guard.ok) {
    return guard.response;
  }

  const parsedBody = await parseJsonBodySafe<AnyServiceBooking>(request);
  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const body = parsedBody.data;
  if (!body.category || !body.customerName) {
    return NextResponse.json(
      { error: "category and customerName are required" },
      { status: 400 },
    );
  }

  const created = addBooking({
    ...body,
    status: body.status ?? "pending",
    currency: body.currency ?? "SAR",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json(created, { status: 201 });
}
