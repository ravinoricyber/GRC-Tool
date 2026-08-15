/**
 * @file routes/evidence.ts
 * @description REST endpoints for the `evidence` resource. Evidence requests
 * track artefacts that an entity must provide to satisfy a compliance control
 * (e.g. a penetration-test report, a screenshot of an access matrix). Each
 * request has a lifecycle status: `requested → in-progress → submitted →
 * approved | rejected`.
 *
 * Business rules enforced here:
 * - The human-readable reference code (`EVR-YYYY-NNNN`) is generated
 *   server-side from the current year and the total row count so clients
 *   cannot influence it. The sequential number is zero-padded to four digits
 *   for consistent lexicographic sorting in reports.
 * - When a request transitions to status `"approved"`, the `approvedAt`
 *   timestamp is stamped automatically by the server. Callers must not supply
 *   this field themselves; doing so would allow backdating of approval records
 *   and would undermine the integrity of the audit trail.
 * - Every new evidence request writes an immutable entry to the activity log
 *   so reviewers can see the full chronology of raised requests.
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

/**
 * Express sub-router that owns all `/evidence` routes.
 * @type {IRouter}
 */
const router: IRouter = Router();

/**
 * GET /evidence
 *
 * Returns a paginated, filterable list of evidence request records. Filters
 * are combined with AND semantics. When no filters are provided the full table
 * is returned up to `limit`.
 *
 * Supported query parameters:
 * - `entityCode`  {string} — Restrict to evidence requests for a specific entity.
 * - `status`      {string} — Lifecycle status. One of `"requested"`,
 *   `"in-progress"`, `"submitted"`, `"approved"`, `"rejected"`.
 * - `priority`    {string} — Priority level. One of `"critical"`, `"high"`,
 *   `"medium"`, `"low"`.
 * - `frameworkId` {string} — Filter by framework code. **Note:** the query
 *   parameter is named `frameworkId` but maps to the `frameworkCode` column.
 * - `limit`       {number} — Maximum rows to return. Defaults to 200.
 * - `offset`      {number} — Rows to skip for pagination. Defaults to 0.
 *
 * @param req       - Express `Request`.
 * @param req.query - Parsed query string; all values treated as strings.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>} Resolves after sending an HTTP 200 response whose
 *   body conforms to the `ListEvidenceResponse` Zod schema:
 *   `Array<{ id, code, title, status, priority, entityCode, dueDate, ... }>`.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
 * Creates a new evidence request and writes a corresponding entry to the
 * immutable activity log so that auditors can reconstruct when each request
 * was raised.
 *
 * Auto-generated fields (clients must not supply these):
 * - `id`   — UUID generated via `crypto.randomUUID()`.
 * - `code` — Human-readable reference in the format `EVR-YYYY-NNNN` where
 *   `YYYY` is the current calendar year and `NNNN` is the next sequential
 *   row count zero-padded to four digits (e.g. `EVR-2025-0042`). The
 *   sequential number is derived from `db.$count(evidenceRequestsTable) + 1`
 *   at insert time; this is eventually consistent under concurrent inserts but
 *   is sufficient for human-readable references that need not be gapless.
 *
 * @param req      - Express `Request`.
 * @param req.body - JSON payload conforming to `CreateEvidenceBody`:
 *   `{ title, entityCode, controlId?, frameworkCode?, priority, dueDate?,
 *      requestedBy?, assignedTo?, ... }`.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 201 with a body conforming to `CreateEvidenceResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
    // The `target` string includes both the reference code and title for
    // readability in the activity feed without requiring a join
    target: `${code} · ${data.title}`,
  });

  res.status(201).json(CreateEvidenceResponse.parse(serializeDates(row)));
});

/**
 * GET /evidence/:id
 *
 * Retrieves a single evidence request by its UUID primary key.
 * Returns HTTP 404 when no matching row exists.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - The evidence request's UUID. Normalised to a plain
 *   string to guard against Express surfacing it as an array.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `GetEvidenceResponse` on success.
 *   - HTTP 404 with `{ error: "Evidence request not found" }` when not found.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
 * Partially updates an evidence request. Any subset of the mutable fields
 * may be supplied; unchanged fields retain their current database values.
 *
 * **Business rule — approval timestamp:**
 * When `status` is set to `"approved"` in the request body, the server
 * automatically injects `approvedAt = new Date()` into the update payload.
 * This prevents callers from supplying a custom `approvedAt` value, which
 * would allow backdating of approvals and would compromise the integrity of
 * the compliance audit trail. Callers must not include `approvedAt` in the
 * request body; it will be overwritten regardless.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - UUID of the evidence request to update.
 * @param req.body      - Partial payload conforming to `UpdateEvidenceBody`.
 *   Accepted fields include `status`, `assignedTo`, `dueDate`, `priority`,
 *   `title`, `notes`, etc. Do **not** include `approvedAt`.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `UpdateEvidenceResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *   - HTTP 404 with `{ error: "Evidence request not found" }` when the UUID
 *     is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
 * Permanently removes an evidence request record from the database.
 * This is a hard delete; there is no soft-delete or recycle-bin mechanism
 * for this resource. The operation is idempotent: deleting a non-existent ID
 * succeeds silently (Drizzle's `.delete()` does not error on zero-row deletes).
 *
 * No activity log entry is written on deletion. If an audit trail of
 * deletions is required in a future iteration, an activity log write should
 * be added here before the DB call.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - UUID of the evidence request to delete.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>} Resolves after sending an HTTP 204 No Content
 *   response with an empty body.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.delete("/evidence/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(evidenceRequestsTable).where(eq(evidenceRequestsTable.id, id));
  res.status(204).send();
});

export default router;
