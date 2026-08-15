/**
 * @file routes/health.ts
 * @description Liveness health-check endpoint. Intended for use by container
 * orchestrators (Kubernetes, Docker Compose, Replit health checks) to
 * determine whether the process is alive and capable of handling requests.
 * The route intentionally performs no database I/O so it remains responsive
 * even when downstream dependencies are degraded.
 */

import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * GET /healthz
 *
 * Returns a minimal `{ status: "ok" }` payload validated against the
 * `HealthCheckResponse` Zod schema. Parsing through the schema acts as a
 * compile-time guard that the response shape matches what the generated
 * client expects.
 */
router.get("/healthz", (_req, res) => {
  // Parse through schema to ensure the response contract is honoured
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
