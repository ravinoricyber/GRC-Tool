/**
 * @file lib/serialize.ts
 * @description Utility for normalising database query results before they are
 * validated and serialised by Zod schemas. Drizzle ORM returns JavaScript
 * `Date` objects for timestamp columns, but the Orval-generated Zod schemas
 * declare those fields as `z.string()` (ISO-8601 strings). This module
 * converts every `Date` encountered in an object graph to its ISO string
 * representation so that schema validation succeeds without modifying the
 * underlying database schema or ORM models.
 *
 * Usage:
 * ```ts
 * import { serializeDates } from "../lib/serialize";
 *
 * const rows = await db.select().from(evidenceRequestsTable);
 * res.json(ListEvidenceResponse.parse(serializeDates(rows)));
 * ```
 *
 * Without `serializeDates`, Zod's `.parse()` would throw a `ZodError` on any
 * Date-typed column (e.g. `createdAt`, `updatedAt`, `approvedAt`) because it
 * expects a string where Drizzle supplies a `Date` object.
 */

/**
 * Recursively converts all `Date` values within an arbitrary value to their
 * ISO-8601 string representation.
 *
 * This function is necessary because Drizzle ORM hydrates timestamp columns as
 * native JavaScript `Date` objects, while the Orval-generated Zod schemas
 * (produced from the OpenAPI spec) model those same fields as `z.string()`.
 * Calling `serializeDates` before `Schema.parse()` bridges this type mismatch
 * without requiring changes to either the database schema or the generated
 * client types.
 *
 * The function handles all value types encountered in a typical ORM result:
 * - `null` / `undefined` — returned as-is without modification.
 * - `Date`               — converted to an ISO-8601 string via `toISOString()`
 *                          (e.g. `"2025-07-01T12:00:00.000Z"`).
 * - `Array`              — each element is recursively processed and a new
 *                          array with the same length is returned.
 * - Plain `object`       — each own enumerable value is recursively processed;
 *                          a new object with the same keys is returned.
 * - Primitive (`string`, `number`, `boolean`) — returned unchanged.
 *
 * The function does **not** mutate the input; it always returns a new value.
 *
 * @template T - The TypeScript type of the input. The return type is declared
 *   as `T` for call-site convenience; in practice, `Date` fields will have
 *   been replaced by `string` at runtime but this coercion is intentional and
 *   safe given that downstream Zod schemas expect strings.
 *
 * @param obj - The value to transform. May be a primitive, a `Date`, an array,
 *   a plain object, `null`, or `undefined`.
 *
 * @returns A deep copy of `obj` with every nested `Date` instance replaced by
 *   its ISO-8601 string equivalent. All other values are returned unchanged.
 *
 * @example
 * ```ts
 * serializeDates(new Date("2025-01-01"));
 * // → "2025-01-01T00:00:00.000Z"
 *
 * serializeDates({ createdAt: new Date("2025-01-01"), name: "foo" });
 * // → { createdAt: "2025-01-01T00:00:00.000Z", name: "foo" }
 *
 * serializeDates([{ ts: new Date() }, null]);
 * // → [{ ts: "2025-..." }, null]
 * ```
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
