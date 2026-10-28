import { describe, it, expect, beforeEach } from 'vitest';
import {
  convertToSGD,
  formatForeignAmount,
  SUPPORTED_CURRENCIES,
  getCachedRates,
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

