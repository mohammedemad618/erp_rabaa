"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/utils/cn";

const locales = ["en", "ar"] as const;

function replacePathLocale(path: string, targetLocale: (typeof locales)[number]): string {
  return path.replace(/^\/(en|ar)(?=\/|$)/, `/${targetLocale}`);
}

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  function buildHref(targetLocale: (typeof locales)[number]): string {
    const rawSearch = typeof window === "undefined" ? "" : window.location.search;
    const params = new URLSearchParams(
      rawSearch.startsWith("?") ? rawSearch.slice(1) : rawSearch,
    );
    const nextPath = params.get("next");

    if (nextPath && nextPath.startsWith("/")) {
      params.set("next", replacePathLocale(nextPath, targetLocale));
    }

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <div className="inline-flex rounded-md border border-border bg-white p-1">
      {locales.map((item) => (
        <Link
          key={item}
          href={buildHref(item)}
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
