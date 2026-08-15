/**
 * @file main.tsx
 * @description Application entry point. Mounts the React component tree into the
 * DOM root element and wraps the entire app in a top-level {@link ErrorBoundary}
 * so that any uncaught render errors are caught before reaching the browser's
 * default error overlay.
 *
 * The `onCaughtError` hook on `createRoot` suppresses the React dev overlay for
 * errors that are already handled by the boundary, preventing double-reporting
 * during development.
 */

import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

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
