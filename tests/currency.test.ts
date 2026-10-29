import { describe, it, expect } from 'vitest';
import { formatSGD, parseSGD } from '../src/lib/currency';

describe('currency utilities', () => {
  describe('formatSGD', () => {
    it('formats standard positive numbers with thousand separators and 2 decimals', () => {
      expect(formatSGD(1234.5)).toBe('S$1,234.50');
      expect(formatSGD(5000)).toBe('S$5,000.00');
      expect(formatSGD(1000000)).toBe('S$1,000,000.00');
      expect(formatSGD(0)).toBe('S$0.00');
    });

    it('formats negative amounts with minus sign before S$', () => {
      expect(formatSGD(-50)).toBe('-S$50.00');
      expect(formatSGD(-1234.56)).toBe('-S$1,234.56');
    });

    it('rounds to 2 decimal places correctly', () => {
      expect(formatSGD(10.999)).toBe('S$11.00');
      expect(formatSGD(10.554)).toBe('S$10.55');
      expect(formatSGD(10.555)).toBe('S$10.56');
    });

    it('handles small fractions and zeroes', () => {
      expect(formatSGD(0.01)).toBe('S$0.01');
      expect(formatSGD(0.004)).toBe('S$0.00');
      expect(formatSGD(-0)).toBe('S$0.00');
    });

    it('formats without cents when showCents is false', () => {
      expect(formatSGD(1234.5, { showCents: false })).toBe('S$1,235');
      expect(formatSGD(5000, { showCents: false })).toBe('S$5,000');
      expect(formatSGD(0, { showCents: false })).toBe('S$0');
      expect(formatSGD(-50, { showCents: false })).toBe('-S$50');
      expect(formatSGD(-1234.56, { showCents: false })).toBe('-S$1,235');
    });
  });

  describe('parseSGD', () => {
    it('parses formatted S$ strings into numeric values', () => {
      expect(parseSGD('S$1,234.50')).toBe(1234.5);
      expect(parseSGD('-S$50.00')).toBe(-50);
      expect(parseSGD('S$0.00')).toBe(0);
    });

    it('parses unformatted or loosely formatted inputs', () => {
      expect(parseSGD('1234.50')).toBe(1234.5);
      expect(parseSGD('$500')).toBe(500);
      expect(parseSGD('   S$ 2,500.75 ')).toBe(2500.75);
      expect(parseSGD('(S$100.00)')).toBe(-100);
    });

    it('returns 0 for empty or invalid inputs', () => {
      expect(parseSGD('')).toBe(0);
      expect(parseSGD('abc')).toBe(0);
    });
  });
});
