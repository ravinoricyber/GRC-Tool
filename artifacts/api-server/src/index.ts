/**
 * @file index.ts
 * @description Server entry-point. Reads and validates the `PORT` environment
 * variable, then starts the Express application. Any configuration error
 * (missing or non-numeric PORT) is treated as a fatal startup failure so that
 * the process exits immediately with a descriptive message rather than
 * silently binding to an unexpected port.
 *
 * Start-up sequence:
 *  1. Read `process.env.PORT` — throw immediately if absent.
 *  2. Coerce to a number and validate the result — throw if NaN or ≤ 0.
 *  3. Call `app.listen(port, callback)` — log and exit on any binding error.
 *  4. On successful binding, emit a structured info log with the active port.
 */

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

// Fail fast if PORT is absent — the server has no sensible default to fall back on
if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

// Guard against non-numeric strings (e.g. "abc") and nonsensical values (≤ 0)
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

/**
 * Starts the HTTP server and binds it to the configured port.
 *
 * The callback supplied to `app.listen` fires once the OS has assigned the
 * port. If Node.js surfaces an error (e.g. EADDRINUSE, EACCES) it is logged
 * at the `error` level before the process terminates with code 1 so that
 * process supervisors (systemd, Docker restart policies) can react
 * appropriately.
 *
 * @param port - The TCP port number parsed from the `PORT` environment variable.
 * @param callback - Invoked by Node.js after the server starts listening.
 *   Receives an `Error` object when the server failed to bind; otherwise the
 *   argument is `undefined`.
 *
 * @throws Will call `process.exit(1)` (rather than throwing) if the server
 *   fails to bind, so callers cannot catch this via try/catch.
 */
app.listen(port, (err) => {
  if (err) {
    // Structured error log before terminating so the error is captured by log aggregators
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
