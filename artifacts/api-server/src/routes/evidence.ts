/**
 * @file routes/evidence.ts
 * @description REST endpoints for the `evidence` resource. Evidence requests
 * track artefacts that an entity must provide to satisfy a compliance control
 * (e.g. a penetration-test report, a screenshot of an access matrix). Each
 * request has a lifecycle status: `requested → in-progress → submitted →
 * approved | rejected`.
 *
 * Routes:
 *   GET    /evidence      — list evidence requests with optional filtering
 *   POST   /evidence      — create a new evidence request
 *   GET    /evidence/:id  — retrieve a single evidence request by UUID
 *   PATCH  /evidence/:id  — partially update (e.g. advance status, set approvedAt)
 *   DELETE /evidence/:id  — permanently delete an evidence request
 */

import { Router, type IRouter } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, evidenceRequestsTable, activityLogTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListEvidenceResponse,
  GetEvidenceResponse,
  CreateEvidenceBody,
  CreateEvidenceResponse,
  UpdateEvidenceBody,
  UpdateEvidenceResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * GET /evidence
 *
 * Returns a paginated, filterable list of evidence requests. Supported
 * query parameters:
 * - `entityCode`   — filter by entity
 * - `status`       — filter by lifecycle status
 * - `priority`     — filter by priority (`"critical"`, `"high"`, `"medium"`, `"low"`)
 * - `frameworkId`  — filter by associated framework code
 * - `limit`        — maximum rows to return (default 200)
 * - `offset`       — number of rows to skip for pagination (default 0)
 */
router.get("/evidence", async (req, res): Promise<void> => {
  const { entityCode, status, priority, frameworkId, limit, offset } = req.query as Record<string, string | undefined>;

  // Accumulate only the predicates for filters the caller actually provided
  const conditions: SQL[] = [];
  if (entityCode) conditions.push(eq(evidenceRequestsTable.entityCode, entityCode));
  if (status) conditions.push(eq(evidenceRequestsTable.status, status));
  if (priority) conditions.push(eq(evidenceRequestsTable.priority, priority));
  // The DB column is named `frameworkCode` even though the query param is `frameworkId`
  if (frameworkId) conditions.push(eq(evidenceRequestsTable.frameworkCode, frameworkId));

  const query = db.select().from(evidenceRequestsTable);
  const rows = conditions.length
    ? await query.where(and(...conditions)).limit(Number(limit) || 200).offset(Number(offset) || 0)
    : await query.limit(Number(limit) || 200).offset(Number(offset) || 0);
  res.json(ListEvidenceResponse.parse(serializeDates(rows)));
});

/**
 * POST /evidence
 *
 * Creates a new evidence request and writes an audit entry to the activity
 * log. The human-readable `code` (e.g. `EVR-2025-0042`) is generated
 * server-side from the current year and the total row count, providing a
 * sequential, year-scoped reference number that is easy to cite in reports.
 */
router.post("/evidence", async (req, res): Promise<void> => {
  const parsed = CreateEvidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { data } = parsed;

  // Server-generated UUID and sequential code — clients cannot influence these
  const id = crypto.randomUUID();
  const year = new Date().getFullYear();
  // db.$count returns total rows; adding 1 gives the next sequential number
  const count = await db.$count(evidenceRequestsTable);
  // Zero-pad to 4 digits for consistent sorting (e.g. "0001", "0042", "1000")
  const code = `EVR-${year}-${String(count + 1).padStart(4, "0")}`;
  const [row] = await db.insert(evidenceRequestsTable).values({ id, code, ...data }).returning();

  // Write an immutable audit trail entry so reviewers can see when requests were raised
  await db.insert(activityLogTable).values({
    id: crypto.randomUUID(),
    entityCode: data.entityCode,
    actor: "System",
    action: "created evidence request",
    target: `${code} · ${data.title}`,
  });

  res.status(201).json(CreateEvidenceResponse.parse(serializeDates(row)));
});

/**
 * GET /evidence/:id
 *
 * Returns a single evidence request by its UUID. Returns 404 when not found.
 */
router.get("/evidence/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(evidenceRequestsTable).where(eq(evidenceRequestsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Evidence request not found" });
    return;
  }
  res.json(GetEvidenceResponse.parse(serializeDates(rows[0])));
});

/**
 * PATCH /evidence/:id
 *
 * Partially updates an evidence request. When the incoming status is
 * `"approved"`, the `approvedAt` timestamp is automatically stamped
 * server-side — callers must not supply this field manually to prevent
 * backdating.
 */
router.patch("/evidence/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateEvidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Spread the validated update fields, then conditionally inject approvedAt
  const update: Record<string, unknown> = { ...parsed.data };
  // Business rule: approval timestamp is always set by the server to prevent
  // clients from manipulating the approval audit trail
  if (parsed.data.status === "approved") {
    update.approvedAt = new Date();
  }

  const [row] = await db
    .update(evidenceRequestsTable)
    .set(update)
    .where(eq(evidenceRequestsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Evidence request not found" });
    return;
  }
  res.json(UpdateEvidenceResponse.parse(serializeDates(row)));
});

/**
 * DELETE /evidence/:id
 *
 * Permanently removes an evidence request. No audit log entry is written
 * here; soft-deletes are not currently implemented for this resource.
 */
router.delete("/evidence/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(evidenceRequestsTable).where(eq(evidenceRequestsTable.id, id));
  res.status(204).send();
});

export default router;
