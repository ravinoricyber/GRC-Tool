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

const router: IRouter = Router();

router.get("/vendors", async (req, res): Promise<void> => {
  const { entityCode, riskLevel } = req.query as Record<string, string | undefined>;
  const conditions: SQL[] = [];
  if (entityCode) conditions.push(arrayContains(vendorsTable.entities, [entityCode]));
  if (riskLevel) conditions.push(eq(vendorsTable.riskLevel, riskLevel));

  const query = db.select().from(vendorsTable).orderBy(vendorsTable.name);
  const rows = conditions.length ? await query.where(and(...conditions)) : await query;
  res.json(ListVendorsResponse.parse(serializeDates(rows)));
});

router.post("/vendors", async (req, res): Promise<void> => {
  const parsed = CreateVendorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const id = crypto.randomUUID();
  const [row] = await db.insert(vendorsTable).values({ id, ...parsed.data }).returning();
  res.status(201).json(CreateVendorResponse.parse(serializeDates(row)));
});

router.get("/vendors/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(vendorsTable).where(eq(vendorsTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Vendor not found" });
    return;
  }
  res.json(GetVendorResponse.parse(serializeDates(rows[0])));
});

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

router.delete("/vendors/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));
  res.status(204).send();
});

export default router;
