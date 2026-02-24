"use client";

import { Building2, Car, FileCheck, Shield, Map, Bus, Globe, Search, ArrowLeft, Plus } from "lucide-react";
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  ErpKpiGrid,
  ErpPageHeader,
  ErpPageLayout,
  ErpSection,
} from "@/components/layout/erp-page-layout";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/utils/format";
import type { AnyServiceBooking, ServiceCategory, BookingStatus } from "../types";
import { SERVICE_CATEGORIES } from "../types";

const ICONS: Record<string, React.ElementType> = {
  hotel: Building2, car: Car, passport: FileCheck, shield: Shield, map: Map, bus: Bus,
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-rose-100 text-rose-600",
  refunded: "bg-purple-100 text-purple-600",
};

const MEAL_LABELS: Record<string, string> = {
  room_only: "Room Only", breakfast: "Breakfast", half_board: "Half Board",
  full_board: "Full Board", all_inclusive: "All Inclusive",
};

const MEAL_LABELS_AR: Record<string, string> = {
  room_only: "غرفة فقط", breakfast: "إفطار", half_board: "نصف إقامة",
  full_board: "إقامة كاملة", all_inclusive: "شامل",
};

interface ServiceListPageProps {
  category: ServiceCategory;
  bookings: AnyServiceBooking[];
}

export function ServiceListPage({ category, bookings }: ServiceListPageProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const catInfo = SERVICE_CATEGORIES.find((c) => c.id === category)!;
  const IconComp = ICONS[catInfo.icon] ?? Globe;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string>(bookings[0]?.id ?? "");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!q) return true;
      return b.id.toLowerCase().includes(q) || b.customerName.toLowerCase().includes(q);
    });
  }, [bookings, search, statusFilter]);

  const selected = bookings.find((b) => b.id === selectedId);
  const revenue = bookings.reduce((s, b) => s + b.totalAmount, 0);
  const pendingCount = bookings.filter((b) => b.status === "pending" || b.status === "in_progress").length;
  const confirmedCount = bookings.filter((b) => b.status === "confirmed").length;

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={isAr ? catInfo.labelAr : catInfo.labelEn}
        description={isAr ? catInfo.descriptionAr : catInfo.descriptionEn}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/services">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="me-1 h-3.5 w-3.5" />
                {isAr ? "جميع الخدمات" : "All Services"}
              </Button>
            </Link>
            <Button size="sm">
              <Plus className="me-1 h-3.5 w-3.5" />
              {isAr ? "حجز جديد" : "New Booking"}
            </Button>
          </div>
        }
      />

      <ErpKpiGrid className="xl:grid-cols-4">
        <article className={`rounded-xl border p-4 ${catInfo.bgColor} border-transparent`}>
          <p className="text-xs text-muted-foreground">{isAr ? "إجمالي الحجوزات" : "Total Bookings"}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{bookings.length}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{isAr ? "الإيرادات" : "Revenue"}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{formatCurrency(revenue, locale, "SAR")}</p>
        </article>
        <article className="surface-card p-4">
          <p className="text-xs text-muted-foreground">{isAr ? "مؤكدة" : "Confirmed"}</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{confirmedCount}</p>
        </article>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs text-muted-foreground">{isAr ? "معلقة" : "Pending"}</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{pendingCount}</p>
        </article>
      </ErpKpiGrid>

      <ErpSection
        className="col-span-12"
        title={isAr ? "سجل الحجوزات" : "Booking Register"}
      >
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "ابحث..." : "Search..."}
              className="h-9 w-full rounded-lg border border-border bg-white ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BookingStatus | "all")}
            className="h-9 rounded-lg border border-border bg-white px-3 text-sm"
          >
            <option value="all">{isAr ? "جميع الحالات" : "All Statuses"}</option>
            <option value="pending">{isAr ? "معلق" : "Pending"}</option>
            <option value="confirmed">{isAr ? "مؤكد" : "Confirmed"}</option>
            <option value="in_progress">{isAr ? "قيد التنفيذ" : "In Progress"}</option>
            <option value="completed">{isAr ? "مكتمل" : "Completed"}</option>
            <option value="cancelled">{isAr ? "ملغي" : "Cancelled"}</option>
          </select>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div className="max-h-[520px] overflow-auto rounded-lg border border-border">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-white">
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 text-start font-medium">ID</th>
                  <th className="px-3 py-2.5 text-start font-medium">{isAr ? "العميل" : "Customer"}</th>
                  <th className="px-3 py-2.5 text-end font-medium">{isAr ? "المبلغ" : "Amount"}</th>
                  <th className="px-3 py-2.5 text-start font-medium">{isAr ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedId(b.id)}
                    className={`cursor-pointer transition-colors ${b.id === selectedId ? "bg-blue-50/50" : "hover:bg-slate-50/60"}`}
                  >
                    <td className="px-3 py-2.5 font-medium text-finance">{b.id}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-finance">{b.customerName}</p>
                      <p className="text-[11px] text-muted-foreground">{b.customerEmail}</p>
                    </td>
                    <td className="px-3 py-2.5 text-end font-semibold text-finance">
                      {formatCurrency(b.totalAmount, locale, b.currency)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[b.status] ?? ""}`}>
                        {b.status.replace(/_/g, " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{isAr ? "لا توجد نتائج" : "No results"}</p>
            )}
          </div>

          {selected ? (
            <div className="surface-card p-5">
              <div className="mb-4 flex items-center gap-3 border-b border-border/40 pb-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${catInfo.bgColor}`}>
                  <IconComp className={`h-5 w-5 ${catInfo.color}`} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-finance">{selected.id}</h3>
                  <p className="text-[11px] text-muted-foreground">{selected.customerName}</p>
                </div>
                <span className={`ms-auto rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[selected.status] ?? ""}`}>
                  {selected.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                {renderDetailFields(selected, isAr, locale)}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" variant="secondary" className="flex-1">
                  {isAr ? "تعديل" : "Edit"}
                </Button>
                <Button size="sm" variant="outline" className="flex-1">
                  {isAr ? "طباعة" : "Print"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-xl border border-dashed border-border p-12 text-sm text-muted-foreground">
              {isAr ? "اختر حجزاً لعرض التفاصيل" : "Select a booking to view details"}
            </div>
          )}
        </div>
      </ErpSection>
    </ErpPageLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border/30">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-finance">{value}</span>
    </div>
  );
}

function renderDetailFields(b: AnyServiceBooking, isAr: boolean, locale: string) {
  const rows: Array<{ label: string; value: string | number }> = [
    { label: isAr ? "العميل" : "Customer", value: b.customerName },
    { label: isAr ? "الهاتف" : "Phone", value: b.customerPhone },
    { label: isAr ? "البريد" : "Email", value: b.customerEmail },
    { label: isAr ? "المبلغ" : "Amount", value: formatCurrency(b.totalAmount, locale, b.currency) },
    { label: isAr ? "التاريخ" : "Created", value: formatDate(b.createdAt, locale) },
  ];

  switch (b.category) {
    case "hotel":
      rows.push(
        { label: isAr ? "الفندق" : "Hotel", value: b.hotelName },
        { label: isAr ? "المدينة" : "City", value: `${b.city}, ${b.country}` },
        { label: isAr ? "نوع الغرفة" : "Room", value: b.roomType },
        { label: isAr ? "تسجيل الدخول" : "Check-in", value: b.checkIn },
        { label: isAr ? "تسجيل الخروج" : "Check-out", value: b.checkOut },
        { label: isAr ? "الليالي" : "Nights", value: b.nights },
        { label: isAr ? "الضيوف" : "Guests", value: b.guests },
        { label: isAr ? "الوجبات" : "Meal Plan", value: isAr ? (MEAL_LABELS_AR[b.mealPlan] ?? b.mealPlan) : (MEAL_LABELS[b.mealPlan] ?? b.mealPlan) },
        { label: isAr ? "رقم التأكيد" : "Confirmation", value: b.confirmationNumber },
      );
      break;
    case "car_rental":
      rows.push(
        { label: isAr ? "المزود" : "Provider", value: b.provider },
        { label: isAr ? "المركبة" : "Vehicle", value: b.vehicleModel },
        { label: isAr ? "الاستلام" : "Pickup", value: b.pickupLocation },
        { label: isAr ? "التسليم" : "Dropoff", value: b.dropoffLocation },
        { label: isAr ? "الأيام" : "Days", value: b.days },
        { label: isAr ? "السعر اليومي" : "Daily Rate", value: formatCurrency(b.dailyRate, locale, b.currency) },
        { label: isAr ? "السائق" : "Driver", value: b.driverOption === "with_driver" ? (isAr ? "مع سائق" : "With Driver") : (isAr ? "قيادة ذاتية" : "Self Drive") },
      );
      break;
    case "visa":
      rows.push(
        { label: isAr ? "الوجهة" : "Country", value: b.destinationCountry },
        { label: isAr ? "نوع التأشيرة" : "Visa Type", value: b.visaType },
        { label: isAr ? "رقم الجواز" : "Passport", value: b.passportNumber },
        { label: isAr ? "السفارة" : "Embassy", value: b.embassy },
        { label: isAr ? "حالة المعالجة" : "Processing", value: b.processingStatus.replace(/_/g, " ") },
      );
      break;
    case "insurance":
      rows.push(
        { label: isAr ? "المزود" : "Provider", value: b.provider },
        { label: isAr ? "الخطة" : "Plan", value: b.planName },
        { label: isAr ? "النوع" : "Type", value: b.planType },
        { label: isAr ? "التغطية" : "Coverage", value: b.coverageArea },
        { label: isAr ? "المسافرون" : "Travelers", value: b.travelers },
        { label: isAr ? "التغطية الطبية" : "Medical", value: formatCurrency(b.medicalCoverage, locale, b.currency) },
      );
      break;
    case "tour":
      rows.push(
        { label: isAr ? "الرحلة" : "Tour", value: b.tourName },
        { label: isAr ? "الوجهة" : "Destination", value: b.destination },
        { label: isAr ? "المدة" : "Duration", value: b.duration },
        { label: isAr ? "حجم المجموعة" : "Group Size", value: b.groupSize },
        { label: isAr ? "النوع" : "Type", value: b.tourType },
        { label: isAr ? "يشمل الطيران" : "Flights", value: b.includesFlights ? "✓" : "✗" },
        { label: isAr ? "يشمل الفندق" : "Hotel", value: b.includesHotel ? "✓" : "✗" },
      );
      break;
    case "transfer":
      rows.push(
        { label: isAr ? "النوع" : "Type", value: b.transferType.replace(/_/g, " ") },
        { label: isAr ? "الفئة" : "Class", value: b.vehicleClass },
        { label: isAr ? "من" : "From", value: b.pickupLocation },
        { label: isAr ? "إلى" : "To", value: b.dropoffLocation },
        { label: isAr ? "الركاب" : "Passengers", value: b.passengers },
        { label: isAr ? "رقم الرحلة" : "Flight", value: b.flightNumber || "—" },
        { label: isAr ? "السائق" : "Driver", value: b.driverName },
      );
      break;
  }

  if (b.notes) {
    rows.push({ label: isAr ? "ملاحظات" : "Notes", value: b.notes });
  }

  return rows.map((r) => <DetailRow key={r.label} label={r.label} value={r.value} />);
}
