import { describe, it, expect } from 'vitest';
import { isValidUuid } from '../src/lib/uuid';

describe('isValidUuid', () => {
  it('returns true for standard 36-char hex UUIDs', () => {
    expect(isValidUuid('00000000-0000-0000-0000-000000000001')).toBe(true);
    expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(isValidUuid('C56A4180-65AA-42EC-A945-5FD21DEC0538')).toBe(true);
  });

  it('returns false for mock prefixed IDs', () => {
    expect(isValidUuid('hh-00000000-0001')).toBe(false);
    expect(isValidUuid('mem-00000000-0011')).toBe(false);
    expect(isValidUuid('prof-00000000-0201')).toBe(false);
    expect(isValidUuid('alloc-yj-01')).toBe(false);
    expect(isValidUuid('cat-00000000-0101')).toBe(false);
    expect(isValidUuid('mb-dyn-2026-10-mem-00000000-0011')).toBe(false);
  });

  it('returns false for undefined, null, non-strings, or malformed strings', () => {
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(12345)).toBe(false);
    expect(isValidUuid({})).toBe(false);
    expect(isValidUuid('')).toBe(false);
    expect(isValidUuid('not-a-uuid')).toBe(false);
  });
});

