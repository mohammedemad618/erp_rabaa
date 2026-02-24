"use client";

import { Building2, Car, FileCheck, Globe, Map, Shield, Bus, Search, TrendingUp } from "lucide-react";
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import {
  ErpKpiGrid,
  ErpPageHeader,
  ErpPageLayout,
  ErpSection,
} from "@/components/layout/erp-page-layout";
import { formatCurrency, formatDate } from "@/utils/format";
import type { AnyServiceBooking, ServiceCategory, ServiceCategoryInfo } from "../types";
import { SERVICE_CATEGORIES } from "../types";

const ICONS: Record<string, React.ElementType> = {
  hotel: Building2,
  car: Car,
  passport: FileCheck,
  shield: Shield,
  map: Map,
  bus: Bus,
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-slate-100 text-slate-600",
  cancelled: "bg-rose-100 text-rose-600",
  refunded: "bg-purple-100 text-purple-600",
};

interface ServicesHubProps {
  bookings: AnyServiceBooking[];
  stats: Record<ServiceCategory, { count: number; revenue: number; pending: number }>;
}

export function ServicesHub({ bookings, stats }: ServicesHubProps) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | "all">("all");

  const totalRevenue = useMemo(
    () => Object.values(stats).reduce((s, v) => s + v.revenue, 0),
    [stats],
  );
  const totalBookings = useMemo(
    () => Object.values(stats).reduce((s, v) => s + v.count, 0),
    [stats],
  );
  const totalPending = useMemo(
    () => Object.values(stats).reduce((s, v) => s + v.pending, 0),
    [stats],
  );

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings
      .filter((b) => {
        if (categoryFilter !== "all" && b.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          b.id.toLowerCase().includes(q) ||
          b.customerName.toLowerCase().includes(q) ||
          b.customerEmail.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20);
  }, [bookings, categoryFilter, search]);

  const categoryLabel = (cat: ServiceCategoryInfo) =>
    isAr ? cat.labelAr : cat.labelEn;
  const categoryDesc = (cat: ServiceCategoryInfo) =>
    isAr ? cat.descriptionAr : cat.descriptionEn;

  const categoryRoutes: Record<ServiceCategory, string> = {
    hotel: "/services/hotels",
    car_rental: "/services/cars",
    visa: "/services/visa",
    insurance: "/services/insurance",
    tour: "/services/tours",
    transfer: "/services/transfers",
  };

  return (
    <ErpPageLayout>
      <ErpPageHeader
        title={isAr ? "مركز الخدمات السياحية" : "Travel Services Hub"}
        description={
          isAr
            ? "إدارة شاملة لجميع خدمات السفر والسياحة — الفنادق والسيارات والتأشيرات والتأمين والبرامج السياحية والتوصيل"
            : "Comprehensive management of all travel & tourism services — hotels, cars, visas, insurance, tours, and transfers"
        }
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <TrendingUp className="h-3 w-3" />
              {formatCurrency(totalRevenue, locale, "SAR")}
            </span>
          </div>
        }
      />

      <ErpKpiGrid className="xl:grid-cols-3">
        <article className="surface-card p-5">
          <p className="text-xs text-muted-foreground">{isAr ? "إجمالي الحجوزات" : "Total Bookings"}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{totalBookings}</p>
        </article>
        <article className="surface-card p-5">
          <p className="text-xs text-muted-foreground">{isAr ? "إجمالي الإيرادات" : "Total Revenue"}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{formatCurrency(totalRevenue, locale, "SAR")}</p>
        </article>
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs text-muted-foreground">{isAr ? "بانتظار التأكيد" : "Pending Confirmation"}</p>
          <p className="mt-2 text-2xl font-bold text-finance">{totalPending}</p>
        </article>
      </ErpKpiGrid>

      <div className="col-span-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SERVICE_CATEGORIES.map((cat) => {
          const IconComp = ICONS[cat.icon] ?? Globe;
          const s = stats[cat.id];
          return (
            <Link
              key={cat.id}
              href={categoryRoutes[cat.id]}
              className="surface-card group flex flex-col p-5 transition-all hover:shadow-lg hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${cat.bgColor}`}>
                  <IconComp className={`h-5 w-5 ${cat.color}`} />
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
                  {s?.count ?? 0} {isAr ? "حجز" : "bookings"}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-finance group-hover:text-primary transition-colors">
                {categoryLabel(cat)}
              </h3>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                {categoryDesc(cat)}
              </p>
              <div className="mt-auto pt-3 flex items-center justify-between border-t border-border/40">
                <span className="text-xs font-semibold text-finance">
                  {formatCurrency(s?.revenue ?? 0, locale, "SAR")}
                </span>
                {(s?.pending ?? 0) > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                    {s.pending} {isAr ? "معلق" : "pending"}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <ErpSection
        className="col-span-12"
        title={isAr ? "أحدث الحجوزات" : "Recent Bookings"}
        description={isAr ? "آخر الحجوزات عبر جميع الخدمات" : "Latest bookings across all services"}
      >
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "ابحث بالاسم أو الرقم..." : "Search by name or ID..."}
              className="h-9 w-full rounded-lg border border-border bg-white ps-9 pe-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as ServiceCategory | "all")}
            className="h-9 rounded-lg border border-border bg-white px-3 text-sm"
          >
            <option value="all">{isAr ? "جميع الخدمات" : "All Services"}</option>
            {SERVICE_CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {categoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-start font-medium">ID</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "الخدمة" : "Service"}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "العميل" : "Customer"}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "التفاصيل" : "Details"}</th>
                <th className="px-3 py-2.5 text-end font-medium">{isAr ? "المبلغ" : "Amount"}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "الحالة" : "Status"}</th>
                <th className="px-3 py-2.5 text-start font-medium">{isAr ? "التاريخ" : "Date"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredBookings.map((b) => {
                const catInfo = SERVICE_CATEGORIES.find((c) => c.id === b.category);
                const IconComp = ICONS[catInfo?.icon ?? ""] ?? Globe;
                return (
                  <tr key={b.id} className="transition-colors hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 font-medium text-finance">{b.id}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <IconComp className={`h-4 w-4 ${catInfo?.color ?? ""}`} />
                        <span className="text-xs font-medium">{catInfo ? categoryLabel(catInfo) : b.category}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-finance">{b.customerName}</td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{getBookingDetail(b, isAr)}</td>
                    <td className="px-3 py-2.5 text-end font-semibold text-finance">
                      {formatCurrency(b.totalAmount, locale, b.currency)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[b.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {b.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">{formatDate(b.createdAt, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredBookings.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">{isAr ? "لا توجد نتائج" : "No bookings found"}</p>
          )}
        </div>
      </ErpSection>
    </ErpPageLayout>
  );
}

function getBookingDetail(b: AnyServiceBooking, isAr: boolean): string {
  switch (b.category) {
    case "hotel":
      return `${b.hotelName}, ${b.city} · ${b.nights} ${isAr ? "ليالي" : "nights"}`;
    case "car_rental":
      return `${b.vehicleModel} · ${b.days} ${isAr ? "أيام" : "days"}`;
    case "visa":
      return `${b.destinationCountry} · ${b.visaType}`;
    case "insurance":
      return `${b.planName} · ${b.travelers} ${isAr ? "مسافر" : "travelers"}`;
    case "tour":
      return `${b.tourName} · ${b.destination}`;
    case "transfer":
      return `${b.pickupLocation} → ${b.dropoffLocation}`;
    default:
      return "";
  }
}
