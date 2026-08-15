/**
 * @file routes/activity.ts
 * @description REST endpoint for the activity log. The activity log provides
 * an immutable, chronological audit trail of significant actions performed
 * within the system (e.g. evidence requests being created or status changes).
 * Entries are written by other route handlers rather than being created
 * directly through this endpoint (read-only from the client's perspective).
 *
 * Routes:
 *   GET /activity — retrieve recent activity log entries
 */

import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, activityLogTable } from "@workspace/db";
import { ListActivityResponse } from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

const router: IRouter = Router();

/**
 * GET /activity
 *
 * Returns audit log entries ordered by `createdAt` descending (most recent
 * first) so dashboards and feeds show the latest activity without sorting
 * client-side. Supports the following query parameters:
 * - `entityCode` — restrict entries to a specific business unit
 * - `limit`      — maximum rows to return (default 100)
 * - `offset`     — number of rows to skip for pagination (default 0)
 *
 * When `entityCode` is omitted, activity across all entities is returned.
 */
router.get("/activity", async (req, res): Promise<void> => {
  const { entityCode, limit, offset } = req.query as Record<string, string | undefined>;

  // Always sort newest-first so consumers get the most relevant entries at the top
  const query = db.select().from(activityLogTable).orderBy(desc(activityLogTable.createdAt));

  // Only apply the entityCode filter when the caller explicitly requests it;
  // the dashboard global feed intentionally shows cross-entity activity
  const rows = entityCode
    ? await query.where(eq(activityLogTable.entityCode, entityCode)).limit(Number(limit) || 100).offset(Number(offset) || 0)
    : await query.limit(Number(limit) || 100).offset(Number(offset) || 0);
  res.json(ListActivityResponse.parse(serializeDates(rows)));
});

export default router;
