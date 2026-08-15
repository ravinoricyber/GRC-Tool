/**
 * @file utils.ts
 * @description General-purpose utility functions shared across the application.
 *
 * Currently exports a single helper, {@link cn}, which merges Tailwind CSS class
 * strings in a conflict-aware manner. Additional shared utilities (date helpers,
 * formatters, etc.) should be added here to keep them co-located and testable.
 *
 * Dependency rationale:
 * - `clsx`          – Handles conditional class values, arrays, and objects with
 *                     boolean-keyed entries. Converts them all to a flat string.
 * - `tailwind-merge` – Deduplicates and resolves conflicting Tailwind utilities.
 *                      For example `twMerge("p-2 p-4")` returns `"p-4"` rather
 *                      than `"p-2 p-4"`, which would otherwise apply the last
 *                      class as the browser encounters it in the stylesheet.
 * Combining both libraries is the industry standard for Tailwind + React setups.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges an arbitrary number of CSS class values into a single deduplicated
 * class string, resolving Tailwind utility conflicts in favour of the
 * last-specified value.
 *
 * Internally uses `clsx` to handle conditionals/arrays/objects and
 * `tailwind-merge` to resolve Tailwind-specific conflicts so that the resulting
 * string contains exactly one utility from each conflicting group.
 *
 * Common conflict examples resolved by `twMerge`:
 * - `"p-2 p-4"`               → `"p-4"` (last padding wins)
 * - `"text-red-500 text-blue-500"` → `"text-blue-500"` (last colour wins)
 * - `"flex block"`             → `"block"` (last display property wins)
 *
 * @param inputs - Any number of class values accepted by `clsx`:
 *   - `string`  – A plain class string (e.g. `"px-4 py-2"`).
 *   - `string[]` – An array of class strings.
 *   - `Record<string, boolean>` – An object where truthy values include the key
 *     as a class (e.g. `{ "bg-primary": isActive }`).
 *   - `undefined` / `null` / `false` – Falsy values are safely ignored.
 * @returns A single merged class string safe to pass to a `className` prop.
 *
 * @example
 * // Basic usage:
 * cn("px-4 py-2", "text-sm")
 * // → "px-4 py-2 text-sm"
 *
 * @example
 * // Conditional classes:
 * cn("px-4 py-2", isActive && "bg-primary", "text-sm")
 * // → "px-4 py-2 bg-primary text-sm"   (when isActive is true)
 * // → "px-4 py-2 text-sm"              (when isActive is false)
 *
 * @example
 * // Conflict resolution:
 * cn("p-2", "p-4")
 * // → "p-4"  (twMerge removes the earlier conflicting utility)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
