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

