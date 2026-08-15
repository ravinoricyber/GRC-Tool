/**
 * @file main.tsx
 * @description Application entry point. Mounts the React component tree into the
 * DOM root element and wraps the entire app in a top-level {@link ErrorBoundary}
 * so that any uncaught render errors are caught before reaching the browser's
 * default error overlay.
 *
 * Bootstrap sequence:
 *   1. `createRoot` attaches React to `#root` with a custom `onCaughtError`
 *      handler that suppresses the React dev overlay for already-handled errors.
 *   2. The root renders an {@link ErrorBoundary} as the outermost layer so that
 *      catastrophic failures in any part of the tree are caught and shown as a
 *      friendly fallback rather than a blank white screen.
 *   3. Inside the boundary, the {@link App} component bootstraps all global
 *      providers, routing, and the page layout.
 *
 * The `onCaughtError` hook on `createRoot` suppresses the React dev overlay for
 * errors that are already handled by the boundary, preventing double-reporting
 * during development.
 */

import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

/**
 * Attaches the React application to the `#root` DOM node.
 *
 * `document.getElementById('root')!` uses a non-null assertion because Vite's
 * index.html always includes this element; if it were absent the app would
 * crash immediately with a clear error.
 *
 * The `onCaughtError` callback receives the caught `error` and its associated
 * `errorInfo` (including the component stack). It logs both to the console for
 * developer diagnostics while preventing React from also invoking
 * `reportError()` — which would raise the browser's red dev-tools overlay even
 * though the error is already handled by the boundary.
 *
 * @param error     - The Error object thrown by the component subtree.
 * @param errorInfo - React's `ErrorInfo` object, contains `componentStack`.
 */
createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
