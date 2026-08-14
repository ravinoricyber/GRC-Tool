import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, activityLogTable } from "@workspace/db";
import { ListActivityResponse } from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

router.get("/activity", async (req, res): Promise<void> => {
  const { entityCode, limit, offset } = req.query as Record<string, string | undefined>;

  const query = db.select().from(activityLogTable).orderBy(desc(activityLogTable.createdAt));
  const rows = entityCode
    ? await query.where(eq(activityLogTable.entityCode, entityCode)).limit(Number(limit) || 100).offset(Number(offset) || 0)
    : await query.limit(Number(limit) || 100).offset(Number(offset) || 0);
  res.json(ListActivityResponse.parse(serializeDates(rows)));
});

export default router;
