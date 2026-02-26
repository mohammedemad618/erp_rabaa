"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ServiceCategory } from "../types";

interface BookingFormProps {
  category: ServiceCategory;
  isAr: boolean;
  onSubmit: (data: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}

const CATEGORY_FIELDS: Record<ServiceCategory, Array<{ key: string; labelEn: string; labelAr: string; type?: string; required?: boolean }>> = {
  hotel: [
    { key: "customerName", labelEn: "Guest Name", labelAr: "اسم الضيف", required: true },
    { key: "customerPhone", labelEn: "Phone", labelAr: "الهاتف", required: true },
    { key: "customerEmail", labelEn: "Email", labelAr: "البريد", type: "email", required: true },
    { key: "hotelName", labelEn: "Hotel Name", labelAr: "اسم الفندق", required: true },
    { key: "city", labelEn: "City", labelAr: "المدينة", required: true },
    { key: "country", labelEn: "Country", labelAr: "الدولة", required: true },
    { key: "roomType", labelEn: "Room Type", labelAr: "نوع الغرفة", required: true },
    { key: "checkIn", labelEn: "Check-in", labelAr: "تسجيل الدخول", type: "date", required: true },
    { key: "checkOut", labelEn: "Check-out", labelAr: "تسجيل الخروج", type: "date", required: true },
    { key: "guests", labelEn: "Guests", labelAr: "عدد الضيوف", type: "number" },
    { key: "totalAmount", labelEn: "Total (SAR)", labelAr: "المبلغ (ر.س.)", type: "number", required: true },
    { key: "notes", labelEn: "Notes", labelAr: "ملاحظات" },
  ],
  car_rental: [
    { key: "customerName", labelEn: "Customer Name", labelAr: "اسم العميل", required: true },
    { key: "customerPhone", labelEn: "Phone", labelAr: "الهاتف", required: true },
    { key: "customerEmail", labelEn: "Email", labelAr: "البريد", type: "email", required: true },
    { key: "provider", labelEn: "Provider", labelAr: "المزود", required: true },
    { key: "vehicleModel", labelEn: "Vehicle Model", labelAr: "نوع المركبة", required: true },
    { key: "pickupLocation", labelEn: "Pickup Location", labelAr: "موقع الاستلام", required: true },
    { key: "dropoffLocation", labelEn: "Dropoff Location", labelAr: "موقع التسليم", required: true },
    { key: "pickupDate", labelEn: "Pickup Date", labelAr: "تاريخ الاستلام", type: "date", required: true },
    { key: "dropoffDate", labelEn: "Dropoff Date", labelAr: "تاريخ التسليم", type: "date", required: true },
    { key: "totalAmount", labelEn: "Total (SAR)", labelAr: "المبلغ (ر.س.)", type: "number", required: true },
    { key: "notes", labelEn: "Notes", labelAr: "ملاحظات" },
  ],
  visa: [
    { key: "customerName", labelEn: "Applicant Name", labelAr: "اسم المتقدم", required: true },
    { key: "customerPhone", labelEn: "Phone", labelAr: "الهاتف", required: true },
    { key: "customerEmail", labelEn: "Email", labelAr: "البريد", type: "email", required: true },
    { key: "destinationCountry", labelEn: "Destination Country", labelAr: "دولة الوجهة", required: true },
    { key: "passportNumber", labelEn: "Passport Number", labelAr: "رقم الجواز", required: true },
    { key: "embassy", labelEn: "Embassy", labelAr: "السفارة", required: true },
    { key: "totalAmount", labelEn: "Service Fee (SAR)", labelAr: "رسوم الخدمة (ر.س.)", type: "number", required: true },
    { key: "notes", labelEn: "Notes", labelAr: "ملاحظات" },
  ],
  insurance: [
    { key: "customerName", labelEn: "Traveler Name", labelAr: "اسم المسافر", required: true },
    { key: "customerPhone", labelEn: "Phone", labelAr: "الهاتف", required: true },
    { key: "customerEmail", labelEn: "Email", labelAr: "البريد", type: "email", required: true },
    { key: "provider", labelEn: "Insurance Provider", labelAr: "شركة التأمين", required: true },
    { key: "planName", labelEn: "Plan Name", labelAr: "اسم الخطة", required: true },
    { key: "startDate", labelEn: "Start Date", labelAr: "تاريخ البداية", type: "date", required: true },
    { key: "endDate", labelEn: "End Date", labelAr: "تاريخ النهاية", type: "date", required: true },
    { key: "travelers", labelEn: "Number of Travelers", labelAr: "عدد المسافرين", type: "number" },
    { key: "totalAmount", labelEn: "Premium (SAR)", labelAr: "القسط (ر.س.)", type: "number", required: true },
    { key: "notes", labelEn: "Notes", labelAr: "ملاحظات" },
  ],
  tour: [
    { key: "customerName", labelEn: "Customer Name", labelAr: "اسم العميل", required: true },
    { key: "customerPhone", labelEn: "Phone", labelAr: "الهاتف", required: true },
    { key: "customerEmail", labelEn: "Email", labelAr: "البريد", type: "email", required: true },
    { key: "tourName", labelEn: "Tour Name", labelAr: "اسم الرحلة", required: true },
    { key: "destination", labelEn: "Destination", labelAr: "الوجهة", required: true },
    { key: "startDate", labelEn: "Start Date", labelAr: "تاريخ البداية", type: "date", required: true },
    { key: "endDate", labelEn: "End Date", labelAr: "تاريخ النهاية", type: "date", required: true },
    { key: "groupSize", labelEn: "Group Size", labelAr: "حجم المجموعة", type: "number" },
    { key: "totalAmount", labelEn: "Package Price (SAR)", labelAr: "سعر الباقة (ر.س.)", type: "number", required: true },
    { key: "notes", labelEn: "Notes", labelAr: "ملاحظات" },
  ],
  transfer: [
    { key: "customerName", labelEn: "Passenger Name", labelAr: "اسم الراكب", required: true },
    { key: "customerPhone", labelEn: "Phone", labelAr: "الهاتف", required: true },
    { key: "customerEmail", labelEn: "Email", labelAr: "البريد", type: "email", required: true },
    { key: "pickupLocation", labelEn: "Pickup Location", labelAr: "موقع الاستلام", required: true },
    { key: "dropoffLocation", labelEn: "Dropoff Location", labelAr: "موقع التوصيل", required: true },
    { key: "pickupDateTime", labelEn: "Pickup Date & Time", labelAr: "تاريخ ووقت الاستلام", type: "datetime-local", required: true },
    { key: "passengers", labelEn: "Passengers", labelAr: "عدد الركاب", type: "number" },
    { key: "flightNumber", labelEn: "Flight Number", labelAr: "رقم الرحلة" },
    { key: "totalAmount", labelEn: "Total (SAR)", labelAr: "المبلغ (ر.س.)", type: "number", required: true },
    { key: "notes", labelEn: "Notes", labelAr: "ملاحظات" },
  ],
};

export function BookingForm({ category, isAr, onSubmit, onCancel }: BookingFormProps) {
  const fields = CATEGORY_FIELDS[category];
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  }

  const isTextarea = (key: string) => key === "notes";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const label = isAr ? field.labelAr : field.labelEn;
          const placeholder = label;
          if (isTextarea(field.key)) {
            return (
              <FormField
                key={field.key}
                label={label}
                required={field.required}
                fullWidth
                className="sm:col-span-2"
              >
                <Textarea
                  value={formData[field.key] ?? ""}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  required={field.required}
                  placeholder={placeholder}
                  rows={3}
                />
              </FormField>
            );
          }
          return (
            <FormField key={field.key} label={label} required={field.required}>
              <Input
                type={(field.type ?? "text") as "text" | "email" | "number" | "date" | "datetime-local"}
                value={formData[field.key] ?? ""}
                onChange={(e) => updateField(field.key, e.target.value)}
                required={field.required}
                placeholder={placeholder}
              />
            </FormField>
          );
        })}
      </div>
      <div className="flex gap-2 pt-2">
        <Button type="submit" loading={isSubmitting} className="flex-1">
          {isAr ? "إنشاء الحجز" : "Create Booking"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          {isAr ? "إلغاء" : "Cancel"}
        </Button>
      </div>
    </form>
  );
}
