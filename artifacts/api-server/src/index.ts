/**
 * @file index.ts
 * @description Server entry-point. Reads and validates the `PORT` environment
 * variable, then starts the Express application. Any configuration error
 * (missing or non-numeric PORT) is treated as a fatal startup failure so that
 * the process exits immediately with a descriptive message rather than
 * silently binding to an unexpected port.
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

app.listen(port, (err) => {
  if (err) {
    // Structured error log before terminating so the error is captured by log aggregators
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
