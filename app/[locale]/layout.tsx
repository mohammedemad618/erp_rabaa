import { AppShell } from "@/components/layout/app-shell";
import { SettingsBootstrap } from "@/components/layout/settings-bootstrap";
import { routing } from "@/i18n/routing";
import { cn } from "@/utils/cn";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div
        dir={direction}
        lang={locale}
        className={cn("min-h-screen", locale === "ar" && "font-ar")}
      >
        <SettingsBootstrap locale={locale} />
        <AppShell>{children}</AppShell>
      </div>
    </NextIntlClientProvider>
  );
}
