/**
 * Singapore Dollar (SGD) currency formatting and parsing utilities.
 * Ensures consistent financial presentation across the application:
 * - Positive: S$1,234.50
 * - Negative: -S$50.00
 * - Zero: S$0.00
 */

/**
 * Formats a number as Singapore Dollars (S$X,XXX.XX).
 * Negative values are formatted with a preceding minus sign: -S$XX.XX.
 */
export function formatSGD(amount: number): string {
  if (isNaN(amount) || !isFinite(amount)) {
    return 'S$0.00';
  }

  // Round to 2 decimal places to avoid -0.00 or floating point artifacts
  const rounded = Math.round(amount * 100) / 100;
  const isNegative = rounded < 0;
  const absAmount = Math.abs(rounded);

  const formattedAbs = absAmount.toLocaleString('en-SG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `${isNegative ? '-' : ''}S$${formattedAbs}`;
}

/**
 * Compact SGD representation (e.g., S$500k, S$1.2M) suitable for charts and dashboard cards.
 */
export function formatSGDCompact(amount: number): string {
  if (isNaN(amount) || !isFinite(amount)) {
    return 'S$0';
  }

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  let formatted: string;
  if (absAmount >= 1_000_000) {
    const val = absAmount / 1_000_000;
    formatted = `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
  } else if (absAmount >= 1_000) {
    const val = absAmount / 1_000;
    formatted = `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}k`;
  } else {
    formatted = absAmount.toLocaleString('en-SG', {
      maximumFractionDigits: 0,
    });
  }

  return `${isNegative ? '-' : ''}S$${formatted}`;
}

/**
 * Parses user input currency string into a valid number.
 * Strips whitespace, currency symbols (S$, $), commas, and handles accounting negative notation (X).
 */
export function parseSGD(value: string): number {
  if (!value || typeof value !== 'string') {
    return 0;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  let isNegative = false;
  let clean = trimmed;

  // Accounting parenthetical negative notation: (S$50)
  if (clean.startsWith('(') && clean.endsWith(')')) {
    isNegative = true;
    clean = clean.slice(1, -1).trim();
  }

  if (clean.startsWith('-')) {
    isNegative = true;
    clean = clean.slice(1).trim();
  }

  // Remove S$, $, commas, and whitespace
  clean = clean.replace(/^[sS]?\$/i, '').replace(/,/g, '').trim();

  const parsed = parseFloat(clean);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return 0;
  }

  const result = isNegative ? -parsed : parsed;
  return Math.round(result * 100) / 100;
}
