/**
 * @file routes/frameworks.ts
 * @description REST endpoints for the `frameworks` resource. Frameworks
 * represent compliance standards tracked by the organisation (e.g.
 * PCI DSS 4.0, SOC 2 Type II). Controls and assessments are associated with
 * a framework via `frameworkId`.
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

const router: IRouter = Router();

/**
 * GET /frameworks
 *
 * Returns all frameworks sorted alphabetically by name.
 */
router.get("/frameworks", async (req, res): Promise<void> => {
  const rows = await db.select().from(frameworksTable).orderBy(frameworksTable.name);
  res.json(ListFrameworksResponse.parse(serializeDates(rows)));
});

/**
 * POST /frameworks
 *
 * Creates a new framework. The request body is validated against
 * `CreateFrameworkBody`; a UUID is generated server-side so clients
 * cannot influence the primary key.
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
 * Returns a single framework by its UUID. Returns 404 when not found.
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
 * Applies a partial update to a framework. Only fields present in the
 * request body are updated; unspecified fields retain their existing values.
 * Returns 404 when the target row does not exist (Drizzle's `.returning()`
 * yields an empty array in that case).
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
