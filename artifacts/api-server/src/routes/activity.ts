/**
 * @file routes/activity.ts
 * @description REST endpoint for the activity log. The activity log provides
 * an immutable, chronological audit trail of significant actions performed
 * within the system (e.g. evidence requests being created or status changes).
 * Entries are written by other route handlers rather than being created
 * directly through this endpoint (read-only from the client's perspective).
 *
 * Design decisions:
 * - Entries are always ordered newest-first (`createdAt DESC`) so that the
 *   most recent activity appears at the top of dashboard feeds without
 *   requiring client-side sorting.
 * - When `entityCode` is omitted the response includes activity across all
 *   entities. This powers the global compliance dashboard feed where
 *   cross-entity visibility is intentional and desirable for compliance officers.
 * - Pagination is available via `limit` and `offset` but defaults to 100 rows
 *   to keep the dashboard feed snappy while still covering enough history.
 *
 * Routes:
 *   GET /activity — retrieve recent activity log entries
 */

import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, activityLogTable } from "@workspace/db";
import { ListActivityResponse } from "@workspace/api-zod";
import { serializeDates } from "../lib/serialize";

/**
 * Express sub-router that owns the `/activity` route.
 * @type {IRouter}
 */
const router: IRouter = Router();

/**
 * GET /activity
 *
 * Returns audit log entries ordered by `createdAt` descending (most recent
 * first) so dashboards and activity feeds display the latest events at the top
 * without client-side sorting. Supports optional entity-scoping and pagination.
 *
 * Supported query parameters:
 * - `entityCode` {string} — When provided, restricts entries to the given
 *   entity. When omitted, entries across **all** entities are returned. The
 *   global feed is intentional — compliance officers need cross-entity
 *   visibility on the main dashboard.
 * - `limit`      {number} — Maximum number of entries to return. Defaults to
 *   100. Lower values are recommended for real-time feeds; higher values for
 *   export/audit use-cases.
 * - `offset`     {number} — Number of entries to skip (0-based). Used with
 *   `limit` for cursor-free pagination through the audit history. Defaults to 0.
 *
 * @param req       - Express `Request`.
 * @param req.query - Parsed query string. Recognised keys: `entityCode`,
 *   `limit`, `offset`.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>} Resolves after sending an HTTP 200 response whose
 *   body conforms to the `ListActivityResponse` Zod schema:
 *   `Array<{ id, entityCode, actor, action, target, createdAt }>`.
 *   The array is ordered newest-first.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
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
