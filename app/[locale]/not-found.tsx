"use client";

import { Plane, ArrowLeft, Home } from "lucide-react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const locale = useLocale();
  const isAr = locale === "ar";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg shadow-blue-100/50">
          <Plane className="h-10 w-10 text-primary" />
        </div>
        <span className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-600 shadow-md">
          404
        </span>
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-finance">
        {isAr ? "الصفحة غير موجودة" : "Page Not Found"}
      </h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        {isAr
          ? "الصفحة التي تبحث عنها غير موجودة أو تم نقلها. تحقق من الرابط أو ارجع إلى لوحة التحكم."
          : "The page you're looking for doesn't exist or has been moved. Check the URL or head back to the dashboard."}
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-blue-700"
        >
          <Home className="h-4 w-4" />
          {isAr ? "لوحة التحكم" : "Dashboard"}
        </Link>
        <button
          onClick={() => window.history.back()}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-white px-5 text-sm font-semibold text-finance shadow-sm transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          {isAr ? "رجوع" : "Go Back"}
        </button>
      </div>
    </div>
  );
}
