/**
 * UUID validation utility
 * Validates that a string conforms to the standard 8-4-4-4-12 hex UUID format.
 * Prevents PostgreSQL syntax errors (e.g. invalid input syntax for type uuid: "hh-00000000-0001").
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  return UUID_REGEX.test(id);
}

/** Random v4 UUID (crypto-backed when available). */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

