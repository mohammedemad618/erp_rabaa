"use client";

import { useEffect } from "react";
import {
  DEFAULT_SETTINGS,
  dispatchSettingsChanged,
  DISPLAY_CURRENCY_COOKIE_KEY,
  EXCHANGE_RATES_COOKIE_KEY,
  readStoredSettings,
  serializeExchangeRates,
  SETTINGS_CHANGED_EVENT,
  SETTINGS_STORAGE_KEY,
  type PrototypeSettings,
} from "@/modules/settings/settings-config";

interface SettingsBootstrapProps {
  locale: string;
}

const landingPath: Record<PrototypeSettings["defaultLanding"], string> = {
  dashboard: "",
  transactions: "/transactions",
  ocr: "/ocr",
};

function isSupportedLocale(value: string): value is "en" | "ar" {
  return value === "en" || value === "ar";
}

function applySettingsToDocument(settings: PrototypeSettings): void {
  document.documentElement.dataset.tableDensity = settings.compactTable
    ? "compact"
    : "default";
  document.documentElement.dataset.contrastMode = settings.highContrast
    ? "high"
    : "normal";
  document.documentElement.dataset.numberFormat = settings.numberFormat;
  document.documentElement.dataset.displayCurrency = settings.displayCurrency;
  document.documentElement.dataset.exchangeRates = serializeExchangeRates(
    settings.exchangeRates,
  );
  document.cookie = `${DISPLAY_CURRENCY_COOKIE_KEY}=${settings.displayCurrency}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.cookie = `${EXCHANGE_RATES_COOKIE_KEY}=${encodeURIComponent(serializeExchangeRates(settings.exchangeRates))}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function navigateIfNeeded(
  locale: string,
  settings: PrototypeSettings,
  currentPath: string,
): void {
  const current = isSupportedLocale(locale) ? locale : "en";
  const activePreferredLocale =
    settings.languagePreference === "auto"
      ? current
      : isSupportedLocale(settings.languagePreference)
        ? settings.languagePreference
        : current;

  if (activePreferredLocale !== current) {
    const segments = currentPath.split("/");
    segments[1] = activePreferredLocale;
    const target = segments.join("/");
    if (target !== currentPath) {
      window.location.replace(`${target}${window.location.search}${window.location.hash}`);
    }
    return;
  }

  if (currentPath === `/${current}` || currentPath === `/${current}/`) {
    const suffix = landingPath[settings.defaultLanding] ?? "";
    const target = `/${current}${suffix}`;
    if (target !== currentPath) {
      window.location.replace(`${target}${window.location.search}${window.location.hash}`);
    }
  }
}

export function SettingsBootstrap({ locale }: SettingsBootstrapProps) {
  useEffect(() => {
    const applyRuntimePreferences = (settings: PrototypeSettings) => {
      applySettingsToDocument(settings);
      navigateIfNeeded(locale, settings, window.location.pathname);
    };

    const initialSettings = readStoredSettings();
    applyRuntimePreferences(initialSettings);
    dispatchSettingsChanged(initialSettings);

    const handleSettingsChanged = (event: Event) => {
      const payload = (event as CustomEvent<PrototypeSettings>).detail;
      applyRuntimePreferences(payload ?? DEFAULT_SETTINGS);
    };

    const handleStorageChanged = (event: StorageEvent) => {
      if (event.key !== SETTINGS_STORAGE_KEY) {
        return;
      }
      applyRuntimePreferences(readStoredSettings());
    };

    window.addEventListener(SETTINGS_CHANGED_EVENT, handleSettingsChanged as EventListener);
    window.addEventListener("storage", handleStorageChanged);

    return () => {
      window.removeEventListener(
        SETTINGS_CHANGED_EVENT,
        handleSettingsChanged as EventListener,
      );
      window.removeEventListener("storage", handleStorageChanged);
    };
  }, [locale]);

  return null;
}
