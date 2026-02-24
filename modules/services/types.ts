export type ServiceCategory =
  | "hotel"
  | "car_rental"
  | "visa"
  | "insurance"
  | "tour"
  | "transfer";

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
  id: ServiceCategory;
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const SERVICE_CATEGORIES: ServiceCategoryInfo[] = [
  {
    id: "hotel",
    labelEn: "Hotel Reservations",
    labelAr: "حجوزات الفنادق",
    descriptionEn: "Book rooms across partner hotels worldwide",
    descriptionAr: "حجز غرف في فنادق شريكة حول العالم",
    icon: "hotel",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    id: "car_rental",
    labelEn: "Car Rental",
    labelAr: "تأجير السيارات",
    descriptionEn: "Rent vehicles with or without driver",
    descriptionAr: "استئجار مركبات مع أو بدون سائق",
    icon: "car",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
  },
  {
    id: "visa",
    labelEn: "Visa Services",
    labelAr: "خدمات التأشيرات",
    descriptionEn: "Visa application processing and tracking",
    descriptionAr: "معالجة وتتبع طلبات التأشيرات",
    icon: "passport",
    color: "text-violet-600",
    bgColor: "bg-violet-50",
  },
  {
    id: "insurance",
    labelEn: "Travel Insurance",
    labelAr: "تأمين السفر",
    descriptionEn: "Comprehensive travel insurance plans",
    descriptionAr: "خطط تأمين سفر شاملة",
    icon: "shield",
    color: "text-amber-600",
    bgColor: "bg-amber-50",
  },
  {
    id: "tour",
    labelEn: "Tour Packages",
    labelAr: "البرامج السياحية",
    descriptionEn: "Curated tour packages and itineraries",
    descriptionAr: "برامج سياحية وخطط رحلات مختارة",
    icon: "map",
    color: "text-rose-600",
    bgColor: "bg-rose-50",
  },
  {
    id: "transfer",
    labelEn: "Airport Transfers",
    labelAr: "التوصيل من وإلى المطار",
    descriptionEn: "Airport pickup, dropoff and intercity transfers",
    descriptionAr: "خدمات التوصيل من وإلى المطار والتنقل بين المدن",
    icon: "bus",
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
  },
];
