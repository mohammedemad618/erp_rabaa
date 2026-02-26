import type { ServiceCategoryInfo } from "./types";

const seedCategories: ServiceCategoryInfo[] = [
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

const categories: ServiceCategoryInfo[] = [...seedCategories];

let nextIdCounter = 7;

function generateId(labelEn: string): string {
  const slug = labelEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return slug || `cat_${nextIdCounter++}`;
}

export const SERVICE_CATEGORIES: ServiceCategoryInfo[] = categories;

export function listServiceCategories(): ServiceCategoryInfo[] {
  return [...categories];
}

export function getServiceCategory(id: string): ServiceCategoryInfo | undefined {
  return categories.find((c) => c.id === id);
}

export interface AddServiceCategoryInput {
  labelEn: string;
  labelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  icon: string;
  color: string;
  bgColor: string;
}

export function addServiceCategory(input: AddServiceCategoryInput): ServiceCategoryInfo {
  const id = generateId(input.labelEn);
  if (categories.find((c) => c.id === id)) {
    throw new Error(`Category with id "${id}" already exists.`);
  }
  const cat: ServiceCategoryInfo = { id, ...input };
  categories.push(cat);
  return cat;
}

export interface UpdateServiceCategoryInput {
  id: string;
  labelEn?: string;
  labelAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  icon?: string;
  color?: string;
  bgColor?: string;
}

export function updateServiceCategory(input: UpdateServiceCategoryInput): ServiceCategoryInfo {
  const idx = categories.findIndex((c) => c.id === input.id);
  if (idx < 0) throw new Error(`Category "${input.id}" not found.`);
  const existing = categories[idx];
  const updated: ServiceCategoryInfo = {
    ...existing,
    ...(input.labelEn !== undefined && { labelEn: input.labelEn }),
    ...(input.labelAr !== undefined && { labelAr: input.labelAr }),
    ...(input.descriptionEn !== undefined && { descriptionEn: input.descriptionEn }),
    ...(input.descriptionAr !== undefined && { descriptionAr: input.descriptionAr }),
    ...(input.icon !== undefined && { icon: input.icon }),
    ...(input.color !== undefined && { color: input.color }),
    ...(input.bgColor !== undefined && { bgColor: input.bgColor }),
  };
  categories[idx] = updated;
  return updated;
}

let _bookingCounter: ((categoryId: string) => number) | null = null;

export function registerBookingCounter(fn: (categoryId: string) => number): void {
  _bookingCounter = fn;
}

export function deleteServiceCategory(id: string): { ok: true } | { ok: false; reason: string } {
  const idx = categories.findIndex((c) => c.id === id);
  if (idx < 0) return { ok: false, reason: "Category not found." };

  const count = _bookingCounter ? _bookingCounter(id) : 0;
  if (count > 0) {
    return { ok: false, reason: `Cannot delete: ${count} booking(s) use this category.` };
  }

  categories.splice(idx, 1);
  return { ok: true };
}

export function getBookingCountByCategory(id: string): number {
  return _bookingCounter ? _bookingCounter(id) : 0;
}
