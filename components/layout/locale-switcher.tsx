"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/utils/cn";

const locales = ["en", "ar"] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <div className="inline-flex rounded-md border border-border bg-white p-1">
      {locales.map((item) => (
        <Link
          key={item}
          href={pathname}
          locale={item}
          className={cn(
            "rounded px-2 py-1 text-xs font-semibold transition",
            locale === item
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-slate-100",
          )}
        >
          {item.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
