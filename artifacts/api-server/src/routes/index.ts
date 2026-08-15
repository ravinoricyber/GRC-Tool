/**
 * @file routes/index.ts
 * @description Root API router. Assembles every feature-level sub-router into
 * a single Express `IRouter` that `app.ts` mounts under the `/api` prefix.
 * Adding a new feature router here is the only change required to register
 * its routes with the application.
 *
 * Each imported sub-router owns its own path prefix and HTTP method
 * declarations; this file is purely a composition root with no route logic
 * of its own.
 *
 * Sub-router responsibilities:
 * - `healthRouter`      — liveness probe (`GET /healthz`)
 * - `entitiesRouter`    — business unit CRUD (`/entities`)
 * - `frameworksRouter`  — compliance framework CRUD (`/frameworks`)
 * - `controlsRouter`    — individual control requirement CRUD (`/controls`)
 * - `evidenceRouter`    — evidence request lifecycle CRUD (`/evidence`)
 * - `policiesRouter`    — internal policy document CRUD (`/policies`)
 * - `aocsRouter`        — Attestation of Compliance CRUD (`/aocs`)
 * - `assessmentsRouter` — scheduled assessment CRUD (`/assessments`)
 * - `vendorsRouter`     — third-party vendor CRUD (`/vendors`)
 * - `activityRouter`    — read-only audit log (`/activity`)
 * - `dashboardRouter`   — aggregated KPI endpoints (`/dashboard/*`)
 */

import { Router, type IRouter } from "express";
import healthRouter from "./health";
import entitiesRouter from "./entities";
import frameworksRouter from "./frameworks";
import controlsRouter from "./controls";
import evidenceRouter from "./evidence";
import policiesRouter from "./policies";
import aocsRouter from "./aocs";
import assessmentsRouter from "./assessments";
import vendorsRouter from "./vendors";
import activityRouter from "./activity";
import dashboardRouter from "./dashboard";

/**
 * Root IRouter instance that aggregates all feature-level sub-routers.
 *
 * This router is mounted at `/api` by `app.ts`, making every sub-router's
 * routes accessible under that prefix (e.g. a sub-router at `/entities`
 * becomes reachable at `/api/entities`).
 *
 * @type {IRouter}
 */
const router: IRouter = Router();

// Each sub-router is responsible for its own path prefix and HTTP methods
router.use(healthRouter);
router.use(entitiesRouter);
router.use(frameworksRouter);
router.use(controlsRouter);
router.use(evidenceRouter);
router.use(policiesRouter);
router.use(aocsRouter);
router.use(assessmentsRouter);
router.use(vendorsRouter);
router.use(activityRouter);
router.use(dashboardRouter);

export default router;
