/**
 * @file routes/controls.ts
 * @description REST endpoints for the `controls` resource. Controls are
 * individual compliance requirements derived from a framework (e.g. a
 * PCI DSS requirement). Each control carries a `finding` field that reflects
 * its current assessment status (`"in-place"`, `"not-in-place"`, `"not-tested"`).
 *
 * Business rules enforced here:
 * - The `status` query parameter is an alias for the database column `finding`;
 *   the mapping is handled here to keep the public API vocabulary consistent
 *   with the rest of the codebase while matching the internal schema name.
 * - Multiple query filters are composed with AND semantics so callers can
 *   combine `frameworkId + entityCode + status` in a single request.
 * - Pagination is mandatory (defaulting to `limit=200, offset=0`) to prevent
 *   full-table scans from large control libraries reaching the client in one shot.
 *
 * Routes:
 *   GET   /controls      — list controls with optional filtering
 *   GET   /controls/:id  — retrieve a single control by UUID
 *   PATCH /controls/:id  — partially update a control (e.g. update finding)
 */

import { Router, type IRouter } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, controlsTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListControlsResponse,
  GetControlResponse,
  UpdateControlBody,
  UpdateControlResponse,
} from "@workspace/api-zod";

/**
 * Express sub-router that owns all `/controls` routes.
 * @type {IRouter}
 */
const router: IRouter = Router();

/**
 * GET /controls
 *
 * Returns a paginated, optionally filtered list of compliance control records.
 * Filters are combined with AND semantics — only controls matching *all*
 * supplied criteria are returned. When no filters are given the full table is
 * returned up to `limit`.
 *
 * Supported query parameters:
 * - `frameworkId` {string} — UUID of the parent framework. Maps to the
 *   `frameworkId` column.
 * - `entityCode`  {string} — Short code of the entity the control belongs to.
 *   Maps to the `entityCode` column.
 * - `status`      {string} — Current assessment outcome. One of
 *   `"in-place"`, `"not-in-place"`, `"not-tested"`. **Note:** the query
 *   parameter is named `status` but maps to the database column `finding`.
 * - `limit`       {number} — Maximum number of rows to return. Defaults to 200.
 * - `offset`      {number} — Number of rows to skip (0-based). Defaults to 0.
 *   Used together with `limit` for cursor-free pagination.
 *
 * @param req       - Express `Request`.
 * @param req.query - Parsed query string; all values are treated as strings.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>} Resolves after sending an HTTP 200 response whose
 *   body conforms to the `ListControlsResponse` Zod schema:
 *   `Array<{ id, frameworkId, entityCode, finding, domainNumber, ... }>`.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.get("/controls", async (req, res): Promise<void> => {
  const { frameworkId, entityCode, status, limit, offset } = req.query as Record<string, string | undefined>;

  // Build filter predicates dynamically so we only apply conditions that were supplied
  const conditions: SQL[] = [];
  if (frameworkId) conditions.push(eq(controlsTable.frameworkId, frameworkId));
  if (entityCode) conditions.push(eq(controlsTable.entityCode, entityCode));
  // `status` maps to the `finding` column name in the DB schema
  if (status) conditions.push(eq(controlsTable.finding, status));

  const query = db.select().from(controlsTable);
  // Drizzle requires `.where()` to receive at least one condition; branch to avoid a no-op AND
  const rows = conditions.length
    ? await query.where(and(...conditions)).limit(Number(limit) || 200).offset(Number(offset) || 0)
    : await query.limit(Number(limit) || 200).offset(Number(offset) || 0);
  res.json(ListControlsResponse.parse(serializeDates(rows)));
});

/**
 * GET /controls/:id
 *
 * Retrieves a single compliance control by its UUID primary key.
 * Returns HTTP 404 when no matching row exists.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - The control's UUID string. Normalised to a plain
 *   string to guard against Express surfacing it as an array.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `GetControlResponse` on success.
 *   - HTTP 404 with `{ error: "Control not found" }` when the UUID is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.get("/controls/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(controlsTable).where(eq(controlsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Control not found" });
    return;
  }
  res.json(GetControlResponse.parse(serializeDates(rows[0])));
});

/**
 * PATCH /controls/:id
 *
 * Applies a partial update to an existing control record. The most common
 * use-case is updating the `finding` field after a re-assessment changes the
 * control's compliance status from `"not-tested"` to `"in-place"` or
 * `"not-in-place"`.
 *
 * Only the fields present in the request body are written; all other columns
 * retain their current values. The body is validated against `UpdateControlBody`
 * before the database operation.
 *
 * If Drizzle's `.returning()` yields an empty array it means the `WHERE` clause
 * matched no row, which is reported as HTTP 404.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - UUID of the control to update.
 * @param req.body      - Partial payload conforming to `UpdateControlBody`.
 *   Accepted fields include `finding`, `title`, `description`, and others
 *   defined in the schema.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `UpdateControlResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *   - HTTP 404 with `{ error: "Control not found" }` when the UUID is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.patch("/controls/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateControlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(controlsTable)
    .set(parsed.data)
    .where(eq(controlsTable.id, id))
    .returning();
  // `.returning()` returns an empty array if no row matched the WHERE clause
  if (!row) {
    res.status(404).json({ error: "Control not found" });
    return;
  }
  res.json(UpdateControlResponse.parse(serializeDates(row)));
});

export default router;
