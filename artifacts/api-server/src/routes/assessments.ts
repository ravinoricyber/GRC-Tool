/**
 * @file routes/assessments.ts
 * @description REST endpoints for the `assessments` resource. An assessment
 * is a scheduled or ad-hoc review of an entity's controls against a
 * specific compliance framework. When an assessment is created, the
 * framework's human-readable `code` and `name` are denormalised onto the
 * assessment row to avoid joins on every read path.
 *
 * Business rules enforced here:
 * - On creation, the framework's `code` and `name` are fetched from
 *   `frameworksTable` and stored directly on the assessment row
 *   (denormalisation). This eliminates joins on every read and ensures that
 *   the display name is preserved even if the framework record is later
 *   renamed. If the framework does not exist, the raw `frameworkId` is used as
 *   the code fallback and `frameworkName` is stored as `null`.
 * - Assessment IDs are server-generated UUIDs.
 * - Results are always ordered by `createdAt` ascending so the assessment
 *   history is presented chronologically.
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

/**
 * Express sub-router that owns all `/assessments` routes.
 * @type {IRouter}
 */
const router: IRouter = Router();

/**
 * GET /assessments
 *
 * Returns assessment records ordered by `createdAt` ascending (oldest first),
 * providing a chronological view of the entity's assessment history.
 *
 * Supported query parameters:
 * - `entityCode`  {string} — Filter to assessments for a specific entity.
 * - `frameworkId` {string} — Filter to assessments targeting a specific
 *   framework UUID. Maps to the `frameworkId` column.
 * - `status`      {string} — Lifecycle status. One of `"open"`,
 *   `"in-review"`, `"closed"`.
 *
 * Multiple filters are combined with AND semantics.
 *
 * @param req       - Express `Request`.
 * @param req.query - Parsed query string. Recognised keys: `entityCode`,
 *   `frameworkId`, `status`.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>} Resolves after sending an HTTP 200 response whose
 *   body conforms to the `ListAssessmentsResponse` Zod schema:
 *   `Array<{ id, entityCode, frameworkId, frameworkCode, frameworkName,
 *             status, scheduledDate, ... }>`.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.get("/assessments", async (req, res): Promise<void> => {
  const { entityCode, frameworkId, status } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  if (entityCode) conditions.push(eq(assessmentsTable.entityCode, entityCode));
  if (frameworkId) conditions.push(eq(assessmentsTable.frameworkId, frameworkId));
  if (status) conditions.push(eq(assessmentsTable.status, status));

  // Always sort chronologically so assessment history is presented oldest-first
  const query = db.select().from(assessmentsTable).orderBy(assessmentsTable.createdAt);
  const rows = conditions.length ? await query.where(and(...conditions)) : await query;
  res.json(ListAssessmentsResponse.parse(serializeDates(rows)));
});

/**
 * POST /assessments
 *
 * Creates a new assessment and denormalises framework metadata onto the row.
 *
 * **Denormalisation step:** After validating the request body, this handler
 * looks up the framework record identified by `parsed.data.frameworkId` and
 * copies its `code` and `name` fields directly onto the assessment row as
 * `frameworkCode` and `frameworkName`. This approach:
 * - Removes the need for a JOIN whenever assessments are listed.
 * - Preserves the framework's display name at the time of assessment creation,
 *   so renaming the framework later does not silently alter historical records.
 * - Falls back to the raw `frameworkId` string as `frameworkCode` and `null`
 *   as `frameworkName` if the framework record cannot be found (defensive
 *   coding against race conditions or orphaned references).
 *
 * @param req      - Express `Request`.
 * @param req.body - JSON payload conforming to `CreateAssessmentBody`:
 *   `{ entityCode, frameworkId, status?, scheduledDate?, assignedTo?, ... }`.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 201 with a body conforming to `CreateAssessmentResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
  // `frameworkName` is stored as null when the framework cannot be resolved so
  // the UI can distinguish between "unknown framework" and "framework named null"
  const frameworkName = fw[0]?.name ?? null;

  const [row] = await db.insert(assessmentsTable).values({ id, frameworkCode, frameworkName, ...parsed.data }).returning();
  res.status(201).json(CreateAssessmentResponse.parse(serializeDates(row)));
});

/**
 * GET /assessments/:id
 *
 * Retrieves a single assessment by its UUID primary key.
 * Returns HTTP 404 when no matching row exists.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - The assessment's UUID. Normalised to a plain string
 *   to guard against Express surfacing it as an array.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `GetAssessmentResponse` on success.
 *   - HTTP 404 with `{ error: "Assessment not found" }` when the UUID is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
 * Applies a partial update to an existing assessment record. Only the fields
 * present in the request body are written; all other columns retain their
 * current values.
 *
 * Common use-cases:
 * - Advancing the status through its lifecycle (`"open"` → `"in-review"` →
 *   `"closed"`).
 * - Updating the scheduled completion date when work is rescheduled.
 * - Assigning or re-assigning the assessment to a different reviewer.
 *
 * If Drizzle's `.returning()` yields an empty array, the target row does not
 * exist and HTTP 404 is returned.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - UUID of the assessment to update.
 * @param req.body      - Partial payload conforming to `UpdateAssessmentBody`.
 *   Any subset of the assessment's mutable fields is accepted.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `UpdateAssessmentResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *   - HTTP 404 with `{ error: "Assessment not found" }` when the UUID is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
