/**
 * Multi-Currency & FX Conversion Engine for Budget Bubby.
 * Converts foreign currencies (VND, JPY, MYR, THB, USD, etc.) to Singapore Dollars (SGD).
 * Caches live rates in localStorage and provides reliable offline fallback rates.
 */

export interface CurrencyConfig {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  defaultRatePerSGD: number; // 1 SGD = X foreign currency
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬', defaultRatePerSGD: 1 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', flag: '🇲🇾', defaultRatePerSGD: 3.32 },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫', flag: '🇻🇳', defaultRatePerSGD: 18900 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵', defaultRatePerSGD: 115.5 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', flag: '🇹🇭', defaultRatePerSGD: 26.8 },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', defaultRatePerSGD: 0.76 },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', defaultRatePerSGD: 0.70 },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', defaultRatePerSGD: 0.59 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', flag: '🇰🇷', defaultRatePerSGD: 1045 },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', flag: '🇹🇼', defaultRatePerSGD: 24.2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺', defaultRatePerSGD: 1.16 },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', flag: '🇮🇩', defaultRatePerSGD: 12100 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', flag: '🇵🇭', defaultRatePerSGD: 43.5 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳', defaultRatePerSGD: 5.48 },
];

const FX_CACHE_KEY = 'budget_bubby_fx_rates_v1';
const FX_CACHE_TIMESTAMP_KEY = 'budget_bubby_fx_timestamp_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function getCachedRates(): Record<string, number> {
  const fallback: Record<string, number> = {};
  for (const c of SUPPORTED_CURRENCIES) {
    fallback[c.code] = c.defaultRatePerSGD;
  }

  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(FX_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...fallback, ...parsed };
    }
  } catch (err) {
    console.debug('Failed to read FX cache:', err);
  }

  return fallback;
}

/**
 * Fetch latest FX rates from open endpoint with fallback to cached/defaults.
 */
export async function refreshExchangeRates(): Promise<Record<string, number>> {
  const current = getCachedRates();
  if (typeof window === 'undefined' || !window.fetch) return current;

  try {
    const lastFetch = window.localStorage.getItem(FX_CACHE_TIMESTAMP_KEY);
    if (lastFetch && Date.now() - parseInt(lastFetch, 10) < CACHE_TTL_MS) {
      return current;
    }

    const res = await fetch('https://open.er-api.com/v6/latest/SGD');
    if (!res.ok) return current;

    const data = await res.json();
    if (data && data.rates) {
      const rates: Record<string, number> = {};
      for (const c of SUPPORTED_CURRENCIES) {
        if (data.rates[c.code]) {
          rates[c.code] = Number(data.rates[c.code]);
        }
      }
      window.localStorage.setItem(FX_CACHE_KEY, JSON.stringify(rates));
      window.localStorage.setItem(FX_CACHE_TIMESTAMP_KEY, String(Date.now()));
      return { ...current, ...rates };
    }
  } catch (err) {
    console.debug('Offline or FX fetch error, using cached rates:', err);
  }

  return current;
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
  customRate?: number
): { amountInSGD: number; exchangeRate: number } {
  const upper = (currencyCode || 'SGD').toUpperCase();
  if (upper === 'SGD' || !amount) {
    return { amountInSGD: Math.round(amount * 100) / 100, exchangeRate: 1 };
  }

  let rate = customRate;
  if (!rate || rate <= 0) {
    const rates = getCachedRates();
    rate = rates[upper] || SUPPORTED_CURRENCIES.find((c) => c.code === upper)?.defaultRatePerSGD || 1;
  }

  const rawSGD = amount / rate;
  const roundedSGD = Math.round(rawSGD * 100) / 100;
  return { amountInSGD: roundedSGD, exchangeRate: rate };
}

/**
 * Format foreign currency with symbol.
 */
export function formatForeignAmount(amount: number, currencyCode: string): string {
  const upper = (currencyCode || 'SGD').toUpperCase();
  const config = SUPPORTED_CURRENCIES.find((c) => c.code === upper);
  const symbol = config?.symbol || upper;

  // Zero-decimal currencies
  const zeroDecimalCurrencies = ['VND', 'JPY', 'KRW', 'IDR'];
  if (zeroDecimalCurrencies.includes(upper)) {
    return `${symbol}${Math.round(amount).toLocaleString('en-SG')}`;
  }

  return `${symbol}${amount.toLocaleString('en-SG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
