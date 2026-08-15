/**
 * @file routes/aocs.ts
 * @description REST endpoints for the `aocs` resource (Attestations of
 * Compliance). An AOC is a formal document issued after a successful PCI DSS
 * assessment that certifies an entity's compliance for a given period. AOCs
 * are ordered by creation date to make the most-recent attestation easy to
 * find.
 *
 * Business rules enforced here:
 * - AOC IDs are server-generated UUIDs; clients cannot pre-determine them.
 * - Results are always ordered by `createdAt` ascending so the oldest (baseline)
 *   AOC appears first and the most recent one last, which matches the expected
 *   chronological audit trail order.
 * - The query parameter `frameworkId` is mapped to the database column
 *   `frameworkCode` (naming discrepancy inherited from the initial schema design).
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

/**
 * Express sub-router that owns all `/aocs` routes.
 * @type {IRouter}
 */
const router: IRouter = Router();

/**
 * GET /aocs
 *
 * Returns AOC records ordered by `createdAt` ascending (oldest first). This
 * chronological order reflects the progression of an entity's compliance
 * history and is the most natural view for compliance auditors reviewing the
 * certification timeline.
 *
 * Supported query parameters:
 * - `entityCode`  {string} — Filter to AOCs issued for a specific entity.
 *   Maps to the `entityCode` column (exact equality match).
 * - `frameworkId` {string} — Filter to AOCs covering a specific compliance
 *   framework. **Note:** the query parameter is named `frameworkId` but maps
 *   to the `frameworkCode` column in the database (historical naming discrepancy).
 *
 * Multiple filters are combined with AND semantics.
 *
 * @param req       - Express `Request`.
 * @param req.query - Parsed query string. Recognised keys: `entityCode`, `frameworkId`.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>} Resolves after sending an HTTP 200 response whose
 *   body conforms to the `ListAocsResponse` Zod schema:
 *   `Array<{ id, entityCode, frameworkCode, issuedDate, expiryDate, fileUrl, ... }>`.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
 * Creates a new Attestation of Compliance record with a server-generated UUID.
 * The request body is validated against `CreateAocBody` before the insert,
 * so invalid payloads are rejected cheaply without a database round-trip.
 *
 * @param req      - Express `Request`.
 * @param req.body - JSON payload conforming to `CreateAocBody`:
 *   `{ entityCode, frameworkCode, issuedDate, expiryDate, fileUrl?, assessorName?, ... }`.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 201 with a body conforming to `CreateAocResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *
 * @throws Propagates unhandled database errors (e.g. foreign key violations)
 *   as uncaught rejections.
 */
router.post("/aocs", async (req, res): Promise<void> => {
  const parsed = CreateAocBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Server-generated UUID ensures clients cannot pre-determine or spoof IDs
  const id = crypto.randomUUID();
  const [row] = await db.insert(aocsTable).values({ id, ...parsed.data }).returning();
  res.status(201).json(CreateAocResponse.parse(serializeDates(row)));
});

/**
 * GET /aocs/:id
 *
 * Retrieves a single AOC record by its UUID primary key.
 * Returns HTTP 404 when no matching row exists, conforming to REST
 * singleton-resource conventions.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - The AOC's UUID. Normalised to a plain string to
 *   guard against Express surfacing it as an array.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `GetAocResponse` on success.
 *   - HTTP 404 with `{ error: "AOC not found" }` when the UUID is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
 * Applies a partial update to an existing AOC record. Only the fields present
 * in the request body are written to the database; all other columns retain
 * their current values.
 *
 * Common use-cases:
 * - Attaching a document URL (`fileUrl`) once the signed AOC PDF has been
 *   uploaded to object storage.
 * - Correcting the expiry date after a typo during initial entry.
 * - Updating the assessor name or QSA details.
 *
 * If Drizzle's `.returning()` yields an empty array, the target row does not
 * exist and HTTP 404 is returned.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - UUID of the AOC to update.
 * @param req.body      - Partial payload conforming to `UpdateAocBody`.
 *   Any subset of the AOC's mutable fields is accepted.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `UpdateAocResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *   - HTTP 404 with `{ error: "AOC not found" }` when the UUID is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
