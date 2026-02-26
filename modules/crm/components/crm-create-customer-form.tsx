"use client";

import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CustomerPayload {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

type SegmentValue = "starter" | "growth" | "strategic";

const DEFAULT_SEGMENT: SegmentValue = "starter";

function parseErrorMessage(payload: unknown, fallbackMessage: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof (payload as { message?: unknown }).message === "string"
  ) {
    return (payload as { message: string }).message;
  }
  return fallbackMessage;
}

function isCreatedCustomerPayload(payload: unknown): payload is CustomerPayload {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      typeof (payload as { id?: unknown }).id === "string" &&
      typeof (payload as { name?: unknown }).name === "string",
  );
}

export function CrmCreateCustomerForm() {
  const locale = useLocale();
  const router = useRouter();
  const isAr = locale === "ar";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [segment, setSegment] = useState<SegmentValue>(DEFAULT_SEGMENT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const segmentOptions = useMemo(
    () =>
      isAr
        ? [
            { value: "starter", label: "بداية" },
            { value: "growth", label: "نمو" },
            { value: "strategic", label: "استراتيجي" },
          ]
        : [
            { value: "starter", label: "Starter" },
            { value: "growth", label: "Growth" },
            { value: "strategic", label: "Strategic" },
          ],
    [isAr],
  );

  async function verifyCustomerPersistence(created: CustomerPayload): Promise<boolean> {
    try {
      const query = created.email || created.phone || created.name;
      const response = await fetch(
        `/api/customers/search?q=${encodeURIComponent(query)}&limit=25`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        return false;
      }
      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) {
        return false;
      }
      return payload.some(
        (item) =>
          item &&
          typeof item === "object" &&
          "id" in item &&
          (item as { id?: unknown }).id === created.id,
      );
    } catch {
      return false;
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setNotice({
        tone: "error",
        message: isAr ? "الاسم والهاتف والبريد الإلكتروني مطلوبة." : "Name, phone, and email are required.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          segment,
        }),
      });

      const raw = await response.text();
      const payload = raw ? (JSON.parse(raw) as unknown) : null;

      if (!response.ok) {
        setNotice({
          tone: "error",
          message: parseErrorMessage(
            payload,
            isAr ? "تعذّر إنشاء العميل." : "Unable to create customer.",
          ),
        });
        return;
      }

      if (!isCreatedCustomerPayload(payload)) {
        setNotice({
          tone: "error",
          message: isAr ? "استجابة الخادم غير صالحة بعد إنشاء العميل." : "Server returned an invalid customer payload.",
        });
        return;
      }

      const created = payload;
      const isPersisted = await verifyCustomerPersistence(created);
      if (!isPersisted) {
        setNotice({
          tone: "error",
          message: isAr
            ? "تعذر التحقق من حفظ العميل في قاعدة البيانات. يرجى المحاولة مرة أخرى."
            : "Unable to verify customer persistence. Please try again.",
        });
        return;
      }

      setNotice({
        tone: "success",
        message: isAr
          ? `تم إنشاء العميل بنجاح: ${created.name}`
          : `Customer created successfully: ${created.name}`,
      });
      window.setTimeout(() => {
        router.push(`/crm?created=${encodeURIComponent(created.id)}`);
      }, 700);
    } catch {
      setNotice({
        tone: "error",
        message: isAr ? "حدث خطأ غير متوقع أثناء إنشاء العميل." : "Unexpected error while creating customer.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="surface-card col-span-12 p-6">
      {notice ? (
        <p
          className={`mb-4 rounded-md px-3 py-2 text-xs ${
            notice.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
          }`}
        >
          {notice.message}
        </p>
      ) : null}
      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {isAr ? "اسم العميل" : "Customer Name"}
          </span>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={isAr ? "مثال: شركة الأفق" : "Example: Horizon Corp"} />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {isAr ? "رقم الهاتف" : "Phone Number"}
          </span>
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+966500000000" />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {isAr ? "البريد الإلكتروني" : "Email"}
          </span>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="customer@company.com" />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-medium text-muted-foreground">
            {isAr ? "تصنيف العميل" : "Customer Segment"}
          </span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/70"
            value={segment}
            onChange={(event) => setSegment(event.target.value as SegmentValue)}
          >
            {segmentOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="col-span-2 flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push("/crm")}
            disabled={isSubmitting}
          >
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isAr ? "إنشاء العميل" : "Create Customer"}
          </Button>
        </div>
      </form>
    </section>
  );
}
