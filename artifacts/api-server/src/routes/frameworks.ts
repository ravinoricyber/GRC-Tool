import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, frameworksTable } from "@workspace/db";
import { serializeDates } from "../lib/serialize";
import {
  ListFrameworksResponse,
  GetFrameworkResponse,
  CreateFrameworkBody,
  CreateFrameworkResponse,
  UpdateFrameworkBody,
  UpdateFrameworkResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/frameworks", async (req, res): Promise<void> => {
  const rows = await db.select().from(frameworksTable).orderBy(frameworksTable.name);
  res.json(ListFrameworksResponse.parse(serializeDates(rows)));
});

router.post("/frameworks", async (req, res): Promise<void> => {
  const parsed = CreateFrameworkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { data } = parsed;
  const id = crypto.randomUUID();
  const [row] = await db.insert(frameworksTable).values({ id, ...data }).returning();
  res.status(201).json(CreateFrameworkResponse.parse(serializeDates(row)));
});

router.get("/frameworks/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rows = await db.select().from(frameworksTable).where(eq(frameworksTable.id, id));
  if (!rows[0]) {
    res.status(404).json({ error: "Framework not found" });
    return;
  }
  res.json(GetFrameworkResponse.parse(serializeDates(rows[0])));
});

router.patch("/frameworks/:id", async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const parsed = UpdateFrameworkBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(frameworksTable)
    .set(parsed.data)
    .where(eq(frameworksTable.id, id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Framework not found" });
    return;
  }
  res.json(UpdateFrameworkResponse.parse(serializeDates(row)));
});

export default router;
