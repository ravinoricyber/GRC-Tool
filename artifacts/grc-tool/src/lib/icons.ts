/**
 * @file icons.ts
 * @description Icon re-export barrel (currently unused).
 *
 * This file was intended as a centralised place to re-export only the Lucide
 * icons consumed by the application, enabling tree-shaking optimisations and a
 * single import source for icon tokens. In practice, pages import icons directly
 * from `lucide-react`, so this file has no active exports.
 *
 * Rationale for the barrel pattern (for future use):
 * - Centralising icon imports makes it easy to enforce a consistent icon set.
 * - Wrapping Lucide icons here would allow adding project-wide defaults such as
 *   a fixed `strokeWidth` (e.g. `1.5`) or a default `size` without modifying
 *   every call site.
 * - Switching icon libraries (e.g. from Lucide to Heroicons) would require
 *   updating only this file rather than every component that uses icons.
 *
 * It can be populated in the future if a project-wide icon normalisation policy
 * is adopted (e.g. enforcing consistent sizing or stroke-width wrappers).
 *
 * @example Future usage:
 * // icons.ts
 * export { Shield, ShieldCheck, FileText } from 'lucide-react';
 *
 * // component.tsx
 * import { Shield } from '@/lib/icons';
 */

// Re-export specific icons needed by pages from lucide-react if needed, or just let them import direct
// This file can be ignored.
