/**
 * @file error-boundary.tsx
 * @description React class-based error boundary and supporting types/utilities.
 *
 * Provides {@link ErrorBoundary} — a React `Component` subclass that intercepts
 * render-phase and lifecycle errors thrown by any descendant. When an error is
 * caught, it renders a fallback UI instead of crashing the entire page.
 *
 * Key behaviours:
 * - Accepts an optional `FallbackComponent` prop for custom error UIs; falls
 *   back to the built-in {@link DefaultFallback} when omitted.
 * - Accepts a `resetKey` prop: any change to this value automatically clears the
 *   caught error (used by `RoutedErrorBoundary` in App.tsx so navigation away
 *   from a broken page recovers cleanly).
 * - Error messages are only shown in development builds to avoid exposing
 *   implementation details in production.
 *
 * Why a class component?
 * React only supports error boundaries as class components because the two
 * lifecycle methods required (`getDerivedStateFromError` and `componentDidCatch`)
 * are not available as hooks. This is a known React limitation as of React 18.
 *
 * Usage:
 * ```tsx
 * // Wrap a subtree to isolate it from crash propagation:
 * <ErrorBoundary resetKey={currentRoute}>
 *   <PageContent />
 * </ErrorBoundary>
 *
 * // Custom fallback UI:
 * <ErrorBoundary FallbackComponent={MyErrorPage}>
 *   <App />
 * </ErrorBoundary>
 * ```
 */

import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

/**
 * Props passed to any custom fallback component rendered by {@link ErrorBoundary}.
 * Custom fallback components must accept these two props.
 */
export interface ErrorFallbackProps {
  /** The error that caused the boundary to activate. Always a proper `Error` instance
   *  thanks to the {@link toError} normalisation helper. */
  error: Error;
  /** Call this to clear the boundary's error state and re-attempt rendering children.
   *  Typically wired to a "Try again" button in the fallback UI. */
  resetError: () => void;
}

/**
 * Props for the {@link ErrorBoundary} class component.
 */
interface ErrorBoundaryProps {
  /** The React subtree to protect. Any render error thrown here is caught. */
  children: ReactNode;
  /**
   * Optional custom UI component rendered when an error is caught.
   * Must accept {@link ErrorFallbackProps}. When omitted, {@link DefaultFallback}
   * is rendered instead.
   */
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /**
   * Optional reset key. When this value changes (strict equality check),
   * `componentDidUpdate` automatically calls `resetError()` and clears the
   * caught error. Pass the current route pathname so navigating away from a
   * broken page recovers cleanly without user interaction.
   */
  resetKey?: unknown;
}

/**
 * Internal state for {@link ErrorBoundary}.
 * The boundary is "active" (showing the fallback UI) when `error !== null`.
 */
interface ErrorBoundaryState {
  /** Currently caught error, or `null` when the boundary is healthy. */
  error: Error | null;
}

/**
 * Normalises an unknown thrown value into a proper `Error` object so the
 * boundary's fallback always receives a typed error regardless of what was
 * actually thrown (strings, plain objects, etc. are all valid throw targets).
 *
 * Handles the following thrown value shapes:
 * - `Error` instances → returned as-is (no wrapping overhead).
 * - `string`          → wrapped in `new Error(value)`.
 * - JSON-serialisable objects → JSON.stringify-d and wrapped.
 * - Anything else     → coerced via `String()` and wrapped.
 *
 * @param value - The raw value caught by `getDerivedStateFromError`.
 * @returns A guaranteed `Error` instance whose `message` describes the error.
 */
function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    // Attempt JSON serialisation for structured error objects (e.g. API responses).
    return new Error(JSON.stringify(value));
  } catch {
    // Fallback for values that cannot be JSON-serialised (e.g. circular refs).
    return new Error(String(value));
  }
}

/**
 * Built-in fallback UI rendered when no custom `FallbackComponent` is provided.
 *
 * Shows a centered error card with:
 * - A human-friendly heading ("Something went wrong") and a brief description
 *   reassuring the user that the rest of the app is still operational.
 * - The raw error message in a `<pre>` block (development builds only, to avoid
 *   leaking API responses or stack traces to production users).
 * - A "Try again" button that invokes `resetError` to clear the boundary state
 *   and re-attempt rendering the children.
 *
 * The component is intentionally minimal so it works on every route regardless
 * of whether route-specific providers are mounted.
 *
 * @param props.error      - The normalised `Error` that activated the boundary.
 * @param props.resetError - Callback to clear the boundary and retry rendering.
 */
function DefaultFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-xl font-semibold text-gray-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          This part of the app hit an error. The rest of the app is still
          running.
        </p>
        {/* Dev only: messages can carry API responses, stack traces, and other
            internals that would be confusing or dangerous for end users to see. */}
        {import.meta.env.DEV ? (
          <pre className="mt-4 overflow-x-auto rounded bg-gray-100 p-3 text-left text-xs text-gray-800">
            {error.message || String(error)}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={resetError}
          className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/**
 * React error boundary class component.
 *
 * Wrap any subtree you want to isolate from catastrophic render failures:
 * ```tsx
 * <ErrorBoundary resetKey={currentRoute}>
 *   <PageContent />
 * </ErrorBoundary>
 * ```
 *
 * The `resetKey` prop is compared in `componentDidUpdate`; when it changes the
 * boundary calls `resetError()` automatically, enabling navigation-based recovery.
 *
 * Lifecycle overview:
 * 1. Children render normally when `state.error === null`.
 * 2. A descendant throws during render → `getDerivedStateFromError` is called,
 *    state is set to `{ error: <normalised Error> }`.
 * 3. React re-renders the boundary, which now renders the fallback UI.
 * 4. `componentDidCatch` fires and logs the error to the console.
 * 5. If `resetKey` changes (e.g. user navigates), `componentDidUpdate` calls
 *    `resetError()` which sets state back to `{ error: null }`.
 * 6. React re-renders the boundary, which now renders children again.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  /**
   * React lifecycle: called synchronously when a descendant throws during render.
   * This static method must return the new state — it cannot call `this.setState`.
   * The returned state is merged into the component's state before the next render,
   * causing the boundary to render the fallback UI on the same pass.
   *
   * @param error - Raw thrown value. Normalised to an `Error` via {@link toError}
   *                so the fallback component always receives a typed instance.
   * @returns Partial state that activates the fallback UI.
   */
  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  /**
   * React lifecycle: called after the boundary has committed the fallback UI to
   * the DOM. Used for logging and optional error reporting (e.g. Sentry).
   *
   * Note: this method fires *after* render so it is safe to call `setState` here
   * if needed (unlike `getDerivedStateFromError` which fires during render).
   *
   * @param error - The thrown value (same as the one passed to
   *                `getDerivedStateFromError`).
   * @param info  - React's `ErrorInfo` object whose `componentStack` string
   *                traces which component in the tree threw.
   */
  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(
      'ErrorBoundary caught an error:',
      toError(error),
      info.componentStack,
    );
  }

  /**
   * React lifecycle: fires after every prop/state update. Checks whether the
   * `resetKey` prop has changed and, if so, clears the caught error. This allows
   * the boundary to self-heal on route changes without manual user interaction.
   *
   * The guard `this.state.error !== null` ensures `resetError` is only called
   * when the boundary is actually active — preventing unnecessary re-renders on
   * normal prop updates.
   *
   * @param prevProps - Props from the previous render cycle.
   */
  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.resetError();
    }
  }

  /**
   * Clears the caught error by resetting `state.error` to `null`, causing the
   * boundary to attempt rendering children again on the next render cycle.
   * This is bound as an arrow function so it can be passed directly as a callback
   * without losing the `this` reference.
   */
  resetError = (): void => {
    this.setState({ error: null });
  };

  /**
   * Renders either the fallback UI (when an error is active, i.e.
   * `state.error !== null`) or the normal child tree (when the boundary is
   * healthy, i.e. `state.error === null`).
   *
   * @returns The children node when healthy, or the fallback component when an
   *          error is active.
   */
  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      // No error: render children normally as a transparent pass-through.
      return this.props.children;
    }
    // Error active: render the fallback, preferring a custom one if provided.
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
