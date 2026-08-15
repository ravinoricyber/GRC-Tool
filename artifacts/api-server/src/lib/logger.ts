/**
 * @file lib/logger.ts
 * @description Shared Pino logger instance used throughout the API server.
 * Provides structured JSON logging in production and human-readable
 * pretty-printed output in development. Sensitive HTTP headers are
 * automatically redacted so they never appear in log sinks.
 */

import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Application-wide logger.
 *
 * Configuration details:
 * - `level` defaults to `"info"` but can be overridden at runtime via the
 *   `LOG_LEVEL` environment variable (e.g. `"debug"` during local development).
 * - `redact` strips Authorization tokens and session cookies from request/
 *   response log entries to prevent credential leakage.
 * - In non-production environments the `pino-pretty` transport is enabled,
 *   emitting colourised, human-readable output instead of raw JSON.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Paths to scrub from serialised log objects before writing
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  // Only attach the pretty-print transport in non-production environments;
  // in production, raw JSON is expected by the log aggregation pipeline.
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
