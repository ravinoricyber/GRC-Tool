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

router.get("/aocs", async (req, res): Promise<void> => {
  const { entityCode, frameworkId } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  if (entityCode) conditions.push(eq(aocsTable.entityCode, entityCode));
  if (frameworkId) conditions.push(eq(aocsTable.frameworkCode, frameworkId));

  const query = db.select().from(aocsTable).orderBy(aocsTable.createdAt);
  const rows = conditions.length ? await query.where(and(...conditions)) : await query;
  res.json(ListAocsResponse.parse(serializeDates(rows)));
});

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

router.get("/aocs/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(aocsTable).where(eq(aocsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "AOC not found" });
    return;
  }
  res.json(GetAocResponse.parse(serializeDates(rows[0])));
});

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
