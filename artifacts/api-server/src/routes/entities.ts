/**
 * @file routes/entities.ts
 * @description REST endpoints for the `entities` resource. Entities represent
 * the distinct business units within the organisation (e.g. Gopuff,
 * BevMo!, Liquor Barn). Each entity has a unique short `code` that is used
 * as a foreign key in most other resources (controls, evidence, assessments).
 *
 * Routes:
 *   GET  /entities        — list all entities, ordered alphabetically by name
 *   GET  /entities/:code  — retrieve a single entity by its short code
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, entitiesTable } from "@workspace/db";
import { ListEntitiesResponse, GetEntityResponse } from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

/**
 * GET /entities
 *
 * Returns all entities sorted by name. Results are validated against the
 * `ListEntitiesResponse` Zod schema before being sent so that any schema
 * drift between the DB model and the API contract surfaces at runtime.
 */
router.get("/entities", async (req, res): Promise<void> => {
  const rows = await db.select().from(entitiesTable).orderBy(entitiesTable.name);
  // serializeDates converts Date columns (e.g. nextAocDate) to ISO strings
  res.json(ListEntitiesResponse.parse(serializeDates(rows)));
});

/**
 * GET /entities/:code
 *
 * Looks up an entity by its short code (e.g. `"gopuff"`). Returns 404 when
 * no matching row exists rather than returning an empty array, which aligns
 * with REST conventions for singleton resource lookups.
 */
router.get("/entities/:code", async (req, res): Promise<void> => {
  // Normalise: Express may present params as an array in some edge cases
  const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
  const rows = await db.select().from(entitiesTable).where(eq(entitiesTable.code, code));
  if (!rows[0]) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }
  res.json(GetEntityResponse.parse(serializeDates(rows[0])));
});

export default router;
