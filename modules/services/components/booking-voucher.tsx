"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/utils/format";
import type { AnyServiceBooking } from "../types";
import { SERVICE_CATEGORIES } from "../types";

interface BookingVoucherProps {
  booking: AnyServiceBooking;
  locale: string;
}

export function BookingVoucher({ booking, locale }: BookingVoucherProps) {
  const isAr = locale === "ar";
  const catInfo = SERVICE_CATEGORIES.find((c) => c.id === booking.category);
  const details = getVoucherDetails(booking, isAr);

  function handlePrint() {
    const detailsHtml = details
      .map(
        (d) =>
          `<div class="row"><span class="row-label">${d.label}</span><span class="row-value">${d.value}</span></div>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html dir="${isAr ? "rtl" : "ltr"}" lang="${locale}">
<head>
  <meta charset="utf-8"/>
  <title>${booking.id} - Booking Voucher</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, sans-serif; color: #1e293b; padding: 32px; max-width: 700px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
    .brand { font-size: 22px; font-weight: 800; color: #2563eb; }
    .brand-sub { font-size: 11px; color: #64748b; margin-top: 4px; }
    .voucher-id { font-size: 16px; font-weight: 700; color: #1e293b; }
    .voucher-date { font-size: 11px; color: #64748b; margin-top: 4px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; background: #dcfce7; color: #166534; margin-top: 6px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 12px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px dotted #e2e8f0; font-size: 13px; }
    .row-label { color: #64748b; }
    .row-value { font-weight: 600; color: #1e293b; }
    .total-row { font-size: 18px; font-weight: 800; color: #1e293b; border-top: 2px solid #1e293b; padding-top: 10px; margin-top: 10px; display: flex; justify-content: space-between; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
    .notes { font-size: 12px; color: #475569; margin-top: 8px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">Rabea Al Ahlam</div>
      <div class="brand-sub">${isAr ? (catInfo?.labelAr ?? "") : (catInfo?.labelEn ?? "")}</div>
    </div>
    <div style="text-align: ${isAr ? "left" : "right"}">
      <div class="voucher-id">${booking.id}</div>
      <div class="voucher-date">${new Date(booking.createdAt).toLocaleDateString(isAr ? "ar-SA" : "en-US")}</div>
      <div class="status">${booking.status.replace(/_/g, " ").toUpperCase()}</div>
    </div>
  </div>
  <div class="section">
    <div class="section-title">${isAr ? "معلومات العميل" : "Customer Information"}</div>
    <div class="row"><span class="row-label">${isAr ? "الاسم" : "Name"}</span><span class="row-value">${booking.customerName}</span></div>
    <div class="row"><span class="row-label">${isAr ? "الهاتف" : "Phone"}</span><span class="row-value">${booking.customerPhone}</span></div>
    <div class="row"><span class="row-label">${isAr ? "البريد" : "Email"}</span><span class="row-value">${booking.customerEmail}</span></div>
  </div>
  <div class="section">
    <div class="section-title">${isAr ? "تفاصيل الحجز" : "Booking Details"}</div>
    ${detailsHtml}
  </div>
  <div class="total-row">
    <span>${isAr ? "الإجمالي" : "Total"}</span>
    <span>${formatCurrency(booking.totalAmount, locale, booking.currency)}</span>
  </div>
  ${booking.notes ? `<div class="section" style="margin-top:16px"><div class="section-title">${isAr ? "ملاحظات" : "Notes"}</div><p class="notes">${booking.notes}</p></div>` : ""}
  <div class="footer">Rabea Al Ahlam — Enterprise Travel ERP &middot; ${isAr ? "تم الإصدار" : "Generated"}: ${new Date().toLocaleString(isAr ? "ar-SA" : "en-US")}</div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  return (
    <Button size="sm" variant="outline" onClick={handlePrint} className="w-full">
      <Printer className="me-1.5 h-3.5 w-3.5" />
      {isAr ? "طباعة الإيصال" : "Print Voucher"}
    </Button>
  );
}

function getVoucherDetails(b: AnyServiceBooking, isAr: boolean): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = [];
  switch (b.category) {
    case "hotel":
      rows.push(
        { label: isAr ? "الفندق" : "Hotel", value: b.hotelName },
        { label: isAr ? "المدينة" : "City", value: `${b.city}, ${b.country}` },
        { label: isAr ? "نوع الغرفة" : "Room", value: b.roomType },
        { label: isAr ? "الدخول" : "Check-in", value: b.checkIn },
        { label: isAr ? "الخروج" : "Check-out", value: b.checkOut },
        { label: isAr ? "الليالي" : "Nights", value: String(b.nights) },
        { label: isAr ? "رقم التأكيد" : "Confirmation #", value: b.confirmationNumber },
      );
      break;
    case "car_rental":
      rows.push(
        { label: isAr ? "المزود" : "Provider", value: b.provider },
        { label: isAr ? "المركبة" : "Vehicle", value: b.vehicleModel },
        { label: isAr ? "الاستلام" : "Pickup", value: `${b.pickupLocation} — ${b.pickupDate}` },
        { label: isAr ? "التسليم" : "Return", value: `${b.dropoffLocation} — ${b.dropoffDate}` },
        { label: isAr ? "الأيام" : "Days", value: String(b.days) },
      );
      break;
    case "visa":
      rows.push(
        { label: isAr ? "الوجهة" : "Destination", value: b.destinationCountry },
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
        { label: isAr ? "الفترة" : "Period", value: `${b.startDate} → ${b.endDate}` },
        { label: isAr ? "المسافرون" : "Travelers", value: String(b.travelers) },
      );
      break;
    case "tour":
      rows.push(
        { label: isAr ? "الرحلة" : "Tour", value: b.tourName },
        { label: isAr ? "الوجهة" : "Destination", value: b.destination },
        { label: isAr ? "المدة" : "Duration", value: b.duration },
        { label: isAr ? "المجموعة" : "Group Size", value: String(b.groupSize) },
      );
      break;
    case "transfer":
      rows.push(
        { label: isAr ? "من" : "From", value: b.pickupLocation },
        { label: isAr ? "إلى" : "To", value: b.dropoffLocation },
        { label: isAr ? "التاريخ" : "Date/Time", value: b.pickupDateTime },
        { label: isAr ? "الركاب" : "Passengers", value: String(b.passengers) },
        { label: isAr ? "رقم الرحلة" : "Flight", value: b.flightNumber || "—" },
        { label: isAr ? "السائق" : "Driver", value: `${b.driverName} (${b.driverPhone})` },
      );
      break;
  }
  return rows;
}
