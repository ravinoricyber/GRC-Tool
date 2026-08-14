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

router.get("/policies", async (req, res): Promise<void> => {
  const { entityCode, frameworkId, status } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  if (entityCode) conditions.push(arrayContains(policiesTable.entities, [entityCode]));
  if (frameworkId) conditions.push(arrayContains(policiesTable.frameworks, [frameworkId]));
  if (status) conditions.push(eq(policiesTable.status, status));

  const query = db.select().from(policiesTable);
  const rows = conditions.length
    ? await query.where(and(...conditions))
    : await query;
  res.json(ListPoliciesResponse.parse(serializeDates(rows)));
});

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

router.get("/policies/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(policiesTable).where(eq(policiesTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Policy not found" });
    return;
  }
  res.json(GetPolicyResponse.parse(serializeDates(rows[0])));
});

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

router.delete("/policies/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(policiesTable).where(eq(policiesTable.id, id));
  res.status(204).send();
});

export default router;
