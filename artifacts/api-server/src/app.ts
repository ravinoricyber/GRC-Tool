/**
 * @file app.ts
 * @description Express application factory. Configures middleware (structured
 * HTTP logging, CORS, JSON body parsing) and mounts the API router under
 * the `/api` prefix. The resulting Express instance is exported for use
 * by the server entry-point and by integration tests.
 */

import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

/**
 * Structured per-request HTTP logging via pino-http.
 * Serializers intentionally strip query strings from logged URLs to avoid
 * accidentally capturing sensitive parameters (e.g. token= values) in logs.
 * The shared `logger` instance keeps log levels and transports consistent
 * with the rest of the application.
 */
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          // Strip query string so filter/search parameters don't pollute logs
          url: req.url?.split("?")[0],
        };
      },
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
