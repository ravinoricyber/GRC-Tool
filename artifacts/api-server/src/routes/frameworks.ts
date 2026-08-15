/**
 * @file routes/frameworks.ts
 * @description REST endpoints for the `frameworks` resource. Frameworks
 * represent compliance standards tracked by the organisation (e.g.
 * PCI DSS 4.0, SOC 2 Type II). Controls and assessments are associated with
 * a framework via `frameworkId`.
 *
 * Business rules enforced here:
 * - Framework IDs are server-generated UUIDs; clients cannot pre-determine or
 *   spoof primary keys.
 * - Partial updates (PATCH) only touch the fields supplied in the request body;
 *   unspecified fields retain their current database values.
 * - All bodies are validated with Zod before any database operation, so invalid
 *   requests fail cheaply without an unnecessary round-trip to the database.
 *
 * Routes:
 *   GET   /frameworks      — list all frameworks, ordered alphabetically by name
 *   POST  /frameworks      — create a new framework
 *   GET   /frameworks/:id  — retrieve a single framework by UUID
 *   PATCH /frameworks/:id  — partially update a framework
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, frameworksTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListFrameworksResponse,
  GetFrameworkResponse,
  CreateFrameworkBody,
  CreateFrameworkResponse,
  UpdateFrameworkBody,
  UpdateFrameworkResponse,
} from "@workspace/api-zod";

/**
 * Express sub-router that owns all `/frameworks` routes.
 * @type {IRouter}
 */
const router: IRouter = Router();

/**
 * GET /frameworks
 *
 * Returns all compliance framework records ordered alphabetically by `name`.
 * The sort order is stable and predictable, making the list safe to render in
 * a UI select-box without client-side sorting.
 *
 * @param req - Express `Request`. No query parameters are read.
 * @param res - Express `Response`. Sends the validated array of framework objects.
 *
 * @returns {Promise<void>} Resolves after sending an HTTP 200 response whose
 *   body conforms to the `ListFrameworksResponse` Zod schema:
 *   `Array<{ id, code, name, status, ... }>`.
 *
 * @throws Propagates unhandled Drizzle/database errors as uncaught rejections.
 */
router.get("/frameworks", async (req, res): Promise<void> => {
  const rows = await db.select().from(frameworksTable).orderBy(frameworksTable.name);
  res.json(ListFrameworksResponse.parse(serializeDates(rows)));
});

/**
 * POST /frameworks
 *
 * Creates a new compliance framework record. The request body is validated
 * against the `CreateFrameworkBody` Zod schema before any database interaction,
 * so malformed requests are rejected with HTTP 400 without touching the DB.
 *
 * A UUID is generated server-side via `crypto.randomUUID()` to ensure that:
 * - Clients cannot pre-determine the primary key.
 * - IDs are globally unique even across multiple server instances.
 *
 * @param req      - Express `Request`.
 * @param req.body - JSON payload conforming to `CreateFrameworkBody`:
 *   `{ code: string, name: string, status?: string, ... }`.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 201 with a body conforming to `CreateFrameworkResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails (the error
 *     message summarises all failing fields and their constraints).
 *
 * @throws Propagates unhandled database errors (e.g. unique constraint
 *   violations on `code`) as uncaught rejections.
 */
router.post("/frameworks", async (req, res): Promise<void> => {
  // Validate before touching the database so invalid requests fail cheaply
  const parsed = CreateFrameworkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { data } = parsed;
  // Server-generated UUID ensures clients cannot pre-determine or spoof IDs
  const id = crypto.randomUUID();
  const [row] = await db.insert(frameworksTable).values({ id, ...data }).returning();
  res.status(201).json(CreateFrameworkResponse.parse(serializeDates(row)));
});

/**
 * GET /frameworks/:id
 *
 * Retrieves a single compliance framework by its UUID primary key.
 * Returns HTTP 404 rather than an empty array when no matching row exists,
 * conforming to REST singleton-resource conventions.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - The framework's UUID string. Normalised to a plain
 *   string in case Express surfaces it as an array.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `GetFrameworkResponse` on success.
 *   - HTTP 404 with `{ error: "Framework not found" }` when the ID is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.get("/frameworks/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(frameworksTable).where(eq(frameworksTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Framework not found" });
    return;
  }
  res.json(GetFrameworkResponse.parse(serializeDates(rows[0])));
});

/**
 * PATCH /frameworks/:id
 *
 * Applies a partial update to an existing framework record. Only the fields
 * explicitly provided in the request body are written to the database; all
 * other columns retain their current values (standard PATCH semantics).
 *
 * The body is validated against `UpdateFrameworkBody` (all fields optional)
 * before the update query runs. If Drizzle's `.returning()` yields an empty
 * array it means no row matched the `WHERE` clause, which is reported as HTTP 404.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - UUID of the framework to update.
 * @param req.body      - Partial JSON payload conforming to `UpdateFrameworkBody`.
 *   Any subset of `{ code, name, status, ... }` is accepted.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `UpdateFrameworkResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *   - HTTP 404 with `{ error: "Framework not found" }` when the UUID is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.patch("/frameworks/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateFrameworkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(frameworksTable)
    .set(parsed.data)
    .where(eq(frameworksTable.id, id))
    .returning();
  // `.returning()` returns an empty array if no row matched the WHERE clause
  if (!row) {
    res.status(404).json({ error: "Framework not found" });
    return;
  }
  res.json(UpdateFrameworkResponse.parse(serializeDates(row)));
});

export default router;
