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

router.get("/evidence", async (req, res): Promise<void> => {
  const { entityCode, status, priority, frameworkId, limit, offset } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  if (entityCode) conditions.push(eq(evidenceRequestsTable.entityCode, entityCode));
  if (status) conditions.push(eq(evidenceRequestsTable.status, status));
  if (priority) conditions.push(eq(evidenceRequestsTable.priority, priority));
  if (frameworkId) conditions.push(eq(evidenceRequestsTable.frameworkCode, frameworkId));

  const query = db.select().from(evidenceRequestsTable);
  const rows = conditions.length
    ? await query.where(and(...conditions)).limit(Number(limit) || 200).offset(Number(offset) || 0)
    : await query.limit(Number(limit) || 200).offset(Number(offset) || 0);
  res.json(ListEvidenceResponse.parse(serializeDates(rows)));
});

router.post("/evidence", async (req, res): Promise<void> => {
  const parsed = CreateEvidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { data } = parsed;
  const id = crypto.randomUUID();
  const year = new Date().getFullYear();
  const count = await db.$count(evidenceRequestsTable);
  const code = `EVR-${year}-${String(count + 1).padStart(4, "0")}`;
  const [row] = await db.insert(evidenceRequestsTable).values({ id, code, ...data }).returning();

  // Log activity
  await db.insert(activityLogTable).values({
    id: crypto.randomUUID(),
    entityCode: data.entityCode,
    actor: "System",
    action: "created evidence request",
    target: `${code} · ${data.title}`,
  });

  res.status(201).json(CreateEvidenceResponse.parse(serializeDates(row)));
});

router.get("/evidence/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(evidenceRequestsTable).where(eq(evidenceRequestsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Evidence request not found" });
    return;
  }
  res.json(GetEvidenceResponse.parse(serializeDates(rows[0])));
});

router.patch("/evidence/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateEvidenceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const update: Record<string, unknown> = { ...parsed.data };
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

router.delete("/evidence/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(evidenceRequestsTable).where(eq(evidenceRequestsTable.id, id));
  res.status(204).send();
});

export default router;
