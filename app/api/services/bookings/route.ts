import { NextResponse } from "next/server";
import { addBooking, listBookings } from "@/modules/services/services-store";
import type { AnyServiceBooking } from "@/modules/services/types";

export async function GET() {
  return NextResponse.json(listBookings());
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnyServiceBooking;
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
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
