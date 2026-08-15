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
 */

import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';

/**
 * Props passed to any custom fallback component rendered by {@link ErrorBoundary}.
 */
export interface ErrorFallbackProps {
  /** The error that caused the boundary to activate. */
  error: Error;
  /** Call this to clear the error and attempt to re-render children. */
  resetError: () => void;
}

/** Props for the {@link ErrorBoundary} class component. */
interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom UI rendered when an error is caught. */
  FallbackComponent?: ComponentType<ErrorFallbackProps>;
  /** Changing this clears a caught error. Pass the route to recover on navigation. */
  resetKey?: unknown;
}

/** Internal state for {@link ErrorBoundary}. */
interface ErrorBoundaryState {
  /** Currently caught error, or `null` when the boundary is healthy. */
  error: Error | null;
}

/**
 * Normalises an unknown thrown value into a proper `Error` object so the
 * boundary's fallback always receives a typed error.
 *
 * Handles: `Error` instances (returned as-is), strings (wrapped in `Error`),
 * JSON-serialisable objects, and anything else (coerced via `String()`).
 *
 * @param value - The raw value caught by `getDerivedStateFromError`.
 * @returns A guaranteed `Error` instance.
 */
function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  if (typeof value === 'string') {
    return new Error(value);
  }
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

/**
 * Built-in fallback UI rendered when no custom `FallbackComponent` is provided.
 *
 * Shows a centered error card with:
 * - A human-friendly heading and description.
 * - The raw error message (development builds only, to avoid leaking internals).
 * - A "Try again" button that invokes `resetError` to clear the boundary state.
 *
 * @param props - `error` and `resetError` supplied by {@link ErrorBoundary}.
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
        {/* Dev only: messages can carry API responses and other internals. */}
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
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  /**
   * React lifecycle: called synchronously when a descendant throws during render.
   * Returns the new state that marks the boundary as active.
   *
   * @param error - Raw thrown value (normalised via {@link toError}).
   */
  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error: toError(error) };
  }

  /**
   * React lifecycle: called after the boundary has committed the fallback UI.
   * Logs the error and component stack to the console for debugging.
   *
   * @param error      - The thrown value.
   * @param info       - Contains `componentStack` showing which component threw.
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
   * Clears the caught error, causing the boundary to attempt rendering children
   * again on the next render cycle.
   */
  resetError = (): void => {
    this.setState({ error: null });
  };

  /**
   * Renders either the fallback UI (when an error is active) or the normal child
   * tree (when the boundary is healthy).
   */
  render(): ReactNode {
    const { error } = this.state;
    if (error === null) {
      // No error: render children normally.
      return this.props.children;
    }
    // Error active: render the fallback, preferring a custom one if provided.
    const Fallback = this.props.FallbackComponent ?? DefaultFallback;
    return <Fallback error={error} resetError={this.resetError} />;
  }
}
