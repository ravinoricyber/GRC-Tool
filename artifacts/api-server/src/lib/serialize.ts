/**
 * @file lib/serialize.ts
 * @description Utility for normalising database query results before they are
 * validated and serialised by Zod schemas. Drizzle ORM returns JavaScript
 * `Date` objects for timestamp columns, but the Orval-generated Zod schemas
 * declare those fields as `z.string()` (ISO-8601 strings). This module
 * converts every `Date` encountered in an object graph to its ISO string
 * representation so that schema validation succeeds without modifying the
 * underlying database schema or ORM models.
 */

/**
 * Recursively convert all Date values in an object to ISO strings
 * so Orval-generated Zod schemas (which expect `string` for timestamps) don't reject them.
 *
 * The function handles all value types:
 * - `null` / `undefined` — returned as-is.
 * - `Date` — converted to an ISO-8601 string via `toISOString()`.
 * - `Array` — each element is recursively processed.
 * - Plain `object` — each value in the entry set is recursively processed.
 * - Primitives (`string`, `number`, `boolean`) — returned unchanged.
 *
 * @template T The input type; the return type preserves the same shape.
 * @param obj The value to transform.
 * @returns The value with all nested `Date` instances replaced by ISO strings.
 */
export function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeDates) as unknown as T;
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serializeDates(v)])
    ) as T;
  }
  return obj;
}
