/**
 * @file routes/policies.ts
 * @description REST endpoints for the `policies` resource. Policies are
 * internal documents (e.g. an Acceptable Use Policy, an Incident Response
 * Plan) that map to one or more compliance frameworks and apply to one or
 * more entities. The `entities` and `frameworks` columns are PostgreSQL
 * arrays, so filtering uses `arrayContains` rather than a simple equality
 * check.
 *
 * Business rules enforced here:
 * - Filtering on `entityCode` or `frameworkId` uses `arrayContains` because
 *   a single policy can apply to multiple entities and frameworks. An equality
 *   check would only match rows where the column contains *exactly* that one
 *   value, silently excluding policies that map to several entities/frameworks.
 * - Policy IDs are server-generated UUIDs; clients cannot pre-determine or
 *   spoof primary keys.
 * - Hard deletes are supported but callers should first verify the policy is
 *   not actively referenced by framework mappings or control evidence.
 *
 * Routes:
 *   GET    /policies      — list policies with optional filtering
 *   POST   /policies      — create a new policy
 *   GET    /policies/:id  — retrieve a single policy by UUID
 *   PATCH  /policies/:id  — partially update a policy
 *   DELETE /policies/:id  — permanently delete a policy
 */

import { Router, type IRouter } from "express";
import { eq, and, SQL, arrayContains, inArray } from "drizzle-orm";
import { db, policiesTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListPoliciesResponse,
  GetPolicyResponse,
  CreatePolicyBody,
  CreatePolicyResponse,
  UpdatePolicyBody,
  UpdatePolicyResponse,
} from "@workspace/api-zod";

// ---------------------------------------------------------------------------
// Bulk-operation validation helpers (no external dependency)
// ---------------------------------------------------------------------------

/** UUID v4 regex used to validate IDs in the bulk-delete payload. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Shape expected for each item in the bulk-import request body.
 * Required: code, name, owner, version. All others are optional.
 */
interface BulkImportItem {
  code:          string;
  name:          string;
  owner:         string;
  version:       string;
  status?:       string;
  effectiveDate?: string | null;
  reviewDate?:   string | null;
  pages?:        number | null;
  frameworks?:   string[];
  entities?:     string[];
  description?:  string | null;
}

/**
 * Validates a single item from the bulk-import body.
 * Returns an error message string on failure, or `null` when the item is valid.
 *
 * @param item  - Untrusted object from the request body.
 * @param index - Zero-based position in the input array (for error messages).
 * @returns     `null` when valid, or a descriptive error string.
 */
function validateImportItem(item: unknown, index: number): string | null {
  if (!item || typeof item !== "object") return `Item at index ${index} is not an object`;
  const rec = item as Record<string, unknown>;
  for (const field of ["code", "name", "owner", "version"] as const) {
    if (typeof rec[field] !== "string" || !(rec[field] as string).trim()) {
      return `Item at index ${index} is missing required string field "${field}"`;
    }
  }
  if (rec.frameworks !== undefined && !Array.isArray(rec.frameworks)) {
    return `Item at index ${index}: "frameworks" must be an array of strings`;
  }
  if (rec.entities !== undefined && !Array.isArray(rec.entities)) {
    return `Item at index ${index}: "entities" must be an array of strings`;
  }
  return null;
}

/**
 * Express sub-router that owns all `/policies` routes.
 * @type {IRouter}
 */
const router: IRouter = Router();

/**
 * GET /policies
 *
 * Returns all policy records, optionally filtered by entity, framework, or
 * status. Multiple filters are combined with AND semantics.
 *
 * Supported query parameters:
 * - `entityCode`  {string} — Returns policies whose `entities` array contains
 *   the given code. Uses `arrayContains` rather than `eq` because `entities`
 *   is a PostgreSQL array column and a policy may apply to multiple entities.
 * - `frameworkId` {string} — Returns policies whose `frameworks` array
 *   contains the given framework ID. Same array-contains logic as `entityCode`.
 * - `status`      {string} — Lifecycle status. One of `"draft"`, `"current"`,
 *   `"retired"`. Uses an exact equality match on the scalar `status` column.
 *
 * No pagination is applied; callers receive all matching rows. If the policy
 * table grows to a size where this causes performance issues, `limit`/`offset`
 * parameters should be added here.
 *
 * @param req       - Express `Request`.
 * @param req.query - Parsed query string; all values treated as strings.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>} Resolves after sending an HTTP 200 response whose
 *   body conforms to the `ListPoliciesResponse` Zod schema:
 *   `Array<{ id, title, status, entities, frameworks, reviewDate, ... }>`.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.get("/policies", async (req, res): Promise<void> => {
  const { entityCode, frameworkId, status } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  // arrayContains checks that the column value contains [entityCode] as a subset
  if (entityCode) conditions.push(arrayContains(policiesTable.entities, [entityCode]));
  // arrayContains similarly checks the frameworks array for the given ID
  if (frameworkId) conditions.push(arrayContains(policiesTable.frameworks, [frameworkId]));
  // `status` is a scalar column so a simple equality check is appropriate here
  if (status) conditions.push(eq(policiesTable.status, status));

  const query = db.select().from(policiesTable);
  const rows = conditions.length
    ? await query.where(and(...conditions))
    : await query;
  res.json(ListPoliciesResponse.parse(serializeDates(rows)));
});

/**
 * POST /policies
 *
 * Creates a new policy document record with a server-generated UUID.
 * The request body is validated against `CreatePolicyBody` before the insert,
 * so invalid payloads are rejected cheaply without touching the database.
 *
 * @param req      - Express `Request`.
 * @param req.body - JSON payload conforming to `CreatePolicyBody`:
 *   `{ title, status, entities: string[], frameworks: string[],
 *      owner?, reviewDate?, url?, ... }`.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 201 with a body conforming to `CreatePolicyResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.post("/policies", async (req, res): Promise<void> => {
  const parsed = CreatePolicyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Server-generated UUID ensures clients cannot pre-determine or spoof IDs
  const id = crypto.randomUUID();
  const [row] = await db.insert(policiesTable).values({ id, ...parsed.data }).returning();
  res.status(201).json(CreatePolicyResponse.parse(serializeDates(row)));
});

/**
 * GET /policies/:id
 *
 * Retrieves a single policy document by its UUID primary key.
 * Returns HTTP 404 when no matching row exists.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - The policy's UUID. Normalised to a plain string to
 *   guard against Express surfacing it as an array.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `GetPolicyResponse` on success.
 *   - HTTP 404 with `{ error: "Policy not found" }` when the UUID is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.get("/policies/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(policiesTable).where(eq(policiesTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Policy not found" });
    return;
  }
  res.json(GetPolicyResponse.parse(serializeDates(rows[0])));
});

/**
 * PATCH /policies/:id
 *
 * Applies a partial update to an existing policy record. Only the fields
 * present in the request body are written to the database; all other columns
 * retain their current values.
 *
 * Common use-cases:
 * - Promoting a policy from `"draft"` → `"current"` by updating `status`.
 * - Scheduling the next review by updating `reviewDate`.
 * - Associating the policy with a new entity by adding to the `entities` array.
 *
 * The body is validated against `UpdatePolicyBody` before the update query.
 * If Drizzle's `.returning()` yields an empty array, the target row does not
 * exist and HTTP 404 is returned.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - UUID of the policy to update.
 * @param req.body      - Partial payload conforming to `UpdatePolicyBody`.
 *   Any subset of the policy's mutable fields is accepted.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `UpdatePolicyResponse` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *   - HTTP 404 with `{ error: "Policy not found" }` when the UUID is unknown.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.patch("/policies/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdatePolicyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.update(policiesTable).set(parsed.data).where(eq(policiesTable.id, id)).returning();
  if (!row) {
    res.status(404).json({ error: "Policy not found" });
    return;
  }
  res.json(UpdatePolicyResponse.parse(serializeDates(row)));
});

/**
 * DELETE /policies/:id
 *
 * Permanently removes a policy document record. This is a hard delete with
 * no soft-delete or archival mechanism. The operation is idempotent: deleting
 * a non-existent ID succeeds silently.
 *
 * Callers should verify the policy is not actively referenced by any framework
 * mapping, control evidence, or assessment before issuing a delete to avoid
 * orphaned references in those related resources.
 *
 * @param req           - Express `Request`.
 * @param req.params.id - UUID of the policy to delete.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>} Resolves after sending HTTP 204 No Content.
 *
 * @throws Propagates unhandled database errors (e.g. foreign key constraint
 *   violations if referential integrity is enforced at the DB level) as
 *   uncaught rejections.
 */
router.delete("/policies/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(policiesTable).where(eq(policiesTable.id, id));
  res.status(204).send();
});

/**
 * POST /policies/bulk-import
 *
 * Inserts multiple policy records in a single database round-trip. The server
 * assigns a UUID to each row; callers must not supply `id` values.
 *
 * Request body: `{ policies: BulkImportPolicyItem[] }` — array of 1–N policy
 * objects, each requiring `code`, `name`, `owner`, and `version`.
 *
 * Behaviour on validation failure:
 * - Zod validation runs before any database writes. If the body is invalid the
 *   entire request is rejected with HTTP 400 and no rows are inserted.
 * - Duplicate `code` values in the payload or conflicts with existing rows will
 *   surface as a database constraint error (HTTP 500). The caller should dedupe
 *   codes before submitting.
 *
 * @param req      - Express `Request`.
 * @param req.body - JSON payload conforming to `BulkImportBody`:
 *   `{ policies: Array<{ code, name, owner, version, status?, frameworks?,
 *      entities?, effectiveDate?, reviewDate?, pages?, description? }> }`.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 201 with `{ inserted: number, ids: string[] }` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails.
 *
 * @throws Propagates unhandled database errors (e.g. unique-constraint
 *   violation on `code`) as uncaught rejections.
 */
router.post("/policies/bulk-import", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;

  // Top-level shape check: must have a non-empty `policies` array.
  if (!Array.isArray(body?.policies) || body.policies.length === 0) {
    res.status(400).json({ error: '"policies" must be a non-empty array' });
    return;
  }

  // Validate each item. Fail fast on the first invalid record.
  for (let i = 0; i < body.policies.length; i++) {
    const err = validateImportItem(body.policies[i], i);
    if (err) { res.status(400).json({ error: err }); return; }
  }

  const items = body.policies as BulkImportItem[];

  // Attach a server-generated UUID to every incoming item before insertion.
  const rows = items.map(p => ({
    id:            crypto.randomUUID(),
    code:          p.code,
    name:          p.name,
    owner:         p.owner,
    version:       p.version,
    status:        p.status ?? "current",
    effectiveDate: p.effectiveDate ?? null,
    reviewDate:    p.reviewDate ?? null,
    pages:         p.pages ?? null,
    frameworks:    Array.isArray(p.frameworks) ? p.frameworks : [],
    entities:      Array.isArray(p.entities)   ? p.entities   : [],
    description:   p.description ?? null,
  }));

  const inserted = await db.insert(policiesTable).values(rows).returning({ id: policiesTable.id });
  res.status(201).json({ inserted: inserted.length, ids: inserted.map(r => r.id) });
});

/**
 * DELETE /policies/bulk
 *
 * Permanently removes multiple policy records in a single database round-trip.
 * The operation is idempotent: IDs that do not match any row are silently
 * ignored; the response reflects only rows that were actually deleted.
 *
 * Callers should verify that none of the targeted policies are actively
 * referenced by framework mappings, control evidence, or assessments before
 * issuing this request to avoid orphaned references in related resources.
 *
 * Request body: `{ ids: string[] }` — array of 1–N UUID strings.
 *
 * @param req      - Express `Request`.
 * @param req.body - JSON payload conforming to `BulkDeleteBody`:
 *   `{ ids: string[] }` — each value must be a valid UUID.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with `{ deleted: number }` on success.
 *   - HTTP 400 with `{ error: string }` when Zod validation fails (e.g. empty
 *     array, or a non-UUID string in the array).
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.delete("/policies/bulk", async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;

  // Must supply a non-empty array of UUID strings.
  if (!Array.isArray(body?.ids) || body.ids.length === 0) {
    res.status(400).json({ error: '"ids" must be a non-empty array of UUID strings' });
    return;
  }

  // Validate each entry is a UUID-shaped string.
  for (const id of body.ids as unknown[]) {
    if (typeof id !== "string" || !UUID_RE.test(id)) {
      res.status(400).json({ error: `Invalid UUID: ${String(id)}` });
      return;
    }
  }

  const deleted = await db
    .delete(policiesTable)
    .where(inArray(policiesTable.id, body.ids as string[]))
    .returning({ id: policiesTable.id });

  res.json({ deleted: deleted.length });
});

export default router;
