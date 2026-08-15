/**
 * @file use-mobile.tsx
 * @description Custom hook that tracks whether the current viewport width falls
 * below the mobile breakpoint threshold. Uses the `MediaQueryList` API so the
 * value updates reactively whenever the user resizes the browser window.
 */

import * as React from 'react';

/** Pixel width at which the layout switches from mobile to desktop (exclusive). */
const MOBILE_BREAKPOINT = 768;

/**
 * Returns `true` when the viewport width is strictly less than
 * {@link MOBILE_BREAKPOINT} (i.e. a mobile-sized screen), `false` otherwise.
 *
 * The initial state is `undefined` until the effect runs on the first render,
 * but the double-negation (`!!isMobile`) coerces that to `false`, making the
 * return value always a plain boolean rather than `boolean | undefined`.
 *
 * @example
 * const isMobile = useIsMobile();
 * if (isMobile) return <MobileLayout />;
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    // Create a MediaQueryList that matches screens narrower than the breakpoint.
    // Using `MOBILE_BREAKPOINT - 1` keeps the boundary exclusive of 768px itself.
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);

    // Handler called whenever the media query match state changes.
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    // Subscribe to future breakpoint crossings.
    mql.addEventListener('change', onChange);

    // Set the initial value synchronously so the first render is correct.
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);

    // Remove the listener on unmount to prevent memory leaks.
    return () => mql.removeEventListener('change', onChange);
  }, []);

  // Coerce undefined → false so callers always receive a stable boolean.
  return !!isMobile;
}
