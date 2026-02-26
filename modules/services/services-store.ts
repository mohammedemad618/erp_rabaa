import type {
  AnyServiceBooking,
  HotelBooking,
  CarRentalBooking,
  VisaBooking,
  InsuranceBooking,
  TourPackage,
  TransferBooking,
  ServiceCategory,
  BookingStatus,
} from "./types";
import { resolveCustomerIdFromBooking } from "@/modules/customers/customer-store";
import { registerBookingCounter, listServiceCategories } from "./service-category-store";

const hotels: HotelBooking[] = [];
const carRentals: CarRentalBooking[] = [];
const visas: VisaBooking[] = [];
const insurance: InsuranceBooking[] = [];
const tours: TourPackage[] = [];
const transfers: TransferBooking[] = [];

const allBookings: AnyServiceBooking[] = [
  ...hotels,
  ...carRentals,
  ...visas,
  ...insurance,
  ...tours,
  ...transfers,
];

export function listBookings(category?: ServiceCategory): AnyServiceBooking[] {
  if (category) {
    return allBookings.filter((b) => b.category === category);
  }
  return allBookings;
}

export function getBooking(id: string): AnyServiceBooking | undefined {
  return allBookings.find((b) => b.id === id);
}

export function getServiceStats(): Record<string, { count: number; revenue: number; pending: number }> {
  const stats: Record<string, { count: number; revenue: number; pending: number }> = {};
  const cats = listServiceCategories();
  for (const cat of cats) {
    const items = allBookings.filter((b) => b.category === cat.id);
    stats[cat.id] = {
      count: items.length,
      revenue: items.reduce((sum, b) => sum + b.totalAmount, 0),
      pending: items.filter((b) => b.status === "pending" || b.status === "in_progress").length,
    };
  }
  return stats;
}

export function getTotalRevenue(): number {
  return allBookings.reduce((sum, b) => sum + b.totalAmount, 0);
}

export function getBookingsByStatus(): Record<BookingStatus, number> {
  const result: Record<string, number> = {};
  for (const b of allBookings) {
    result[b.status] = (result[b.status] ?? 0) + 1;
  }
  return result as Record<BookingStatus, number>;
}

const nextIdCounters: Record<string, number> = {
  HTL: 7, CAR: 5, VIS: 5, INS: 4, TUR: 5, TRF: 5,
};

const PREFIX_MAP: Record<ServiceCategory, string> = {
  hotel: "HTL", car_rental: "CAR", visa: "VIS",
  insurance: "INS", tour: "TUR", transfer: "TRF",
};

export function addBooking(booking: AnyServiceBooking): AnyServiceBooking {
  const prefix = PREFIX_MAP[booking.category];
  const num = nextIdCounters[prefix] ?? 99;
  nextIdCounters[prefix] = num + 1;
  const customerId = booking.customerId || resolveCustomerIdFromBooking(booking.customerName, booking.customerPhone) || "";
  const newBooking = {
    ...booking,
    id: `${prefix}-${String(num).padStart(3, "0")}`,
    customerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  allBookings.push(newBooking);
  return newBooking;
}

export function getBookingsByCustomerId(customerId: string): AnyServiceBooking[] {
  return allBookings.filter((b) => b.customerId === customerId);
}

export function updateBookingStatus(
  id: string,
  newStatus: BookingStatus,
): AnyServiceBooking | null {
  const idx = allBookings.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  allBookings[idx] = {
    ...allBookings[idx],
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };
  return allBookings[idx];
}

registerBookingCounter((categoryId) => allBookings.filter((b) => b.category === categoryId).length);
