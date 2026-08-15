/**
 * @file routes/index.ts
 * @description Root API router. Assembles every feature-level sub-router into
 * a single Express `IRouter` that `app.ts` mounts under the `/api` prefix.
 * Adding a new feature router here is the only change required to register
 * its routes with the application.
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
