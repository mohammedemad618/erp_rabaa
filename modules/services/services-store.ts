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

function ts(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function dateStr(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

const hotels: HotelBooking[] = [
  { id: "HTL-001", category: "hotel", customerName: "Khalid Al-Rashid", customerPhone: "+966500001001", customerEmail: "khalid@example.com", hotelName: "Hilton Riyadh", city: "Riyadh", country: "Saudi Arabia", starRating: 5, roomType: "Deluxe King", checkIn: dateStr(5), checkOut: dateStr(8), nights: 3, guests: 2, mealPlan: "breakfast", confirmationNumber: "HLT-29384", totalAmount: 4500, currency: "SAR", status: "confirmed", createdAt: ts(2), updatedAt: ts(1), notes: "" },
  { id: "HTL-002", category: "hotel", customerName: "Sara Al-Otaibi", customerPhone: "+966500001002", customerEmail: "sara@example.com", hotelName: "Marriott Dubai Marina", city: "Dubai", country: "UAE", starRating: 5, roomType: "Sea View Suite", checkIn: dateStr(10), checkOut: dateStr(14), nights: 4, guests: 2, mealPlan: "half_board", confirmationNumber: "MRT-84721", totalAmount: 8200, currency: "SAR", status: "confirmed", createdAt: ts(3), updatedAt: ts(2), notes: "Anniversary trip" },
  { id: "HTL-003", category: "hotel", customerName: "Omar Hassan", customerPhone: "+966500001003", customerEmail: "omar@example.com", hotelName: "InterContinental Istanbul", city: "Istanbul", country: "Turkey", starRating: 5, roomType: "Business Room", checkIn: dateStr(15), checkOut: dateStr(18), nights: 3, guests: 1, mealPlan: "breakfast", confirmationNumber: "IHG-55102", totalAmount: 3200, currency: "SAR", status: "pending", createdAt: ts(1), updatedAt: ts(1), notes: "" },
  { id: "HTL-004", category: "hotel", customerName: "Layla Mohammed", customerPhone: "+966500001004", customerEmail: "layla@example.com", hotelName: "Four Seasons Maldives", city: "Malé", country: "Maldives", starRating: 5, roomType: "Water Villa", checkIn: dateStr(20), checkOut: dateStr(27), nights: 7, guests: 2, mealPlan: "all_inclusive", confirmationNumber: "FS-77241", totalAmount: 35000, currency: "SAR", status: "confirmed", createdAt: ts(5), updatedAt: ts(4), notes: "Honeymoon package" },
  { id: "HTL-005", category: "hotel", customerName: "Ahmed Nasser", customerPhone: "+966500001005", customerEmail: "ahmed.n@example.com", hotelName: "Sheraton Jeddah", city: "Jeddah", country: "Saudi Arabia", starRating: 4, roomType: "Standard Twin", checkIn: dateStr(2), checkOut: dateStr(4), nights: 2, guests: 1, mealPlan: "room_only", confirmationNumber: "SHR-33019", totalAmount: 1800, currency: "SAR", status: "completed", createdAt: ts(10), updatedAt: ts(3), notes: "" },
  { id: "HTL-006", category: "hotel", customerName: "Fatima Al-Zahrani", customerPhone: "+966500001006", customerEmail: "fatima@example.com", hotelName: "Raffles Makkah", city: "Makkah", country: "Saudi Arabia", starRating: 5, roomType: "Haram View Suite", checkIn: dateStr(8), checkOut: dateStr(12), nights: 4, guests: 3, mealPlan: "full_board", confirmationNumber: "RAF-19842", totalAmount: 12000, currency: "SAR", status: "confirmed", createdAt: ts(4), updatedAt: ts(2), notes: "Umrah trip" },
];

const carRentals: CarRentalBooking[] = [
  { id: "CAR-001", category: "car_rental", customerName: "Khalid Al-Rashid", customerPhone: "+966500001001", customerEmail: "khalid@example.com", provider: "Budget", vehicleType: "SUV", vehicleModel: "Toyota Land Cruiser 2025", pickupLocation: "King Khalid Airport, Riyadh", dropoffLocation: "King Khalid Airport, Riyadh", pickupDate: dateStr(5), dropoffDate: dateStr(8), days: 3, dailyRate: 450, includesInsurance: true, driverOption: "self_drive", totalAmount: 1350, currency: "SAR", status: "confirmed", createdAt: ts(2), updatedAt: ts(1), notes: "" },
  { id: "CAR-002", category: "car_rental", customerName: "Nora Al-Harbi", customerPhone: "+966500002001", customerEmail: "nora@example.com", provider: "Hertz", vehicleType: "Sedan", vehicleModel: "Mercedes E-Class 2025", pickupLocation: "Dubai Airport, Terminal 3", dropoffLocation: "Abu Dhabi Airport", pickupDate: dateStr(12), dropoffDate: dateStr(15), days: 3, dailyRate: 600, includesInsurance: true, driverOption: "with_driver", totalAmount: 1800, currency: "SAR", status: "pending", createdAt: ts(1), updatedAt: ts(1), notes: "" },
  { id: "CAR-003", category: "car_rental", customerName: "Youssef Matta", customerPhone: "+966500002002", customerEmail: "youssef@example.com", provider: "Avis", vehicleType: "Economy", vehicleModel: "Toyota Yaris 2025", pickupLocation: "Jeddah Airport", dropoffLocation: "Jeddah Airport", pickupDate: dateStr(3), dropoffDate: dateStr(5), days: 2, dailyRate: 150, includesInsurance: false, driverOption: "self_drive", totalAmount: 300, currency: "SAR", status: "completed", createdAt: ts(8), updatedAt: ts(3), notes: "" },
  { id: "CAR-004", category: "car_rental", customerName: "Rania Salem", customerPhone: "+966500002003", customerEmail: "rania@example.com", provider: "Enterprise", vehicleType: "Van", vehicleModel: "Toyota HiAce 2024", pickupLocation: "Riyadh City Center", dropoffLocation: "Riyadh City Center", pickupDate: dateStr(7), dropoffDate: dateStr(10), days: 3, dailyRate: 350, includesInsurance: true, driverOption: "with_driver", totalAmount: 1050, currency: "SAR", status: "confirmed", createdAt: ts(3), updatedAt: ts(2), notes: "Family trip" },
];

const visas: VisaBooking[] = [
  { id: "VIS-001", category: "visa", customerName: "Mohammed Al-Dosari", customerPhone: "+966500003001", customerEmail: "m.dosari@example.com", destinationCountry: "United Kingdom", visaType: "tourist", applicantName: "Mohammed Al-Dosari", passportNumber: "A12345678", applicationDate: dateStr(-5), expectedDate: dateStr(10), processingStatus: "under_review", embassy: "British Embassy Riyadh", totalAmount: 750, currency: "SAR", status: "in_progress", createdAt: ts(5), updatedAt: ts(1), notes: "" },
  { id: "VIS-002", category: "visa", customerName: "Huda Kareem", customerPhone: "+966500003002", customerEmail: "huda@example.com", destinationCountry: "Schengen (France)", visaType: "tourist", applicantName: "Huda Kareem", passportNumber: "B98765432", applicationDate: dateStr(-3), expectedDate: dateStr(12), processingStatus: "submitted_to_embassy", embassy: "French Embassy Riyadh", totalAmount: 950, currency: "SAR", status: "in_progress", createdAt: ts(3), updatedAt: ts(1), notes: "Family of 3" },
  { id: "VIS-003", category: "visa", customerName: "Ali Al-Qahtani", customerPhone: "+966500003003", customerEmail: "ali.q@example.com", destinationCountry: "United States", visaType: "business", applicantName: "Ali Al-Qahtani", passportNumber: "C55443322", applicationDate: dateStr(-10), expectedDate: dateStr(5), processingStatus: "approved", embassy: "US Embassy Riyadh", totalAmount: 1200, currency: "SAR", status: "completed", createdAt: ts(10), updatedAt: ts(2), notes: "" },
  { id: "VIS-004", category: "visa", customerName: "Salma Ibrahim", customerPhone: "+966500003004", customerEmail: "salma@example.com", destinationCountry: "Japan", visaType: "tourist", applicantName: "Salma Ibrahim", passportNumber: "D11223344", applicationDate: dateStr(-1), expectedDate: dateStr(20), processingStatus: "documents_collected", embassy: "Japanese Embassy Riyadh", totalAmount: 650, currency: "SAR", status: "pending", createdAt: ts(1), updatedAt: ts(1), notes: "" },
];

const insurance: InsuranceBooking[] = [
  { id: "INS-001", category: "insurance", customerName: "Khalid Al-Rashid", customerPhone: "+966500001001", customerEmail: "khalid@example.com", provider: "Tawuniya", planName: "Travel Shield Premium", planType: "premium", coverageArea: "worldwide", startDate: dateStr(5), endDate: dateStr(20), travelers: 2, medicalCoverage: 500000, tripCancellation: true, luggageCoverage: true, totalAmount: 850, currency: "SAR", status: "confirmed", createdAt: ts(2), updatedAt: ts(1), notes: "" },
  { id: "INS-002", category: "insurance", customerName: "Sara Al-Otaibi", customerPhone: "+966500001002", customerEmail: "sara@example.com", provider: "Bupa Arabia", planName: "Explorer Standard", planType: "standard", coverageArea: "regional", startDate: dateStr(10), endDate: dateStr(14), travelers: 2, medicalCoverage: 200000, tripCancellation: false, luggageCoverage: true, totalAmount: 380, currency: "SAR", status: "confirmed", createdAt: ts(3), updatedAt: ts(2), notes: "" },
  { id: "INS-003", category: "insurance", customerName: "Faisal Al-Mutairi", customerPhone: "+966500004001", customerEmail: "faisal@example.com", provider: "AXA", planName: "Platinum Worldwide", planType: "platinum", coverageArea: "worldwide", startDate: dateStr(3), endDate: dateStr(30), travelers: 4, medicalCoverage: 1000000, tripCancellation: true, luggageCoverage: true, totalAmount: 2200, currency: "SAR", status: "confirmed", createdAt: ts(4), updatedAt: ts(2), notes: "Family travel" },
];

const tours: TourPackage[] = [
  { id: "TUR-001", category: "tour", customerName: "Reem Al-Dossary", customerPhone: "+966500005001", customerEmail: "reem@example.com", tourName: "Discover Istanbul", destination: "Istanbul, Turkey", duration: "5 Days / 4 Nights", startDate: dateStr(14), endDate: dateStr(19), groupSize: 2, tourType: "cultural", includesFlights: true, includesHotel: true, includesMeals: true, itinerary: ["Arrival & Sultanahmet", "Topkapi Palace & Grand Bazaar", "Bosphorus Cruise", "Cappadocia Day Trip", "Departure"], totalAmount: 8500, currency: "SAR", status: "confirmed", createdAt: ts(6), updatedAt: ts(3), notes: "" },
  { id: "TUR-002", category: "tour", customerName: "Fahad Al-Shammari", customerPhone: "+966500005002", customerEmail: "fahad@example.com", tourName: "Maldives Paradise", destination: "Maldives", duration: "7 Days / 6 Nights", startDate: dateStr(21), endDate: dateStr(28), groupSize: 2, tourType: "luxury", includesFlights: true, includesHotel: true, includesMeals: true, itinerary: ["Arrival & Resort Check-in", "Snorkeling & Diving", "Spa Day", "Island Hopping", "Dolphin Watching", "Beach Day", "Departure"], totalAmount: 28000, currency: "SAR", status: "pending", createdAt: ts(4), updatedAt: ts(2), notes: "Honeymoon" },
  { id: "TUR-003", category: "tour", customerName: "Noura Al-Ahmadi", customerPhone: "+966500005003", customerEmail: "noura@example.com", tourName: "European Highlights", destination: "France, Italy, Switzerland", duration: "10 Days / 9 Nights", startDate: dateStr(30), endDate: dateStr(40), groupSize: 4, tourType: "group", includesFlights: true, includesHotel: true, includesMeals: false, itinerary: ["Paris Arrival", "Eiffel Tower & Louvre", "Versailles", "Train to Geneva", "Lake Geneva & Alps", "Zurich & Lucerne", "Train to Milan", "Venice Day Trip", "Rome Colosseum & Vatican", "Departure"], totalAmount: 42000, currency: "SAR", status: "confirmed", createdAt: ts(8), updatedAt: ts(5), notes: "Family summer trip" },
  { id: "TUR-004", category: "tour", customerName: "Tariq Hassan", customerPhone: "+966500005004", customerEmail: "tariq@example.com", tourName: "AlUla Desert Adventure", destination: "AlUla, Saudi Arabia", duration: "3 Days / 2 Nights", startDate: dateStr(7), endDate: dateStr(10), groupSize: 6, tourType: "adventure", includesFlights: false, includesHotel: true, includesMeals: true, itinerary: ["Hegra Archaeological Site", "Desert Safari & Camping", "Elephant Rock & Old Town"], totalAmount: 4800, currency: "SAR", status: "confirmed", createdAt: ts(3), updatedAt: ts(1), notes: "Corporate team building" },
];

const transfers: TransferBooking[] = [
  { id: "TRF-001", category: "transfer", customerName: "Khalid Al-Rashid", customerPhone: "+966500001001", customerEmail: "khalid@example.com", transferType: "airport_pickup", vehicleClass: "business", pickupLocation: "King Khalid International Airport", dropoffLocation: "Hilton Riyadh Hotel", pickupDateTime: `${dateStr(5)}T14:30:00`, passengers: 2, flightNumber: "SV 1012", driverName: "Abdullah Fahd", driverPhone: "+966550001001", totalAmount: 250, currency: "SAR", status: "confirmed", createdAt: ts(2), updatedAt: ts(1), notes: "" },
  { id: "TRF-002", category: "transfer", customerName: "Sara Al-Otaibi", customerPhone: "+966500001002", customerEmail: "sara@example.com", transferType: "airport_dropoff", vehicleClass: "vip", pickupLocation: "Marriott Dubai Marina", dropoffLocation: "Dubai International Airport", pickupDateTime: `${dateStr(14)}T06:00:00`, passengers: 2, flightNumber: "EK 832", driverName: "Hassan Ali", driverPhone: "+971500001001", totalAmount: 380, currency: "SAR", status: "confirmed", createdAt: ts(3), updatedAt: ts(2), notes: "" },
  { id: "TRF-003", category: "transfer", customerName: "Omar Hassan", customerPhone: "+966500001003", customerEmail: "omar@example.com", transferType: "intercity", vehicleClass: "van", pickupLocation: "Riyadh City", dropoffLocation: "Makkah", pickupDateTime: `${dateStr(8)}T08:00:00`, passengers: 5, flightNumber: "", driverName: "Majid Saleh", driverPhone: "+966550001003", totalAmount: 1200, currency: "SAR", status: "pending", createdAt: ts(1), updatedAt: ts(1), notes: "Umrah group" },
  { id: "TRF-004", category: "transfer", customerName: "Layla Mohammed", customerPhone: "+966500001004", customerEmail: "layla@example.com", transferType: "city_tour", vehicleClass: "business", pickupLocation: "Hotel", dropoffLocation: "Hotel (full day)", pickupDateTime: `${dateStr(22)}T09:00:00`, passengers: 2, flightNumber: "", driverName: "Ismail Youssef", driverPhone: "+960500001001", totalAmount: 550, currency: "SAR", status: "confirmed", createdAt: ts(5), updatedAt: ts(3), notes: "Maldives city tour" },
];

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

export function getServiceStats(): Record<ServiceCategory, { count: number; revenue: number; pending: number }> {
  const stats: Record<string, { count: number; revenue: number; pending: number }> = {};
  const cats: ServiceCategory[] = ["hotel", "car_rental", "visa", "insurance", "tour", "transfer"];
  for (const cat of cats) {
    const items = allBookings.filter((b) => b.category === cat);
    stats[cat] = {
      count: items.length,
      revenue: items.reduce((sum, b) => sum + b.totalAmount, 0),
      pending: items.filter((b) => b.status === "pending" || b.status === "in_progress").length,
    };
  }
  return stats as Record<ServiceCategory, { count: number; revenue: number; pending: number }>;
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
  const newBooking = {
    ...booking,
    id: `${prefix}-${String(num).padStart(3, "0")}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  allBookings.push(newBooking);
  return newBooking;
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
