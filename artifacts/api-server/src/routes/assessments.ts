/**
 * @file routes/assessments.ts
 * @description REST endpoints for the `assessments` resource. An assessment
 * is a scheduled or ad-hoc review of an entity's controls against a
 * specific compliance framework. When an assessment is created, the
 * framework's human-readable `code` and `name` are denormalised onto the
 * assessment row to avoid joins on every read path.
 *
 * Routes:
 *   GET   /assessments      — list assessments with optional filtering
 *   POST  /assessments      — create a new assessment
 *   GET   /assessments/:id  — retrieve a single assessment by UUID
 *   PATCH /assessments/:id  — partially update an assessment
 */

import { Router, type IRouter } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, assessmentsTable, frameworksTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListAssessmentsResponse,
  GetAssessmentResponse,
  CreateAssessmentBody,
  CreateAssessmentResponse,
  UpdateAssessmentBody,
  UpdateAssessmentResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * GET /assessments
 *
 * Returns assessments ordered by `createdAt` ascending. Supports filtering by:
 * - `entityCode`  — the entity being assessed
 * - `frameworkId` — the framework UUID the assessment targets
 * - `status`      — lifecycle status (e.g. `"open"`, `"in-review"`, `"closed"`)
 */
router.get("/assessments", async (req, res): Promise<void> => {
  const { entityCode, frameworkId, status } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  if (entityCode) conditions.push(eq(assessmentsTable.entityCode, entityCode));
  if (frameworkId) conditions.push(eq(assessmentsTable.frameworkId, frameworkId));
  if (status) conditions.push(eq(assessmentsTable.status, status));

  const query = db.select().from(assessmentsTable).orderBy(assessmentsTable.createdAt);
  const rows = conditions.length ? await query.where(and(...conditions)) : await query;
  res.json(ListAssessmentsResponse.parse(serializeDates(rows)));
});

/**
 * POST /assessments
 *
 * Creates a new assessment. The framework's `code` and `name` are looked up
 * from `frameworksTable` and stored directly on the assessment row
 * (denormalisation). This avoids repeated joins when listing assessments and
 * ensures the display name is preserved even if the framework is later renamed.
 *
 * If the framework lookup yields no result the raw `frameworkId` is used as
 * the code fallback and `frameworkName` is stored as `null`.
 */
router.post("/assessments", async (req, res): Promise<void> => {
  const parsed = CreateAssessmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const id = crypto.randomUUID();

  // Resolve frameworkCode from frameworkId — denormalise onto the row for cheap reads
  const fw = await db.select().from(frameworksTable).where(eq(frameworksTable.id, parsed.data.frameworkId));
  // Fall back to the raw ID if the framework record doesn't exist (defensive coding)
  const frameworkCode = fw[0]?.code ?? parsed.data.frameworkId;
  const frameworkName = fw[0]?.name ?? null;

  const [row] = await db.insert(assessmentsTable).values({ id, frameworkCode, frameworkName, ...parsed.data }).returning();
  res.status(201).json(CreateAssessmentResponse.parse(serializeDates(row)));
});

/**
 * GET /assessments/:id
 *
 * Returns a single assessment by its UUID. Returns 404 when not found.
 */
router.get("/assessments/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(assessmentsTable).where(eq(assessmentsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }
  res.json(GetAssessmentResponse.parse(serializeDates(rows[0])));
});

/**
 * PATCH /assessments/:id
 *
 * Partially updates an assessment. Common operations include advancing the
 * status or updating the scheduled completion date. Returns 404 when the
 * target row does not exist.
 */
router.patch("/assessments/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateAssessmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(assessmentsTable).set(parsed.data).where(eq(assessmentsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Assessment not found" });
    return;
  }
  res.json(UpdateAssessmentResponse.parse(serializeDates(row)));
});

export default router;
