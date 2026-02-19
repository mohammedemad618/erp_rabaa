"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  areSettingsEqual,
  clearStoredSettings,
  DEFAULT_EXCHANGE_RATES,
  DEFAULT_SETTINGS,
  DISPLAY_CURRENCY_COOKIE_KEY,
  EXCHANGE_RATES_COOKIE_KEY,
  dispatchSettingsChanged,
  normalizeExchangeRates,
  readStoredSettings,
  serializeExchangeRates,
  type PrototypeSettings,
  writeStoredSettings,
} from "../settings-config";

const editableExchangeCurrencies: Array<
  Exclude<PrototypeSettings["displayCurrency"], "SAR">
> = ["USD", "EUR", "AED", "IQD"];
const exchangeCurrencyOptionKey = {
  USD: "options.usd",
  EUR: "options.eur",
  AED: "options.aed",
  IQD: "options.iqd",
} as const;

function haveExchangeRatesChanged(
  left: PrototypeSettings["exchangeRates"],
  right: PrototypeSettings["exchangeRates"],
): boolean {
  return editableExchangeCurrencies.some((currency) => left[currency] !== right[currency]);
}

function formatExchangeRateTimestamp(timestamp: string, locale: string): string {
  if (!timestamp) {
    return "";
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function SettingsConsole() {
  const tSettings = useTranslations("settingsModule");
  const locale = useLocale();
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [settings, setSettings] = useState<PrototypeSettings>(() => readStoredSettings());
  const [savedSettings, setSavedSettings] = useState<PrototypeSettings>(() =>
    readStoredSettings(),
  );
  const [notice, setNotice] = useState("");
  const hasChanges = !areSettingsEqual(settings, savedSettings);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    };
  }, []);

  function notify(message: string): void {
    setNotice(message);
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => setNotice(""), 2200);
  }

  function saveSettings(): void {
    try {
      const normalizedRates = normalizeExchangeRates(settings.exchangeRates);
      const ratesChanged = haveExchangeRatesChanged(normalizedRates, savedSettings.exchangeRates);
      const nextSettings: PrototypeSettings = {
        ...settings,
        exchangeRates: normalizedRates,
        exchangeRateUpdatedAt: ratesChanged
          ? new Date().toISOString()
          : settings.exchangeRateUpdatedAt,
      };

      writeStoredSettings(nextSettings);
      document.cookie = `${DISPLAY_CURRENCY_COOKIE_KEY}=${nextSettings.displayCurrency}; Path=/; Max-Age=31536000; SameSite=Lax`;
      document.cookie = `${EXCHANGE_RATES_COOKIE_KEY}=${encodeURIComponent(serializeExchangeRates(nextSettings.exchangeRates))}; Path=/; Max-Age=31536000; SameSite=Lax`;
      dispatchSettingsChanged(nextSettings);
      setSettings(nextSettings);
      setSavedSettings(nextSettings);
      notify(tSettings("messages.saved"));
    } catch {
      notify(tSettings("messages.saveFailed"));
    }
  }

  function resetExchangeRates(): void {
    setSettings((previous) => ({
      ...previous,
      exchangeRates: { ...DEFAULT_EXCHANGE_RATES },
      exchangeRateUpdatedAt: "",
    }));
    notify(tSettings("messages.ratesReset"));
  }

  function resetSettings(): void {
    setSettings(DEFAULT_SETTINGS);
    setSavedSettings(DEFAULT_SETTINGS);
    try {
      clearStoredSettings();
      document.cookie = `${DISPLAY_CURRENCY_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
      document.cookie = `${EXCHANGE_RATES_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
      dispatchSettingsChanged(DEFAULT_SETTINGS);
    } catch {
      return;
    }
    notify(tSettings("messages.reset"));
  }

  const exchangeRateUpdatedAt = formatExchangeRateTimestamp(
    settings.exchangeRateUpdatedAt,
    locale,
  );

  return (
    <section className="space-y-4">
      <header className="surface-card p-6">
        <h2 className="text-2xl font-bold text-finance">{tSettings("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tSettings("subtitle")}</p>
        {hasChanges ? (
          <p className="mt-2 text-xs text-warning">{tSettings("messages.unsaved")}</p>
        ) : null}
        {notice ? (
          <p className="mt-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-finance">
            {notice}
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="surface-card p-4">
          <h3 className="text-sm font-semibold text-finance">
            {tSettings("sections.preferences")}
          </h3>
          <div className="mt-3 space-y-2">
            <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span>{tSettings("fields.compactTable")}</span>
              <input
                type="checkbox"
                checked={settings.compactTable}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    compactTable: event.target.checked,
                  }))
                }
              />
            </label>

            <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span>{tSettings("fields.highContrast")}</span>
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    highContrast: event.target.checked,
                  }))
                }
              />
            </label>

            <label className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <span>{tSettings("fields.autoSaveDraft")}</span>
              <input
                type="checkbox"
                checked={settings.autoSaveDraft}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    autoSaveDraft: event.target.checked,
                  }))
                }
              />
            </label>
          </div>
        </section>

        <section className="surface-card p-4">
          <h3 className="text-sm font-semibold text-finance">
            {tSettings("sections.workflow")}
          </h3>

          <div className="mt-3 grid gap-3">
            <label className="text-xs text-muted-foreground">
              {tSettings("fields.defaultLanding")}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {tSettings("hints.defaultLanding")}
              </p>
              <select
                value={settings.defaultLanding}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    defaultLanding: event.target.value as PrototypeSettings["defaultLanding"],
                  }))
                }
                className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
              >
                <option value="dashboard">{tSettings("options.dashboard")}</option>
                <option value="transactions">{tSettings("options.transactions")}</option>
                <option value="ocr">{tSettings("options.ocr")}</option>
              </select>
            </label>

            <label className="text-xs text-muted-foreground">
              {tSettings("fields.languagePreference")}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {tSettings("hints.languagePreference")}
              </p>
              <select
                value={settings.languagePreference}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    languagePreference:
                      event.target.value as PrototypeSettings["languagePreference"],
                  }))
                }
                className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
              >
                <option value="auto">{tSettings("options.auto")}</option>
                <option value="ar">{tSettings("options.ar")}</option>
                <option value="en">{tSettings("options.en")}</option>
              </select>
            </label>

            <label className="text-xs text-muted-foreground">
              {tSettings("fields.numberFormat")}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {tSettings("hints.numberFormat")}
              </p>
              <select
                value={settings.numberFormat}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    numberFormat: event.target.value as PrototypeSettings["numberFormat"],
                  }))
                }
                className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
              >
                <option value="regional">{tSettings("options.regional")}</option>
                <option value="intl">{tSettings("options.intl")}</option>
              </select>
            </label>

            <label className="text-xs text-muted-foreground">
              {tSettings("fields.displayCurrency")}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {tSettings("hints.displayCurrency")}
              </p>
              <select
                value={settings.displayCurrency}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    displayCurrency:
                      event.target.value as PrototypeSettings["displayCurrency"],
                  }))
                }
                className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
              >
                <option value="SAR">{tSettings("options.sar")}</option>
                <option value="USD">{tSettings("options.usd")}</option>
                <option value="EUR">{tSettings("options.eur")}</option>
                <option value="AED">{tSettings("options.aed")}</option>
                <option value="IQD">{tSettings("options.iqd")}</option>
              </select>
            </label>
          </div>
        </section>
      </div>

      <section className="surface-card p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-finance">
              {tSettings("sections.exchangeRates")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {tSettings("hints.exchangeRates")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {tSettings("fields.exchangeRateUpdatedAt")}:{" "}
              {exchangeRateUpdatedAt || tSettings("hints.exchangeRateUpdatedAtEmpty")}
            </p>
          </div>
          <Button variant="secondary" onClick={resetExchangeRates}>
            {tSettings("actions.resetRates")}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {editableExchangeCurrencies.map((currency) => (
            <label key={currency} className="text-xs text-muted-foreground">
              {tSettings(exchangeCurrencyOptionKey[currency])}
              <p className="mt-1 text-[11px] text-muted-foreground">
                {tSettings("hints.exchangeRateItem", { currency })}
              </p>
              <input
                type="number"
                min="0.000001"
                step="0.000001"
                value={settings.exchangeRates[currency]}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  if (!Number.isFinite(parsed) || parsed <= 0) {
                    return;
                  }
                  setSettings((previous) => ({
                    ...previous,
                    exchangeRates: {
                      ...previous.exchangeRates,
                      [currency]: Math.round(parsed * 1000000) / 1000000,
                    },
                  }));
                }}
                className="mt-1 h-9 w-full rounded-md border border-border bg-white px-3 text-sm text-foreground"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="surface-card flex items-center justify-end gap-2 p-4">
        <Button variant="secondary" onClick={resetSettings}>
          {tSettings("actions.reset")}
        </Button>
        <Button onClick={saveSettings} disabled={!hasChanges}>
          {tSettings("actions.save")}
        </Button>
      </section>
    </section>
  );
}
