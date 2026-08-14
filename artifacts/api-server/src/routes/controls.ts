import { Router, type IRouter } from "express";
import { eq, and, SQL } from "drizzle-orm";
import { db, controlsTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListControlsResponse,
  GetControlResponse,
  UpdateControlBody,
  UpdateControlResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/controls", async (req, res): Promise<void> => {
  const { frameworkId, entityCode, status, limit, offset } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  if (frameworkId) conditions.push(eq(controlsTable.frameworkId, frameworkId));
  if (entityCode) conditions.push(eq(controlsTable.entityCode, entityCode));
  if (status) conditions.push(eq(controlsTable.finding, status));

  const query = db.select().from(controlsTable);
  const rows = conditions.length
    ? await query.where(and(...conditions)).limit(Number(limit) || 200).offset(Number(offset) || 0)
    : await query.limit(Number(limit) || 200).offset(Number(offset) || 0);
  res.json(ListControlsResponse.parse(serializeDates(rows)));
});

router.get("/controls/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(controlsTable).where(eq(controlsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Control not found" });
    return;
  }
  res.json(GetControlResponse.parse(serializeDates(rows[0])));
});

router.patch("/controls/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateControlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(controlsTable)
    .set(parsed.data)
    .where(eq(controlsTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Control not found" });
    return;
  }
  res.json(UpdateControlResponse.parse(serializeDates(row)));
});

export default router;
