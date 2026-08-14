import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, entitiesTable } from "@workspace/db";
import { ListEntitiesResponse, GetEntityResponse } from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/entities", async (req, res): Promise<void> => {
  const rows = await db.select().from(entitiesTable).orderBy(entitiesTable.name);
  res.json(ListEntitiesResponse.parse(serializeDates(rows)));
});

router.get("/entities/:code", async (req, res): Promise<void> => {
  const code = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
  const rows = await db.select().from(entitiesTable).where(eq(entitiesTable.code, code));
  if (!rows[0]) {
    res.status(404).json({ error: "Entity not found" });
    return;
  }
  res.json(GetEntityResponse.parse(serializeDates(rows[0])));
});

export default router;
