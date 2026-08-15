/**
 * @file routes/vendors.ts
 * @description REST endpoints for the `vendors` resource. Vendors are
 * third-party service providers assessed for security risk. Each vendor
 * carries a `riskLevel` rating and an `entities` array listing the
 * business units that engage with the vendor.
 *
 * Routes:
 *   GET    /vendors      — list vendors with optional filtering
 *   POST   /vendors      — create a new vendor record
 *   GET    /vendors/:id  — retrieve a single vendor by UUID
 *   PATCH  /vendors/:id  — partially update a vendor record
 *   DELETE /vendors/:id  — permanently delete a vendor record
 */

import { Router, type IRouter } from "express";
import { eq, and, SQL, arrayContains } from "drizzle-orm";
import { db, vendorsTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListVendorsResponse,
  GetVendorResponse,
  CreateVendorBody,
  CreateVendorResponse,
  UpdateVendorBody,
  UpdateVendorResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * GET /vendors
 *
 * Returns vendors ordered alphabetically by name. Supports optional filtering by:
 * - `entityCode` — vendors whose `entities` array contains the given code
 *                  (uses `arrayContains` because `entities` is a PG array column)
 * - `riskLevel`  — risk classification (`"critical"`, `"high"`, `"medium"`, `"low"`)
 */
router.get("/vendors", async (req, res): Promise<void> => {
  const { entityCode, riskLevel } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  // arrayContains checks that the `entities` array column contains [entityCode] as a subset
  if (entityCode) conditions.push(arrayContains(vendorsTable.entities, [entityCode]));
  if (riskLevel) conditions.push(eq(vendorsTable.riskLevel, riskLevel));

  const query = db.select().from(vendorsTable).orderBy(vendorsTable.name);
  const rows = conditions.length ? await query.where(and(...conditions)) : await query;
  res.json(ListVendorsResponse.parse(serializeDates(rows)));
});

/**
 * POST /vendors
 *
 * Creates a new vendor with a server-generated UUID. The body is validated
 * against `CreateVendorBody` before the insert.
 */
router.post("/vendors", async (req, res): Promise<void> => {
  const parsed = CreateVendorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const id = crypto.randomUUID();
  const [row] = await db.insert(vendorsTable).values({ id, ...parsed.data }).returning();
  res.status(201).json(CreateVendorResponse.parse(serializeDates(row)));
});

/**
 * GET /vendors/:id
 *
 * Returns a single vendor by its UUID. Returns 404 when not found.
 */
router.get("/vendors/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }
  res.json(GetVendorResponse.parse(serializeDates(rows[0])));
});

/**
 * PATCH /vendors/:id
 *
 * Partially updates a vendor record. Common use-cases include updating the
 * risk level after a re-assessment or adding new associated entities.
 * Returns 404 when the target row does not exist.
 */
router.patch("/vendors/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateVendorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(vendorsTable).set(parsed.data).where(eq(vendorsTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }
  res.json(UpdateVendorResponse.parse(serializeDates(row)));
});

/**
 * DELETE /vendors/:id
 *
 * Permanently removes a vendor record. No referential checks are performed
 * here — callers should verify the vendor is not referenced elsewhere before
 * deletion.
 */
router.delete("/vendors/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
  res.status(204).send();
});

export default router;
