/**
 * Recursively convert all Date values in an object to ISO strings
 * so Orval-generated Zod schemas (which expect `string` for timestamps) don't reject them.
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
