/**
 * @file lib/logger.ts
 * @description Shared Pino logger instance used throughout the API server.
 * Provides structured JSON logging in production and human-readable
 * pretty-printed output in development. Sensitive HTTP headers are
 * automatically redacted so they never appear in log sinks.
 *
 * Usage:
 * ```ts
 * import { logger } from "./lib/logger";
 * logger.info({ userId }, "User logged in");
 * logger.error({ err }, "Unexpected error");
 * ```
 *
 * Environment variables that influence behaviour:
 * - `NODE_ENV`  — set to `"production"` to disable pino-pretty and emit raw JSON.
 * - `LOG_LEVEL` — one of `"trace"`, `"debug"`, `"info"`, `"warn"`, `"error"`,
 *                 `"fatal"`. Defaults to `"info"` when unset.
 */

import pino from "pino";

/** `true` when `NODE_ENV === "production"`, used to toggle the pretty-print transport. */
const isProduction = process.env.NODE_ENV === "production";

/**
 * Application-wide Pino logger instance.
 *
 * This singleton is created once at module load time and shared across all
 * modules that import it. Using a shared instance ensures a single, consistent
 * log-level threshold and transport configuration for the entire process.
 *
 * Configuration details:
 *
 * - **`level`** — Defaults to `"info"` but can be overridden at runtime via the
 *   `LOG_LEVEL` environment variable (e.g. `"debug"` during local development).
 *   Setting `"trace"` will emit every database query log from Drizzle.
 *
 * - **`redact`** — Strips sensitive values from serialised log objects before
 *   writing them to any transport. Specifically:
 *   - `req.headers.authorization` — Bearer tokens, API keys
 *   - `req.headers.cookie`        — Session identifiers
 *   - `res.headers['set-cookie']` — Outbound Set-Cookie headers
 *   Without redaction these values would appear verbatim in any log aggregator
 *   that receives the output (Datadog, CloudWatch, etc.).
 *
 * - **`transport` (non-production only)** — Enables `pino-pretty` which formats
 *   log lines with colours and human-readable timestamps. This transport adds
 *   overhead and is intentionally excluded from the production build where a
 *   log pipeline is expected to handle formatting downstream.
 *
 * @example
 * ```ts
 * logger.info({ port: 3000 }, "Server listening");
 * logger.warn({ userId }, "Rate limit approached");
 * logger.error({ err, requestId }, "Unhandled exception in route handler");
 * ```
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
