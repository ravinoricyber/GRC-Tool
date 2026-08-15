/**
 * @file routes/health.ts
 * @description Liveness health-check endpoint. Intended for use by container
 * orchestrators (Kubernetes, Docker Compose, and similar platforms) to
 * determine whether the process is alive and capable of handling requests.
 * The route intentionally performs no database I/O so it remains responsive
 * even when downstream dependencies are degraded.
 *
 * This distinction is important: this is a *liveness* probe (is the process
 * running?) not a *readiness* probe (can it serve traffic?). Readiness would
 * require a database ping, which could mask a DB outage as an application
 * failure.
 */

import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

/**
 * Express sub-router that owns the `/healthz` route.
 * @type {IRouter}
 */
const router: IRouter = Router();

/**
 * GET /healthz
 *
 * Liveness probe endpoint for container orchestrators and load-balancer health
 * checks. Returns a minimal `{ status: "ok" }` JSON payload immediately,
 * without touching the database or any other external dependency.
 *
 * The response body is validated through the `HealthCheckResponse` Zod schema
 * before sending. This acts as a compile-time guard ensuring the response shape
 * remains in sync with the generated client expectations; if the schema ever
 * changes, this parse will surface a runtime error during development before it
 * reaches production.
 *
 * @param _req - The Express `Request` object. Not used; prefixed with `_` to
 *   signal intentional non-use to linters.
 * @param res  - The Express `Response` object used to send the JSON payload.
 *
 * @returns {void} Sends an HTTP 200 response with body `{ "status": "ok" }`.
 *   This handler never produces a non-200 response under normal operation.
 */
router.get("/healthz", (_req, res) => {
  // Parse through schema to ensure the response contract is honoured
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
