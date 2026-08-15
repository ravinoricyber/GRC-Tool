/**
 * @file utils.ts
 * @description General-purpose utility functions shared across the application.
 *
 * Currently exports a single helper, {@link cn}, which merges Tailwind CSS class
 * strings in a conflict-aware manner. Additional shared utilities (date helpers,
 * formatters, etc.) should be added here to keep them co-located and testable.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges an arbitrary number of CSS class values into a single deduplicated
 * class string, resolving Tailwind utility conflicts in favour of the
 * last-specified value.
 *
 * Internally uses `clsx` to handle conditionals/arrays and `tailwind-merge` to
 * resolve conflicts (e.g. `"p-2 p-4"` → `"p-4"`).
 *
 * @param inputs - Any number of class values accepted by `clsx`: strings,
 *                 arrays, objects with boolean-valued keys, `undefined`, etc.
 * @returns A single merged class string safe to pass to a `className` prop.
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-primary", "text-sm")
 * // → "px-4 py-2 bg-primary text-sm"   (when isActive is true)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
