/**
 * @file icons.ts
 * @description Icon re-export barrel (currently unused).
 *
 * This file was intended as a centralised place to re-export only the Lucide
 * icons consumed by the application, enabling tree-shaking optimisations and a
 * single import source for icon tokens. In practice, pages import icons directly
 * from `lucide-react`, so this file has no active exports.
 *
 * It can be populated in the future if a project-wide icon normalisation policy
 * is adopted (e.g. enforcing consistent sizing or stroke-width wrappers).
 */

// Re-export specific icons needed by pages from lucide-react if needed, or just let them import direct
// This file can be ignored.
