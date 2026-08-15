/**
 * @file use-mobile.tsx
 * @description Custom hook that tracks whether the current viewport width falls
 * below the mobile breakpoint threshold. Uses the `MediaQueryList` API so the
 * value updates reactively whenever the user resizes the browser window.
 *
 * Why this hook exists:
 * Tailwind CSS handles responsive styling declaratively, but some component
 * behaviour (e.g. showing/hiding a drawer vs. a sidebar) must be driven
 * imperatively from JavaScript. This hook provides a stable boolean that React
 * components can use for conditional rendering and branching logic without
 * hand-rolling `window.matchMedia` wiring in each component.
 */

import * as React from 'react';

/**
 * Pixel width at which the layout switches from mobile to desktop (exclusive).
 * A viewport of exactly 768 px is treated as desktop (not mobile).
 * Matches Tailwind's default `md` breakpoint for consistent responsive behaviour.
 */
const MOBILE_BREAKPOINT = 768;

/**
 * Returns `true` when the viewport width is strictly less than
 * {@link MOBILE_BREAKPOINT} (i.e. a mobile-sized screen), `false` otherwise.
 *
 * Implementation details:
 * - State is initialised as `undefined` to differentiate "not yet measured"
 *   from "measured as false" during SSR or before the first effect fires.
 * - The double-negation (`!!isMobile`) in the return statement coerces
 *   `undefined` → `false`, ensuring callers always receive a stable `boolean`
 *   rather than `boolean | undefined`.
 * - `window.matchMedia` creates a `MediaQueryList` for `(max-width: 767px)`.
 *   Registering a `"change"` event listener means the hook re-evaluates
 *   exactly when the viewport crosses the breakpoint — no polling required.
 * - The current `window.innerWidth` is read synchronously inside the effect to
 *   set the correct initial value after the first paint.
 * - The event listener is removed in the cleanup function to prevent memory
 *   leaks and stale state updates on unmounted components.
 *
 * @returns `true` if the viewport is narrower than {@link MOBILE_BREAKPOINT},
 *          `false` otherwise. Always returns a `boolean` (never `undefined`).
 *
 * @example
 * const isMobile = useIsMobile();
 * if (isMobile) return <MobileLayout />;
 * return <DesktopLayout />;
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    // Create a MediaQueryList that matches screens narrower than the breakpoint.
    // Using `MOBILE_BREAKPOINT - 1` keeps the boundary exclusive of 768px itself,
    // so a 768px viewport satisfies the `md:` Tailwind prefix but is not "mobile".
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    // Handler called whenever the media query match state changes (i.e. the
    // viewport crosses the 767px ↔ 768px boundary in either direction).
    // Re-reads `window.innerWidth` rather than using `mql.matches` to stay
    // consistent with the initial value calculation below.
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Subscribe to future breakpoint crossings.
    mql.addEventListener('change', onChange);

    // Set the initial value synchronously so the first render is correct.
    // Without this, components would render with `isMobile === false` (the
    // coerced undefined) regardless of actual viewport size.
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    // Remove the listener on unmount to prevent memory leaks and to avoid
    // calling `setIsMobile` on an unmounted component instance.
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Coerce undefined → false so callers always receive a stable boolean.
  return !!isMobile;
}
