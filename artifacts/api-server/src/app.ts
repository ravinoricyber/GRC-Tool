/**
 * @file app.ts
 * @description Express application factory. Configures middleware (structured
 * HTTP logging, CORS, JSON body parsing) and mounts the API router under
 * the `/api` prefix. The resulting Express instance is exported for use
 * by the server entry-point and by integration tests.
 *
 * Middleware stack (in order):
 *  1. `pino-http`              — structured per-request logging with URL sanitisation
 *  2. `cors`                   — permissive cross-origin policy for separate front-end origin
 *  3. `express.json`           — parses `application/json` request bodies
 *  4. `express.urlencoded`     — parses `application/x-www-form-urlencoded` bodies
 *  5. `/api` router            — all feature-level sub-routers
 */

import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

/**
 * Structured per-request HTTP logging middleware powered by `pino-http`.
 *
 * Each inbound request and outbound response is automatically logged as a
 * structured JSON object. Custom serializers are provided to control exactly
 * which fields appear in the log output:
 *
 * - **Request serializer** (`req`): Emits only `id`, `method`, and `url`.
 *   The URL is stripped of its query string before logging to prevent
 *   sensitive parameters (e.g. `?token=…`, `?api_key=…`) from being captured
 *   in log sinks or SIEM systems.
 *
 * - **Response serializer** (`res`): Emits only `statusCode`. Headers are
 *   intentionally omitted because they can contain `Set-Cookie` values that
 *   should never appear in plain-text logs.
 *
 * The shared `logger` instance (from `lib/logger.ts`) is passed to keep log
 * levels and transport configuration in a single place.
 */
app.use(
  pinoHttp({
    logger,
    serializers: {
      /**
       * Serialises an inbound HTTP request for pino-http log output.
       *
       * @param req - The raw Node.js `IncomingMessage` object exposed by pino-http.
       * @returns A plain object containing only `id`, `method`, and a sanitised `url`
       *   (query string removed) suitable for structured logging.
       */
      req(req) {
        return {
          id: req.id,
          method: req.method,
          // Strip query string so filter/search parameters don't pollute logs
          url: req.url?.split("?")[0],
        };
      },
      /**
       * Serialises an outbound HTTP response for pino-http log output.
       *
       * @param res - The raw Node.js `ServerResponse` object exposed by pino-http.
       * @returns A plain object containing only `statusCode`. Response headers,
       *   which may include `Set-Cookie`, are deliberately excluded.
       */
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Allow cross-origin requests from any origin (the front-end is served separately)
app.use(cors());

// Parse JSON request bodies (required for POST/PATCH routes)
app.use(express.json());

// Also parse URL-encoded bodies for form submissions
app.use(express.urlencoded({ extended: true }));

// All API routes are namespaced under /api to distinguish them from the UI
app.use("/api", router);

export default app;
