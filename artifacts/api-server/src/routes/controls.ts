/**
 * @file routes/controls.ts
 * @description REST endpoints for the `controls` resource. Controls are
 * individual compliance requirements derived from a framework (e.g. a
 * PCI DSS requirement). Each control carries a `finding` field that reflects
 * its current assessment status (`"in-place"`, `"not-in-place"`, `"not-tested"`).
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

const router: IRouter = Router();

/**
 * GET /controls
 *
 * Returns a paginated list of controls. Supports the following query parameters:
 * - `frameworkId`  — filter by the parent framework's UUID
 * - `entityCode`   — filter by the entity the control belongs to
 * - `status`       — filter by `finding` value (`"in-place"`, `"not-in-place"`, `"not-tested"`)
 * - `limit`        — maximum rows to return (default 200)
 * - `offset`       — number of rows to skip for pagination (default 0)
 *
 * Conditions are accumulated dynamically and combined with AND semantics.
 * When no filters are supplied the full table is returned (up to `limit`).
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
 * Returns a single control by its UUID. Returns 404 when not found.
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
 * Partially updates a control. Typical use-case is updating the `finding`
 * value after a re-assessment. Returns 404 when the target row does not exist.
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
