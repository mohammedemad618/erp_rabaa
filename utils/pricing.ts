import {
  DEFAULT_EXCHANGE_RATES,
  normalizeExchangeRates,
  type DisplayCurrency,
  type ExchangeRateMap,
} from "@/modules/settings/settings-config";

export interface PricingLineItem {
  cost: number;
  currency: string;
}

export interface PricingTotalOptions {
  targetCurrency?: string;
  exchangeRates?: Partial<ExchangeRateMap> | null;
}

export interface PricingTotalResult {
  targetCurrency: string;
  total: number;
  convertedCount: number;
  skippedCount: number;
}

const SUPPORTED_CURRENCIES: DisplayCurrency[] = ["SAR", "USD", "EUR", "AED", "IQD"];
const SUPPORTED_CURRENCY_SET = new Set<DisplayCurrency>(SUPPORTED_CURRENCIES);

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeCurrencyCode(value: string): string {
  return value.trim().toUpperCase();
}

function asSupportedCurrency(value: string): DisplayCurrency | null {
  const normalized = normalizeCurrencyCode(value) as DisplayCurrency;
  return SUPPORTED_CURRENCY_SET.has(normalized) ? normalized : null;
}

export function convertPriceAmount(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string,
  exchangeRates?: Partial<ExchangeRateMap> | null,
): number | null {
  if (!Number.isFinite(amount)) {
    return null;
  }

  const sourceCode = normalizeCurrencyCode(sourceCurrency);
  const targetCode = normalizeCurrencyCode(targetCurrency);
  if (!sourceCode || !targetCode) {
    return null;
  }

  if (sourceCode === targetCode) {
    return roundMoney(amount);
  }

  const source = asSupportedCurrency(sourceCode);
  const target = asSupportedCurrency(targetCode);
  if (!source || !target) {
    return null;
  }

  const rates = normalizeExchangeRates(exchangeRates ?? DEFAULT_EXCHANGE_RATES);
  const sarValue = amount * rates[source];
  const converted = sarValue / rates[target];
  return roundMoney(converted);
}

export function calculateNormalizedTotal(
  items: readonly PricingLineItem[],
  options?: PricingTotalOptions,
): PricingTotalResult {
  const targetCurrency = normalizeCurrencyCode(options?.targetCurrency ?? "SAR");
  let total = 0;
  let convertedCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    const converted = convertPriceAmount(
      item.cost,
      item.currency,
      targetCurrency,
      options?.exchangeRates,
    );
    if (converted === null) {
      skippedCount += 1;
      continue;
    }
    total += converted;
    convertedCount += 1;
  }

  return {
    targetCurrency,
    total: roundMoney(total),
    convertedCount,
    skippedCount,
  };
}
