import { listTravelRequests } from "@/services/travel-request-store";
import { listBookings } from "./services-store";
import type { ServiceCategory } from "./types";

const BOOKING_ID_PREFIX_TO_CATEGORY: Record<string, ServiceCategory> = {
  HTL: "hotel",
  CAR: "car_rental",
  VIS: "visa",
  INS: "insurance",
  TUR: "tour",
  TRF: "transfer",
};

const USAGE_ELIGIBLE_TRAVEL_STATUSES = new Set(["booked", "closed"]);

function resolveCategoryFromBookingId(bookingId: string): ServiceCategory | null {
  const prefix = bookingId.split("-")[0]?.toUpperCase();
  if (!prefix) {
    return null;
  }
  return BOOKING_ID_PREFIX_TO_CATEGORY[prefix] ?? null;
}

export async function getServiceCategoryBookingCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  const bookings = listBookings();
  const categoryByBookingId = new Map<string, ServiceCategory>();

  for (const booking of bookings) {
    categoryByBookingId.set(booking.id, booking.category);
    counts[booking.category] = (counts[booking.category] ?? 0) + 1;
  }

  const travelRequests = await listTravelRequests();
  for (const request of travelRequests) {
    if (!USAGE_ELIGIBLE_TRAVEL_STATUSES.has(request.status)) {
      continue;
    }
    for (const bookingId of request.linkedServiceBookings) {
      const category =
        categoryByBookingId.get(bookingId) ?? resolveCategoryFromBookingId(bookingId);
      if (!category) {
        continue;
      }
      counts[category] = (counts[category] ?? 0) + 1;
    }
  }

  return counts;
}
