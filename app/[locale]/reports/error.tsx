"use client";

import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";

interface ReportsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ReportsError({ error: _error, reset }: ReportsErrorProps) {
  void _error;
  const locale = useLocale();
  const isAr = locale === "ar";

  return (
    <section className="surface-card mx-auto mt-6 max-w-2xl p-6">
      <h2 className="text-lg font-bold text-finance">
        {isAr ? "تعذر تحميل التقارير" : "Unable to load reports"}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isAr
          ? "حدث خطأ أثناء تحميل لوحة التقارير. حاول إعادة المحاولة."
          : "An error occurred while loading the reports workspace. Please retry."}
      </p>
      <div className="mt-4">
        <Button type="button" onClick={reset}>
          {isAr ? "إعادة المحاولة" : "Try again"}
        </Button>
      </div>
    </section>
  );
}
