import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  convertToSGD,
  formatForeignAmount,
  SUPPORTED_CURRENCIES,
  getCachedRates,
  rateFromSGD,
  roundRate,
  buildExpenseFxFields,
  getRateStatus,
  getDefaultRate,
  refreshExchangeRates,
  FX_RATES_UPDATED_EVENT,
} from '../src/lib/currencyConverter';

describe('Currency Converter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('supports major regional currencies including VND, MYR, JPY, THB, USD', () => {
    const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
    expect(codes).toContain('SGD');
    expect(codes).toContain('VND');
    expect(codes).toContain('MYR');
    expect(codes).toContain('JPY');
    expect(codes).toContain('THB');
    expect(codes).toContain('USD');
  });

  it('converts foreign currencies to SGD accurately using default rates', () => {
    // 1 SGD = 18,900 VND -> 189,000 VND should be ~10 SGD
    const resVND = convertToSGD(189000, 'VND');
    expect(resVND.amountInSGD).toBe(10);
    expect(resVND.exchangeRate).toBe(18900);

    // Custom override rate
    const resCustom = convertToSGD(100, 'USD', 0.8);
    expect(resCustom.amountInSGD).toBe(125);
  });

  it('formats foreign amounts with native symbols and zero-decimal rules', () => {
    expect(formatForeignAmount(250000, 'VND')).toBe('₫250,000');
    expect(formatForeignAmount(1500, 'JPY')).toBe('¥1,500');
    expect(formatForeignAmount(12.5, 'USD')).toBe('$12.50');
  });

  it('returns cached rates fallback', () => {
    const rates = getCachedRates();
    expect(rates.SGD).toBe(1);
    expect(rates.VND).toBeGreaterThan(10000);
  });
});


describe('Currency Converter: rates, saving and status', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('works out the rate from the SGD actually charged', () => {
    expect(rateFromSGD(2000, 16)).toBe(125);
    expect(rateFromSGD(500000, 26.37)).toBe(roundRate(500000 / 26.37));
    // Round trip recovers the typed SGD amount
    expect(convertToSGD(500000, 'VND', rateFromSGD(500000, 26.37)).amountInSGD).toBe(26.37);
    expect(rateFromSGD(0, 10)).toBeUndefined();
    expect(rateFromSGD(100, 0)).toBeUndefined();
  });

  it('builds FX fields: SGD rows store nulls, foreign rows store amount, currency and rate', () => {
    expect(buildExpenseFxFields(12.5, 'SGD')).toEqual({
      amount: 12.5,
      original_amount: null,
      original_currency: 'SGD',
      exchange_rate: null,
    });
    expect(buildExpenseFxFields(2000, 'JPY', 100)).toEqual({
      amount: 20,
      original_amount: 2000,
      original_currency: 'JPY',
      exchange_rate: 100,
    });
  });

  it('reports offline status with built-in rates before any fetch', () => {
    expect(getRateStatus()).toEqual({ source: 'offline', asOf: null });
    expect(getDefaultRate('JPY')).toBe(115.5);
  });

  it('fetches live rates once, caches them and marks them live', async () => {
    const asOfUnix = 1793750400; // provider update time
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ time_last_update_unix: asOfUnix, rates: { JPY: 118.2, VND: 19800 } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const onUpdate = vi.fn();
    window.addEventListener(FX_RATES_UPDATED_EVENT, onUpdate);

    const [a, b] = await Promise.all([refreshExchangeRates(), refreshExchangeRates()]);
    expect(fetchMock).toHaveBeenCalledTimes(1); // in-flight request shared
    expect(a.JPY).toBe(118.2);
    expect(b.VND).toBe(19800);
    expect(getDefaultRate('JPY')).toBe(118.2);
    expect(getRateStatus()).toEqual({ source: 'live', asOf: new Date(asOfUnix * 1000) });
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // Within 24h: no new fetch
    await refreshExchangeRates();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    window.removeEventListener(FX_RATES_UPDATED_EVENT, onUpdate);
  });

  it('falls back to cached rates when offline and marks them offline after 24h', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    localStorage.setItem('budget_bubby_fx_rates_v1', JSON.stringify({ JPY: 120 }));
    localStorage.setItem('budget_bubby_fx_timestamp_v1', String(Date.now() - 25 * 60 * 60 * 1000));

    const rates = await refreshExchangeRates();
    expect(rates.JPY).toBe(120);
    expect(getRateStatus().source).toBe('offline');
  });
});
