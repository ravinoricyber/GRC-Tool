/**
 * @file routes/policies.ts
 * @description REST endpoints for the `policies` resource. Policies are
 * internal documents (e.g. an Acceptable Use Policy, an Incident Response
 * Plan) that map to one or more compliance frameworks and apply to one or
 * more entities. The `entities` and `frameworks` columns are PostgreSQL
 * arrays, so filtering uses `arrayContains` rather than a simple equality
 * check.
 *
 * Routes:
 *   GET    /policies      — list policies with optional filtering
 *   POST   /policies      — create a new policy
 *   GET    /policies/:id  — retrieve a single policy by UUID
 *   PATCH  /policies/:id  — partially update a policy
 *   DELETE /policies/:id  — permanently delete a policy
 */

import { Router, type IRouter } from "express";
import { eq, and, SQL, arrayContains } from "drizzle-orm";
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

const router: IRouter = Router();

/**
 * GET /policies
 *
 * Returns all policies, optionally filtered by:
 * - `entityCode`  — policies whose `entities` array contains the given code
 * - `frameworkId` — policies whose `frameworks` array contains the given ID
 * - `status`      — lifecycle status (e.g. `"current"`, `"draft"`, `"retired"`)
 *
 * Note: `arrayContains` is used instead of `eq` because the `entities` and
 * `frameworks` columns are PostgreSQL array types — equality would only match
 * rows where the array contains *exactly* that one value.
 */
router.get("/policies", async (req, res): Promise<void> => {
  const { entityCode, frameworkId, status } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  // arrayContains checks that the column value contains [entityCode] as a subset
  if (entityCode) conditions.push(arrayContains(policiesTable.entities, [entityCode]));
  if (frameworkId) conditions.push(arrayContains(policiesTable.frameworks, [frameworkId]));
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
 * Creates a new policy with a server-generated UUID. The request body is
 * validated against `CreatePolicyBody` before the insert.
 */
router.post("/policies", async (req, res): Promise<void> => {
  const parsed = CreatePolicyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const id = crypto.randomUUID();
  const [row] = await db.insert(policiesTable).values({ id, ...parsed.data }).returning();
  res.status(201).json(CreatePolicyResponse.parse(serializeDates(row)));
});

/**
 * GET /policies/:id
 *
 * Returns a single policy by its UUID. Returns 404 when not found.
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
 * Partially updates a policy. Common use-cases include changing the status
 * (e.g. from `"draft"` to `"current"`) or updating the review date.
 * Returns 404 when the target row does not exist.
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
 * Permanently removes a policy record. Callers should ensure the policy is
 * not actively referenced by any framework mapping before deletion.
 */
router.delete("/policies/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(policiesTable).where(eq(policiesTable.id, id));
  res.status(204).send();
});

export default router;
