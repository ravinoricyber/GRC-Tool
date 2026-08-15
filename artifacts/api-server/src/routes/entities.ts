/**
 * @file routes/entities.ts
 * @description REST endpoints for the `entities` resource. Entities represent
 * the distinct business units within the organisation (e.g. Gopuff,
 * BevMo!, Liquor Barn). Each entity has a unique short `code` that is used
 * as a foreign key in most other resources (controls, evidence, assessments).
 *
 * Business rules enforced here:
 * - Entity lookup uses the human-readable `code` (e.g. `"gopuff"`) as the
 *   URL parameter rather than a UUID, since codes are stable, meaningful, and
 *   used extensively in filter parameters throughout the API.
 * - Results are always sorted alphabetically by `name` to provide a consistent
 *   list order regardless of insertion sequence.
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

/**
 * Express sub-router that owns all `/entities` routes.
 * @type {IRouter}
 */
const router: IRouter = Router();

/**
 * GET /entities
 *
 * Retrieves all entity records ordered alphabetically by the `name` column.
 * The consistent ordering means the front-end entity switcher always presents
 * business units in the same sequence without client-side sorting.
 *
 * Results are run through `serializeDates` to convert Drizzle's `Date` objects
 * (e.g. `nextAocDate`) into ISO-8601 strings before Zod validation, which
 * expects string types for all timestamp fields.
 *
 * @param req - Express `Request`. No query parameters are read.
 * @param res - Express `Response`. Sends the validated array of entity objects.
 *
 * @returns {Promise<void>} Resolves after sending an HTTP 200 response whose
 *   body conforms to the `ListEntitiesResponse` Zod schema:
 *   `Array<{ id, code, name, nextAocDate, ... }>`.
 *
 * @throws Will propagate any unhandled Drizzle/PostgreSQL errors as uncaught
 *   promise rejections if the database is unavailable.
 */
router.get("/entities", async (req, res): Promise<void> => {
  const rows = await db.select().from(entitiesTable).orderBy(entitiesTable.name);
  // serializeDates converts Date columns (e.g. nextAocDate) to ISO strings
  res.json(ListEntitiesResponse.parse(serializeDates(rows)));
});

/**
 * GET /entities/:code
 *
 * Retrieves a single entity by its short, human-readable `code` (e.g.
 * `"gopuff"`, `"bevmo"`, `"liquorbarn"`). Using `code` instead of a UUID
 * keeps URLs legible and aligns with how entities are referenced across the
 * rest of the API (all filter parameters use `entityCode`).
 *
 * Returns HTTP 404 when no row matches the given code, conforming to REST
 * conventions for singleton resource lookups rather than returning an empty
 * list.
 *
 * @param req         - Express `Request`.
 * @param req.params.code - The entity's short code string (e.g. `"gopuff"`).
 *   The value is normalised to a plain string in case Express surfaces it as
 *   an array (which can occur with certain router configurations).
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `GetEntityResponse` on success.
 *   - HTTP 404 with `{ error: "Entity not found" }` when the code is unknown.
 *
 * @throws Will propagate any unhandled database errors as uncaught promise
 *   rejections.
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
