import {
  DEFAULT_EXCHANGE_RATES,
  deserializeExchangeRates,
  normalizeExchangeRates,
  type DisplayCurrency,
  type ExchangeRateMap,
} from "@/modules/settings/settings-config";

const SUPPORTED_DISPLAY_CURRENCIES = Object.keys(
  DEFAULT_EXCHANGE_RATES,
) as DisplayCurrency[];
const SUPPORTED_DISPLAY_CURRENCY_SET = new Set<DisplayCurrency>(
  SUPPORTED_DISPLAY_CURRENCIES,
);

export interface CurrencyFormatOptions {
  displayCurrency?: string;
  exchangeRates?: Partial<Record<DisplayCurrency, number>>;
}

function asSupportedCurrency(value: string): DisplayCurrency | null {
  const code = value.toUpperCase() as DisplayCurrency;
  return SUPPORTED_DISPLAY_CURRENCY_SET.has(code) ? code : null;
}

function resolveRuntimeDisplayCurrency(): DisplayCurrency | null {
  if (typeof window === "undefined") {
    return null;
  }

  const datasetCode = asSupportedCurrency(
    document.documentElement.dataset.displayCurrency ?? "",
  );
  return datasetCode;
}

function safeDecodeUri(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveRuntimeExchangeRates(): ExchangeRateMap | null {
  if (typeof window === "undefined") {
    return null;
  }

  const datasetRatesRaw = document.documentElement.dataset.exchangeRates;
  if (datasetRatesRaw) {
    const datasetRates =
      deserializeExchangeRates(datasetRatesRaw) ??
      deserializeExchangeRates(safeDecodeUri(datasetRatesRaw));
    if (datasetRates) {
      return datasetRates;
    }
  }
  return null;
}

function convertCurrencyAmount(
  value: number,
  sourceCurrency: string,
  targetCurrency: string,
  exchangeRates: ExchangeRateMap,
): number | null {
  const source = asSupportedCurrency(sourceCurrency);
  const target = asSupportedCurrency(targetCurrency);
  if (!source || !target) {
    return null;
  }
  if (source === target) {
    return value;
  }

  const sarValue = value * exchangeRates[source];
  const converted = sarValue / exchangeRates[target];
  return Math.round(converted * 100) / 100;
}

function parseCurrencyFormatOptions(
  input?: string | CurrencyFormatOptions,
): CurrencyFormatOptions {
  if (!input) {
    return {};
  }
  if (typeof input === "string") {
    return { displayCurrency: input };
  }
  return input;
}

export function formatCurrency(
  value: number,
  locale: string,
  currency = "SAR",
  displayCurrencyOrOptions?: string | CurrencyFormatOptions,
): string {
  const options = parseCurrencyFormatOptions(displayCurrencyOrOptions);
  const sourceCurrency = currency.toUpperCase();
  const explicitTargetCurrency = asSupportedCurrency(options.displayCurrency ?? "");
  const runtimeTargetCurrency = explicitTargetCurrency ?? resolveRuntimeDisplayCurrency();
  const preferredTargetCurrency = runtimeTargetCurrency ?? sourceCurrency;
  const exchangeRates = normalizeExchangeRates(
    options.exchangeRates ?? resolveRuntimeExchangeRates() ?? DEFAULT_EXCHANGE_RATES,
  );
  const convertedValue = convertCurrencyAmount(
    value,
    sourceCurrency,
    preferredTargetCurrency,
    exchangeRates,
  );
  const finalCurrency = convertedValue === null ? sourceCurrency : preferredTargetCurrency;
  const finalValue = convertedValue === null ? value : convertedValue;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: finalCurrency,
      maximumFractionDigits: 2,
    }).format(finalValue);
  } catch {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: 2,
    }).format(finalValue);
  }
}

interface DateFormatOptions {
  includeTime?: boolean;
  fallback?: string;
}

function parseStrictIsoDate(value: string | null | undefined): Date | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const isIsoDateTime = /^\d{4}-\d{2}-\d{2}T/.test(trimmed);
  if (!isDateOnly && !isIsoDateTime) {
    return null;
  }
  const normalized = isDateOnly ? `${trimmed}T00:00:00Z` : trimmed;
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  return parsed;
}

export function formatDate(
  value: string | null | undefined,
  locale: string,
  options: DateFormatOptions = {},
): string {
  const parsed = parseStrictIsoDate(value);
  if (!parsed) {
    return options.fallback ?? "-";
  }

  const includeTime = options.includeTime ?? true;
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "UTC",
        }
      : {
          timeZone: "UTC",
        }),
  }).format(parsed);
}
