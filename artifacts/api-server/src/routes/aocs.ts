/**
 * @file routes/aocs.ts
 * @description REST endpoints for the `aocs` resource (Attestations of
 * Compliance). An AOC is a formal document issued after a successful PCI DSS
 * assessment that certifies an entity's compliance for a given period. AOCs
 * are ordered by creation date to make the most-recent attestation easy to
 * find.
 *
 * Routes:
 *   GET   /aocs      — list AOCs with optional filtering
 *   POST  /aocs      — create a new AOC record
 *   GET   /aocs/:id  — retrieve a single AOC by UUID
 *   PATCH /aocs/:id  — partially update an AOC record
 */

import { Router, type IRouter } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, aocsTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListAocsResponse,
  GetAocResponse,
  CreateAocBody,
  CreateAocResponse,
  UpdateAocBody,
  UpdateAocResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * GET /aocs
 *
 * Returns AOC records ordered by `createdAt` ascending. Supports optional
 * filtering by:
 * - `entityCode`  — the entity the AOC was issued for
 * - `frameworkId` — the compliance framework the AOC covers (maps to `frameworkCode`)
 */
router.get("/aocs", async (req, res): Promise<void> => {
  const { entityCode, frameworkId } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  if (entityCode) conditions.push(eq(aocsTable.entityCode, entityCode));
  // Note: the query param is named `frameworkId` but the column is `frameworkCode`
  if (frameworkId) conditions.push(eq(aocsTable.frameworkCode, frameworkId));

  // Always order by creation date so the oldest (baseline) AOC appears first
  const query = db.select().from(aocsTable).orderBy(aocsTable.createdAt);
  const rows = conditions.length ? await query.where(and(...conditions)) : await query;
  res.json(ListAocsResponse.parse(serializeDates(rows)));
});

/**
 * POST /aocs
 *
 * Creates a new AOC record with a server-generated UUID. The body is
 * validated against `CreateAocBody` before the insert.
 */
router.post("/aocs", async (req, res): Promise<void> => {
  const parsed = CreateAocBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const id = crypto.randomUUID();
  const [row] = await db.insert(aocsTable).values({ id, ...parsed.data }).returning();
  res.status(201).json(CreateAocResponse.parse(serializeDates(row)));
});

/**
 * GET /aocs/:id
 *
 * Returns a single AOC by its UUID. Returns 404 when not found.
 */
router.get("/aocs/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(aocsTable).where(eq(aocsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "AOC not found" });
    return;
  }
  res.json(GetAocResponse.parse(serializeDates(rows[0])));
});

/**
 * PATCH /aocs/:id
 *
 * Partially updates an AOC. Typical use-cases include adding document
 * metadata (e.g. a file URL) or updating the expiry date. Returns 404 when
 * the target row does not exist.
 */
router.patch("/aocs/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateAocBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(aocsTable).set(parsed.data).where(eq(aocsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "AOC not found" });
    return;
  }
  res.json(UpdateAocResponse.parse(serializeDates(row)));
});

export default router;
