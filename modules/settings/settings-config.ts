export type DefaultLanding = "dashboard" | "transactions" | "ocr";
export type LanguagePreference = "auto" | "ar" | "en";
export type NumberFormat = "regional" | "intl";
export type DisplayCurrency = "SAR" | "USD" | "EUR" | "AED" | "IQD";
export type ExchangeRateMap = Record<DisplayCurrency, number>;

export interface PrototypeSettings {
  compactTable: boolean;
  highContrast: boolean;
  autoSaveDraft: boolean;
  defaultLanding: DefaultLanding;
  languagePreference: LanguagePreference;
  numberFormat: NumberFormat;
  displayCurrency: DisplayCurrency;
  exchangeRates: ExchangeRateMap;
  exchangeRateUpdatedAt: string;
}

export const SETTINGS_STORAGE_KEY = "enterprise-travel-erp.settings.v1";
export const SETTINGS_CHANGED_EVENT = "enterprise-travel-erp.settings.changed";
export const DISPLAY_CURRENCY_COOKIE_KEY = "enterprise_travel_erp_display_currency";
export const EXCHANGE_RATES_COOKIE_KEY = "enterprise_travel_erp_fx_rates";

const displayCurrencies: DisplayCurrency[] = ["SAR", "USD", "EUR", "AED", "IQD"];

const defaultLandingValues = new Set<DefaultLanding>([
  "dashboard",
  "transactions",
  "ocr",
]);
const languagePreferenceValues = new Set<LanguagePreference>(["auto", "ar", "en"]);
const numberFormatValues = new Set<NumberFormat>(["regional", "intl"]);
const displayCurrencyValues = new Set<DisplayCurrency>([
  "SAR",
  "USD",
  "EUR",
  "AED",
  "IQD",
]);

export const DEFAULT_EXCHANGE_RATES: ExchangeRateMap = {
  SAR: 1,
  USD: 3.75,
  EUR: 4.05,
  AED: 1.02,
  IQD: 0.00287,
};

export const DEFAULT_SETTINGS: PrototypeSettings = {
  compactTable: false,
  highContrast: false,
  autoSaveDraft: true,
  defaultLanding: "dashboard",
  languagePreference: "auto",
  numberFormat: "regional",
  displayCurrency: "SAR",
  exchangeRates: { ...DEFAULT_EXCHANGE_RATES },
  exchangeRateUpdatedAt: "",
};

export function normalizeExchangeRates(input?: Partial<ExchangeRateMap> | null): ExchangeRateMap {
  const next: ExchangeRateMap = { ...DEFAULT_EXCHANGE_RATES };
  if (!input) {
    return next;
  }

  for (const currency of displayCurrencies) {
    const value = input[currency];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      next[currency] = Math.round(value * 1000000) / 1000000;
    }
  }
  next.SAR = 1;

  return next;
}

export function normalizeSettings(input?: Partial<PrototypeSettings> | null): PrototypeSettings {
  return {
    compactTable:
      typeof input?.compactTable === "boolean"
        ? input.compactTable
        : DEFAULT_SETTINGS.compactTable,
    highContrast:
      typeof input?.highContrast === "boolean"
        ? input.highContrast
        : DEFAULT_SETTINGS.highContrast,
    autoSaveDraft:
      typeof input?.autoSaveDraft === "boolean"
        ? input.autoSaveDraft
        : DEFAULT_SETTINGS.autoSaveDraft,
    defaultLanding: defaultLandingValues.has(input?.defaultLanding as DefaultLanding)
      ? (input?.defaultLanding as DefaultLanding)
      : DEFAULT_SETTINGS.defaultLanding,
    languagePreference: languagePreferenceValues.has(
      input?.languagePreference as LanguagePreference,
    )
      ? (input?.languagePreference as LanguagePreference)
      : DEFAULT_SETTINGS.languagePreference,
    numberFormat: numberFormatValues.has(input?.numberFormat as NumberFormat)
      ? (input?.numberFormat as NumberFormat)
      : DEFAULT_SETTINGS.numberFormat,
    displayCurrency: displayCurrencyValues.has(input?.displayCurrency as DisplayCurrency)
      ? (input?.displayCurrency as DisplayCurrency)
      : DEFAULT_SETTINGS.displayCurrency,
    exchangeRates: normalizeExchangeRates(input?.exchangeRates),
    exchangeRateUpdatedAt:
      typeof input?.exchangeRateUpdatedAt === "string"
        ? input.exchangeRateUpdatedAt
        : DEFAULT_SETTINGS.exchangeRateUpdatedAt,
  };
}

export function serializeExchangeRates(rates: ExchangeRateMap): string {
  return displayCurrencies.map((currency) => `${currency}:${rates[currency]}`).join("|");
}

export function deserializeExchangeRates(raw?: string | null): ExchangeRateMap | null {
  if (!raw) {
    return null;
  }

  const partial: Partial<ExchangeRateMap> = {};
  for (const pair of raw.split("|")) {
    const [currencyRaw, valueRaw] = pair.split(":");
    if (!currencyRaw || !valueRaw) {
      continue;
    }
    const currency = currencyRaw.toUpperCase() as DisplayCurrency;
    const parsed = Number(valueRaw);
    if (displayCurrencyValues.has(currency) && Number.isFinite(parsed) && parsed > 0) {
      partial[currency] = parsed;
    }
  }

  return normalizeExchangeRates(partial);
}

export function readStoredSettings(): PrototypeSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<PrototypeSettings>;
    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeStoredSettings(settings: PrototypeSettings): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function clearStoredSettings(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
}

export function dispatchSettingsChanged(settings: PrototypeSettings): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<PrototypeSettings>(SETTINGS_CHANGED_EVENT, { detail: settings }),
  );
}

export function areSettingsEqual(
  left: PrototypeSettings,
  right: PrototypeSettings,
): boolean {
  return (
    left.compactTable === right.compactTable &&
    left.highContrast === right.highContrast &&
    left.autoSaveDraft === right.autoSaveDraft &&
    left.defaultLanding === right.defaultLanding &&
    left.languagePreference === right.languagePreference &&
    left.numberFormat === right.numberFormat &&
    left.displayCurrency === right.displayCurrency &&
    left.exchangeRateUpdatedAt === right.exchangeRateUpdatedAt &&
    displayCurrencies.every(
      (currency) => left.exchangeRates[currency] === right.exchangeRates[currency],
    )
  );
}
