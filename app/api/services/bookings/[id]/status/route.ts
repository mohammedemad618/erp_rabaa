import { NextResponse } from "next/server";
import { updateBookingStatus } from "@/modules/services/services-store";
import type { BookingStatus } from "@/modules/services/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = (await request.json()) as { status: BookingStatus };
    if (!body.status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }
    const updated = updateBookingStatus(id, body.status);
    if (!updated) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
