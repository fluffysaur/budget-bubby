/**
 * Multi-Currency & FX Conversion Engine for Budget Bubby.
 * Converts foreign currencies (VND, JPY, MYR, THB, USD, etc.) to Singapore Dollars (SGD).
 * Caches live rates (open.er-api.com) in localStorage with built-in offline fallback rates.
 */

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  defaultRatePerSGD: number; // 1 SGD = X foreign currency
  /** Symbols the bulk parser treats as this currency (e.g. RM, ₫). */
  aliases?: string[];
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬', defaultRatePerSGD: 1, aliases: ['S$'] },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾', defaultRatePerSGD: 3.32, aliases: ['RM'] },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳', defaultRatePerSGD: 18900, aliases: ['₫'] },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', defaultRatePerSGD: 115.5, aliases: ['¥', '円'] },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭', defaultRatePerSGD: 26.8, aliases: ['฿'] },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', defaultRatePerSGD: 0.76, aliases: ['US$'] },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', defaultRatePerSGD: 0.70, aliases: ['€'] },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', defaultRatePerSGD: 0.59, aliases: ['£'] },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷', defaultRatePerSGD: 1045, aliases: ['₩'] },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', flag: '🇹🇼', defaultRatePerSGD: 24.2, aliases: ['NT$'] },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺', defaultRatePerSGD: 1.16, aliases: ['A$'] },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩', defaultRatePerSGD: 12100, aliases: ['Rp'] },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', flag: '🇵🇭', defaultRatePerSGD: 43.5, aliases: ['₱'] },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳', defaultRatePerSGD: 5.48 },
];

/** Currencies shown and entered without decimals. */
export const ZERO_DECIMAL_CURRENCIES = ['VND', 'JPY', 'KRW', 'IDR'];

export function isZeroDecimalCurrency(code: string | null | undefined): boolean {
  return ZERO_DECIMAL_CURRENCIES.includes((code || '').toUpperCase());
}

const FX_CACHE_KEY = 'budget_bubby_fx_rates_v1';
const FX_CACHE_TIMESTAMP_KEY = 'budget_bubby_fx_timestamp_v1';
const FX_AS_OF_KEY = 'budget_bubby_fx_as_of_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Fired on window after fresh rates are cached. */
export const FX_RATES_UPDATED_EVENT = 'budget-bubby:fx-rates-updated';

function readStorage(key: string): string | null {
  try {
    return typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(key)
      : null;
  } catch {
    return null;
  }
}

export function getCachedRates(): Record<string, number> {
  const fallback: Record<string, number> = {};
  for (const c of SUPPORTED_CURRENCIES) {
    fallback[c.code] = c.defaultRatePerSGD;
  }

  const raw = readStorage(FX_CACHE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return { ...fallback, ...parsed };
    } catch (err) {
      console.debug('Failed to read FX cache:', err);
    }
  }

  return fallback;
}

export interface FxRateStatus {
  /** 'live': fetched within 24h. 'offline': older cache or built-in defaults. */
  source: 'live' | 'offline';
  /** When the provider last updated the rates, or null for built-in defaults. */
  asOf: Date | null;
}

export function getRateStatus(now: number = Date.now()): FxRateStatus {
  const fetchedAt = parseInt(readStorage(FX_CACHE_TIMESTAMP_KEY) || '', 10);
  const asOfMs = parseInt(readStorage(FX_AS_OF_KEY) || '', 10);
  const hasCache = !!readStorage(FX_CACHE_KEY);
  const isFresh = hasCache && !isNaN(fetchedAt) && now - fetchedAt < CACHE_TTL_MS;
  return {
    source: isFresh ? 'live' : 'offline',
    asOf: hasCache && !isNaN(asOfMs) ? new Date(asOfMs) : null,
  };
}

/** Changes whenever new rates are cached. Stable snapshot for useSyncExternalStore. */
export function getRatesVersion(): string {
  return readStorage(FX_CACHE_TIMESTAMP_KEY) || '';
}

let inFlight: Promise<Record<string, number>> | null = null;

/**
 * Fetch latest FX rates from open.er-api.com, at most once per 24h.
 * Falls back to cached or built-in rates and never throws.
 */
export function refreshExchangeRates(): Promise<Record<string, number>> {
  if (typeof window === 'undefined' || !window.fetch) {
    return Promise.resolve(getCachedRates());
  }
  if (getRateStatus().source === 'live') {
    return Promise.resolve(getCachedRates());
  }
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/SGD');
      if (!res.ok) return getCachedRates();

      const data = await res.json();
      if (data && data.rates) {
        const rates: Record<string, number> = {};
        for (const c of SUPPORTED_CURRENCIES) {
          const value = Number(data.rates[c.code]);
          if (value > 0) rates[c.code] = value;
        }
        const asOfMs =
          typeof data.time_last_update_unix === 'number'
            ? data.time_last_update_unix * 1000
            : Date.now();
        window.localStorage.setItem(FX_CACHE_KEY, JSON.stringify(rates));
        window.localStorage.setItem(FX_CACHE_TIMESTAMP_KEY, String(Date.now()));
        window.localStorage.setItem(FX_AS_OF_KEY, String(asOfMs));
        window.dispatchEvent(new Event(FX_RATES_UPDATED_EVENT));
      }
    } catch (err) {
      console.debug('Offline or FX fetch error, using cached rates:', err);
    } finally {
      inFlight = null;
    }
    return getCachedRates();
  })();

  return inFlight;
}

/** Round an exchange rate to the 6 decimals stored in the DB. */
export function roundRate(rate: number): number {
  return Math.round(rate * 1_000_000) / 1_000_000;
}

/**
 * Work out the rate (1 SGD = X foreign) from a foreign amount and the SGD actually charged.
 * Returns undefined when either amount is not positive.
 */
export function rateFromSGD(foreignAmount: number, amountInSGD: number): number | undefined {
  if (!(foreignAmount > 0) || !(amountInSGD > 0)) return undefined;
  return roundRate(foreignAmount / amountInSGD);
}

/** Default rate for a currency (cached live rate, else built-in). */
export function getDefaultRate(currencyCode: string): number {
  const upper = (currencyCode || 'SGD').toUpperCase();
  if (upper === 'SGD') return 1;
  return (
    getCachedRates()[upper] ||
    SUPPORTED_CURRENCIES.find((c) => c.code === upper)?.defaultRatePerSGD ||
    1
  );
}

/**
 * Convert foreign currency amount to SGD.
 * @param amount Amount in foreign currency (e.g. 250000 VND)
 * @param currencyCode Currency code (e.g. 'VND')
 * @param customRate Optional manual override rate (e.g. 1 SGD = X currency)
 */
export function convertToSGD(
  amount: number,
  currencyCode: string,
  customRate?: number | null
): { amountInSGD: number; exchangeRate: number } {
  const upper = (currencyCode || 'SGD').toUpperCase();
  if (upper === 'SGD' || !amount) {
    return {
      amountInSGD: Math.round((amount || 0) * 100) / 100,
      exchangeRate: upper === 'SGD' ? 1 : customRate && customRate > 0 ? customRate : getDefaultRate(upper),
    };
  }

  const rate = customRate && customRate > 0 ? customRate : getDefaultRate(upper);
  const roundedSGD = Math.round((amount / rate) * 100) / 100;
  return { amountInSGD: roundedSGD, exchangeRate: rate };
}

/**
 * The FX fields to save on an expense. SGD rows store null for both.
 */
export function buildExpenseFxFields(
  amount: number,
  currencyCode: string,
  customRate?: number | null
): {
  amount: number;
  original_amount: number | null;
  original_currency: string;
  exchange_rate: number | null;
} {
  const upper = (currencyCode || 'SGD').toUpperCase();
  const { amountInSGD, exchangeRate } = convertToSGD(amount, upper, customRate);
  if (upper === 'SGD') {
    return { amount: amountInSGD, original_amount: null, original_currency: 'SGD', exchange_rate: null };
  }
  return {
    amount: amountInSGD,
    original_amount: amount,
    original_currency: upper,
    exchange_rate: roundRate(exchangeRate),
  };
}

/**
 * Format foreign currency with symbol.
 */
export function formatForeignAmount(amount: number, currencyCode: string): string {
  const upper = (currencyCode || 'SGD').toUpperCase();
  const config = SUPPORTED_CURRENCIES.find((c) => c.code === upper);
  const symbol = config?.symbol || upper;

  if (isZeroDecimalCurrency(upper)) {
    return `${symbol}${Math.round(amount).toLocaleString('en-SG')}`;
  }

  return `${symbol}${amount.toLocaleString('en-SG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
