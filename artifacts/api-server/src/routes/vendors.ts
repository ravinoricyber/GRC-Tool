/**
 * @file routes/vendors.ts
 * @description REST endpoints for the `vendors` resource. Vendors are
 * third-party service providers assessed for security risk. Each vendor
 * carries a `riskLevel` rating and an `entities` array listing the
 * business units that engage with the vendor.
 *
 * Business rules enforced here:
 * - Filtering by `entityCode` uses `arrayContains` because the `entities`
 *   column is a PostgreSQL array — a single vendor can serve multiple business
 *   units, so an equality check would only match vendors exclusively associated
 *   with that one entity.
 * - Vendor IDs are server-generated UUIDs; clients cannot pre-determine them.
 * - Hard deletes are supported. No referential integrity is enforced at the
 *   application layer; callers should confirm the vendor is no longer
 *   referenced before deletion.
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

/**
 * Express sub-router that owns all `/vendors` routes.
 * @type {IRouter}
 */
const router: IRouter = Router();

/**
 * GET /vendors
 *
 * Returns vendor records ordered alphabetically by `name`. The consistent
 * sort order makes the list predictable in UI dropdowns and tables without
 * requiring client-side sorting.
 *
 * Supported query parameters:
 * - `entityCode` {string} — Filter to vendors engaged by a specific entity.
 *   Uses `arrayContains` because `entities` is a PostgreSQL array column and
 *   a vendor may serve multiple business units simultaneously.
 * - `riskLevel`  {string} — Filter by risk classification. One of
 *   `"critical"`, `"high"`, `"medium"`, `"low"`.
 *
 * Multiple filters are combined with AND semantics.
 *
 * @param req       - Express `Request`.
 * @param req.query - Parsed query string. Recognised keys: `entityCode`, `riskLevel`.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>} Resolves after sending an HTTP 200 response whose
 *   body conforms to the `ListVendorsResponse` Zod schema:
 *   `Array<{ id, name, riskLevel, entities, lastAssessedDate, ... }>`.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.get("/vendors", async (req, res): Promise<void> => {
  const { entityCode, riskLevel } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  // arrayContains checks that the `entities` array column contains [entityCode] as a subset
  if (entityCode) conditions.push(arrayContains(vendorsTable.entities, [entityCode]));
  // `riskLevel` is a scalar column so a simple equality check is appropriate
  if (riskLevel) conditions.push(eq(vendorsTable.riskLevel, riskLevel));

  const query = db.select().from(vendorsTable).orderBy(vendorsTable.name);
  const rows = conditions.length ? await query.where(and(...conditions)) : await query;
  res.json(ListVendorsResponse.parse(serializeDates(rows)));
});

/**
 * POST /vendors
 *
 * Creates a new vendor record with a server-generated UUID. The request body
 * is validated against `CreateVendorBody` before the insert so invalid
 * payloads fail cheaply without a database round-trip.
 *
 * @param req      - Express `Request`.
 * @param req.body - JSON payload conforming to `CreateVendorBody`:
 *   `{ name, riskLevel, entities: string[], description?,
 *      lastAssessedDate?, contactName?, contactEmail?, ... }`.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 201 with a body conforming to `CreateVendorResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *
 * @throws Propagates unhandled database errors (e.g. unique constraint
 *   violations) as uncaught rejections.
 */
router.post("/vendors", async (req, res): Promise<void> => {
  const parsed = CreateVendorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Server-generated UUID ensures clients cannot pre-determine or spoof IDs
  const id = crypto.randomUUID();
  const [row] = await db.insert(vendorsTable).values({ id, ...parsed.data }).returning();
  res.status(201).json(CreateVendorResponse.parse(serializeDates(row)));
});

/**
 * GET /vendors/:id
 *
 * Retrieves a single vendor record by its UUID primary key.
 * Returns HTTP 404 when no matching row exists.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - The vendor's UUID. Normalised to a plain string to
 *   guard against Express surfacing it as an array.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `GetVendorResponse` on success.
 *   - HTTP 404 with `{ error: "Vendor not found" }` when the UUID is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
 * Applies a partial update to an existing vendor record. Only the fields
 * present in the request body are written; all other columns retain their
 * current values.
 *
 * Common use-cases:
 * - Updating `riskLevel` after a re-assessment changes the vendor's risk
 *   classification (e.g. from `"high"` to `"medium"` after remediation).
 * - Adding a new entity to the `entities` array when a new business unit
 *   begins using the vendor's services.
 * - Recording the `lastAssessedDate` after a periodic vendor review.
 *
 * If Drizzle's `.returning()` yields an empty array, the target row does not
 * exist and HTTP 404 is returned.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - UUID of the vendor to update.
 * @param req.body      - Partial payload conforming to `UpdateVendorBody`.
 *   Any subset of the vendor's mutable fields is accepted.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `UpdateVendorResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *   - HTTP 404 with `{ error: "Vendor not found" }` when the UUID is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
 * Permanently removes a vendor record. This is a hard delete with no
 * soft-delete or archival mechanism. The operation is idempotent: deleting a
 * non-existent ID succeeds silently (Drizzle's `.delete()` does not error on
 * zero-row deletes).
 *
 * No referential integrity checks are performed at the application layer.
 * Callers should verify the vendor is not referenced elsewhere (e.g. in
 * assessment notes or control metadata) before issuing a delete.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - UUID of the vendor to delete.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>} Resolves after sending HTTP 204 No Content.
 *
 * @throws Propagates unhandled database errors (e.g. foreign key constraint
 *   violations at the DB level) as uncaught rejections.
 */
router.delete("/vendors/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
  res.status(204).send();
});

export default router;
