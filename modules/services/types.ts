export type ServiceCategory = string;

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "refunded";

export interface ServiceBooking {
  id: string;
  category: ServiceCategory;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  status: BookingStatus;
  totalAmount: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
}

export interface HotelBooking extends ServiceBooking {
  category: "hotel";
  hotelName: string;
  city: string;
  country: string;
  starRating: number;
  roomType: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  mealPlan: "room_only" | "breakfast" | "half_board" | "full_board" | "all_inclusive";
  confirmationNumber: string;
}

export interface CarRentalBooking extends ServiceBooking {
  category: "car_rental";
  provider: string;
  vehicleType: string;
  vehicleModel: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupDate: string;
  dropoffDate: string;
  days: number;
  dailyRate: number;
  includesInsurance: boolean;
  driverOption: "self_drive" | "with_driver";
}

export interface VisaBooking extends ServiceBooking {
  category: "visa";
  destinationCountry: string;
  visaType: "tourist" | "business" | "transit" | "work" | "student";
  applicantName: string;
  passportNumber: string;
  applicationDate: string;
  expectedDate: string;
  processingStatus: "documents_collected" | "submitted_to_embassy" | "under_review" | "approved" | "rejected";
  embassy: string;
}

export interface InsuranceBooking extends ServiceBooking {
  category: "insurance";
  provider: string;
  planName: string;
  planType: "basic" | "standard" | "premium" | "platinum";
  coverageArea: "domestic" | "regional" | "worldwide";
  startDate: string;
  endDate: string;
  travelers: number;
  medicalCoverage: number;
  tripCancellation: boolean;
  luggageCoverage: boolean;
}

export interface TourPackage extends ServiceBooking {
  category: "tour";
  tourName: string;
  destination: string;
  duration: string;
  startDate: string;
  endDate: string;
  groupSize: number;
  tourType: "group" | "private" | "luxury" | "adventure" | "cultural";
  includesFlights: boolean;
  includesHotel: boolean;
  includesMeals: boolean;
  itinerary: string[];
}

export interface TransferBooking extends ServiceBooking {
  category: "transfer";
  transferType: "airport_pickup" | "airport_dropoff" | "intercity" | "city_tour";
  vehicleClass: "economy" | "business" | "vip" | "van" | "bus";
  pickupLocation: string;
  dropoffLocation: string;
  pickupDateTime: string;
  passengers: number;
  flightNumber: string;
  driverName: string;
  driverPhone: string;
}

export type AnyServiceBooking =
  | HotelBooking
  | CarRentalBooking
  | VisaBooking
  | InsuranceBooking
  | TourPackage
  | TransferBooking;

export interface ServiceCategoryInfo {
  id: string;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: string;
  color: string;
  bgColor: string;
}

export { listServiceCategories as SERVICE_CATEGORIES_FN } from "./service-category-store";
export { SERVICE_CATEGORIES } from "./service-category-store";
