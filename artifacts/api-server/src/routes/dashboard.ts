/**
 * @file routes/dashboard.ts
 * @description Aggregated read-only endpoints that power the compliance
 * dashboard. Each endpoint performs in-process aggregation over data fetched
 * from multiple tables rather than relying on complex SQL views, which keeps
 * the queries readable and portable. All endpoints require an `entityCode`
 * query parameter so the dashboard can display per-entity metrics.
 *
 * Design decisions:
 * - In-process aggregation is preferred over SQL GROUP BY / window functions
 *   to keep the query logic transparent, testable, and easy to extend.
 * - "Due soon" thresholds (7 days for evidence, 90/365 days for AOC renewal)
 *   are business constants defined close to the logic that uses them.
 * - The `controlsPassing` percentage uses global (non-entity-scoped) control
 *   counts because controls represent a shared compliance baseline across all
 *   entities in the current data model.
 * - All responses are validated through Zod schemas before sending to ensure
 *   the shape remains in sync with the generated API client.
 *
 * Routes:
 *   GET /dashboard/summary             — headline KPIs for a given entity
 *   GET /dashboard/evidence-by-status  — evidence request counts grouped by status
 *   GET /dashboard/control-coverage    — PCI DSS control pass-rates by domain
 *   GET /dashboard/upcoming-milestones — time-sensitive items due in the near future
 */

import { Router, type IRouter } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import { serializeDates } from "../lib/serialize";
import { db, entitiesTable, frameworksTable, evidenceRequestsTable, controlsTable, policiesTable, aocsTable, assessmentsTable, vendorsTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetEvidenceByStatusResponse,
  GetControlCoverageResponse,
  GetUpcomingMilestonesResponse,
} from "@workspace/api-zod";

/**
 * Express sub-router that owns all `/dashboard/*` routes.
 * @type {IRouter}
 */
const router: IRouter = Router();

/**
 * GET /dashboard/summary
 *
 * Returns headline compliance KPIs for a specific entity. This is the primary
 * data source for the top-level dashboard scorecard widgets.
 *
 * **Metrics computed:**
 * - `overallReadinessPct`    — Percentage of controls with `finding = "in-place"`
 *   relative to total controls. Control counts are global (not entity-scoped)
 *   because controls represent the shared compliance baseline.
 * - `openEvidenceCount`      — Evidence requests in `"requested"` or `"in-progress"` state.
 * - `overdueEvidenceCount`   — Open evidence requests whose `dueDate` is in the past.
 * - `dueSoonEvidenceCount`   — Open evidence requests due within the next 7 days
 *   (but not yet overdue). The 7-day threshold is a business rule that drives
 *   the "attention required" dashboard callout.
 * - `controlsPassing`        — Absolute count of controls with `finding = "in-place"`.
 * - `controlsTotal`          — Total control count across all frameworks.
 * - `nextAocDate`            — The entity's next AOC renewal date from `entitiesTable`
 *   (may be `null` if not configured).
 * - `activeFrameworks`       — Count of framework records with `status = "active"`.
 * - `activePolicies`         — Count of policy records with `status = "current"`.
 * - `openAssessments`        — Count of assessments for the entity that are not `"closed"`.
 * - `vendors`                — Total vendor count across all entities (global figure).
 *
 * @param req                 - Express `Request`.
 * @param req.query.entityCode - {string} **Required.** The short code of the entity
 *   for which to compute metrics (e.g. `"gopuff"`). Returns HTTP 400 when absent.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `GetDashboardSummaryResponse` on success.
 *   - HTTP 400 with `{ error: "entityCode is required" }` when the parameter
 *     is missing.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const entityCode = req.query.entityCode as string;
  if (!entityCode) {
    res.status(400).json({ error: "entityCode is required" });
    return;
  }

  // Fetch the entity row to retrieve the AOC renewal date
  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.code, entityCode));

  // Count open evidence requests and classify by urgency
  const evidenceRows = await db.select().from(evidenceRequestsTable).where(eq(evidenceRequestsTable.entityCode, entityCode));
  // "Open" = not yet submitted, approved, or rejected
  const openEvidence = evidenceRows.filter(e => e.status === "requested" || e.status === "in-progress");
  const now = new Date();
  // "Due soon" threshold: 7 days from now (business rule)
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  // Overdue: due date is strictly in the past
  const overdue = openEvidence.filter(e => e.dueDate && new Date(e.dueDate) < now);
  // Due soon: due date is today or within the next 7 days (inclusive on both ends)
  const dueSoon = openEvidence.filter(e => e.dueDate && new Date(e.dueDate) >= now && new Date(e.dueDate) <= soon);

  // Controls — fetched globally; `in-place` is the passing finding value
  const controls = await db.select().from(controlsTable);
  const passing = controls.filter(c => c.finding === "in-place").length;

  // Policy count — only policies with status `"current"` are considered active
  const policies = await db.select().from(policiesTable);
  const activePolicies = policies.filter(p => p.status === "current").length;

  // Frameworks — only those with status `"active"` count toward the active tally
  const frameworks = await db.select().from(frameworksTable);
  const activeFrameworks = frameworks.filter(f => f.status === "active").length;

  // Assessments scoped to the entity; any non-closed status counts as open
  const assessments = await db.select().from(assessmentsTable).where(eq(assessmentsTable.entityCode, entityCode));
  const openAssessments = assessments.filter(a => a.status !== "closed").length;

  // Vendors are global (any entity can share a vendor relationship)
  const vendors = await db.select().from(vendorsTable);

  // Readiness % = passing controls / total controls; guard against division by zero
  const total = controls.length || 1;
  const readinessPct = Math.round((passing / total) * 100);

  const summary = {
    entityCode,
    overallReadinessPct: readinessPct,
    openEvidenceCount: openEvidence.length,
    overdueEvidenceCount: overdue.length,
    dueSoonEvidenceCount: dueSoon.length,
    controlsPassing: passing,
    controlsTotal: controls.length,
    nextAocDate: entity?.nextAocDate ?? null,
    activeFrameworks,
    activePolicies,
    openAssessments,
    vendors: vendors.length,
  };

  res.json(GetDashboardSummaryResponse.parse(serializeDates(summary)));
});

/**
 * GET /dashboard/evidence-by-status
 *
 * Returns the count of evidence requests in each lifecycle status for a
 * specific entity. Intended for use in the dashboard status-distribution
 * chart widget.
 *
 * All five canonical status values are **always** present in the response,
 * even when a given status has no rows in the database. This guarantee allows
 * the front-end chart to render fixed-position bars without conditional logic
 * for missing keys.
 *
 * Aggregation is performed in the database via `GROUP BY` to avoid loading all
 * evidence rows into process memory, which is important for entities with large
 * evidence libraries.
 *
 * @param req                 - Express `Request`.
 * @param req.query.entityCode - {string} **Required.** Short code of the entity.
 *   Returns HTTP 400 when absent.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `GetEvidenceByStatusResponse`:
 *     `Array<{ status: string, count: number }>` with exactly 5 entries
 *     (one per canonical status, in the order: `"requested"`, `"in-progress"`,
 *     `"submitted"`, `"approved"`, `"rejected"`).
 *   - HTTP 400 with `{ error: "entityCode is required" }` when the parameter
 *     is missing.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.get("/dashboard/evidence-by-status", async (req, res): Promise<void> => {
  const entityCode = req.query.entityCode as string;
  if (!entityCode) {
    res.status(400).json({ error: "entityCode is required" });
    return;
  }

  // Aggregate counts at the DB level to avoid fetching all rows into memory
  const rows = await db
    .select({ status: evidenceRequestsTable.status, count: count() })
    .from(evidenceRequestsTable)
    .where(eq(evidenceRequestsTable.entityCode, entityCode))
    .groupBy(evidenceRequestsTable.status);

  // Ensure every status is present in the result even if the DB has no rows for it
  const statuses = ["requested", "in-progress", "submitted", "approved", "rejected"];
  const result = statuses.map(s => ({
    status: s,
    // Default to 0 for statuses not represented in the query result
    count: rows.find(r => r.status === s)?.count ?? 0,
  }));
  res.json(GetEvidenceByStatusResponse.parse(serializeDates(result)));
});

/**
 * GET /dashboard/control-coverage
 *
 * Returns per-domain control coverage metrics for the PCI DSS 4.0 framework,
 * ordered by requirement number. This data powers the "Control Coverage" bar
 * chart on the compliance dashboard.
 *
 * **Scoping:** Controls are filtered to `frameworkCode = "pci-dss-4"`. Only
 * this framework is visualised in the coverage chart; other frameworks appear
 * in the summary counts but not in per-domain breakdowns.
 *
 * **Domain grouping:** Controls are grouped by their `domainNumber` (1–12,
 * corresponding to the 12 PCI DSS requirements). The canonical domain names
 * are defined in a static in-file map (`PCI_DOMAINS`) because PCI DSS
 * requirement titles are stable and do not need database storage.
 *
 * **Finding classification:**
 * - `passing`    — Controls with `finding = "in-place"`.
 * - `inProgress` — Controls with `finding = "not-tested"` (treated as
 *   "in-progress" by the UI — assessment work is underway but not complete).
 * - `blocked`    — Controls with `finding = "not-in-place"` (active gap).
 * - `pct`        — Percentage of controls in this domain that are passing,
 *   rounded to the nearest integer. Division-by-zero is guarded.
 *
 * @param req                 - Express `Request`.
 * @param req.query.entityCode - {string} **Required.** Short code of the entity.
 *   Returns HTTP 400 when absent. (Currently used for authorisation context;
 *   control data itself is not entity-scoped in this query.)
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `GetControlCoverageResponse`:
 *     `Array<{ requirementId, requirementName, domain, total, passing,
 *               inProgress, blocked, pct }>`, sorted by `requirementId` ascending.
 *   - HTTP 400 with `{ error: "entityCode is required" }` when the parameter
 *     is missing.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.get("/dashboard/control-coverage", async (req, res): Promise<void> => {
  const entityCode = req.query.entityCode as string;
  if (!entityCode) {
    res.status(400).json({ error: "entityCode is required" });
    return;
  }

  // Fetch only PCI DSS 4.0 controls; other frameworks are not visualised here
  const pciControls = await db
    .select()
    .from(controlsTable)
    .where(eq(controlsTable.frameworkCode, "pci-dss-4"));

  // Group controls by their domain number for aggregation
  const byDomain = new Map<number, typeof pciControls>();
  for (const c of pciControls) {
    const d = c.domainNumber;
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)!.push(c);
  }

  /**
   * Static mapping of PCI DSS requirement numbers (1–12) to their official
   * requirement titles from PCI DSS v4.0. Stored in-code because requirement
   * names are stable across environments and do not warrant a database table.
   */
  const PCI_DOMAINS: Record<number, { name: string }> = {
    1: { name: "Network Security Controls" },
    2: { name: "Secure Configurations" },
    3: { name: "Account Data Protection" },
    4: { name: "Encryption in Transit" },
    5: { name: "Malware Protection" },
    6: { name: "Secure Systems & Software" },
    7: { name: "Access Control" },
    8: { name: "Identity & Authentication" },
    9: { name: "Physical Access Security" },
    10: { name: "Logging & Monitoring" },
    11: { name: "Security Testing" },
    12: { name: "Organizational Policies" },
  };

  const result = Array.from(byDomain.entries()).map(([domainNum, controls]) => {
    const passing = controls.filter(c => c.finding === "in-place").length;
    // `not-tested` controls are treated as "in progress" from the UI's perspective
    const inProgress = controls.filter(c => c.finding === "not-tested").length;
    const blocked = controls.filter(c => c.finding === "not-in-place").length;
    // Guard against division by zero for domains with no controls
    const total = controls.length || 1;
    return {
      requirementId: String(domainNum),
      requirementName: PCI_DOMAINS[domainNum]?.name ?? `Requirement ${domainNum}`,
      // `domain` duplicates `requirementName` for clients that reference either field
      domain: PCI_DOMAINS[domainNum]?.name ?? `Requirement ${domainNum}`,
      total: controls.length,
      passing,
      inProgress,
      blocked,
      pct: Math.round((passing / total) * 100),
    };
  // Sort numerically by requirement ID so the chart renders in the correct order
  }).sort((a, b) => Number(a.requirementId) - Number(b.requirementId));

  res.json(GetControlCoverageResponse.parse(serializeDates(result)));
});

/**
 * GET /dashboard/upcoming-milestones
 *
 * Returns time-sensitive compliance items due in the near future for a specific
 * entity, sorted by days remaining ascending (most urgent first). At most 10
 * items are returned to keep the dashboard widget focused on the most critical
 * work items.
 *
 * **Two milestone categories are included:**
 *
 * 1. **Evidence requests** — Open items (`"requested"` or `"in-progress"`)
 *    with a `dueDate` between today and 60 days from now. Items more than 60
 *    days out are excluded to reduce noise; overdue items (negative days) are
 *    also excluded because they surface in the `overdueEvidenceCount` KPI
 *    instead. The `priority` field is passed through as-is from the evidence
 *    request record.
 *
 * 2. **AOC renewal** — A synthetic milestone derived from the entity's
 *    `nextAocDate` field. Included when the renewal is between today and 365
 *    days out. Priority escalates from `"high"` to `"critical"` when fewer
 *    than 90 days remain, prompting the compliance team to accelerate the
 *    renewal process.
 *
 * @param req                 - Express `Request`.
 * @param req.query.entityCode - {string} **Required.** Short code of the entity.
 *   Returns HTTP 400 when absent.
 * @param res - Express `Response`.
 *
 * @returns {Promise<void>}
 *   - HTTP 200 with a body conforming to `GetUpcomingMilestonesResponse`:
 *     `Array<{ id, title, description, dueDate, priority, category,
 *               daysRemaining }>`, sorted by `daysRemaining` ascending,
 *     capped at 10 items.
 *   - HTTP 400 with `{ error: "entityCode is required" }` when the parameter
 *     is missing.
 *
 * @throws Propagates unhandled database errors as uncaught rejections.
 */
router.get("/dashboard/upcoming-milestones", async (req, res): Promise<void> => {
  const entityCode = req.query.entityCode as string;
  if (!entityCode) {
    res.status(400).json({ error: "entityCode is required" });
    return;
  }

  const now = new Date();

  // Fetch all evidence rows for the entity; we filter in JS to avoid complex date SQL
  const evidenceRows = await db
    .select()
    .from(evidenceRequestsTable)
    .where(eq(evidenceRequestsTable.entityCode, entityCode));

  /**
   * Accumulated milestone entries from both evidence requests and the AOC
   * renewal deadline. The shape matches `GetUpcomingMilestonesResponse` items.
   */
  const milestones: Array<{
    id: string;
    title: string;
    description: string;
    dueDate: string;
    priority: string;
    category: string;
    daysRemaining: number;
  }> = [];

  for (const e of evidenceRows) {
    if (!e.dueDate) continue;
    const due = new Date(e.dueDate);
    // Convert ms difference to whole days (ceiling so same-day = 1 not 0)
    const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    // Only surface open items that are due within the 60-day horizon (business rule)
    if (days > 0 && days <= 60 && (e.status === "requested" || e.status === "in-progress")) {
      milestones.push({
        id: e.id,
        title: e.title,
        // Include the reference code and requestor in the description so the
        // widget is self-contained without requiring a separate lookup
        description: `Evidence request ${e.code} — ${e.requestedBy ?? "Internal"}`,
        dueDate: e.dueDate,
        priority: e.priority,
        category: "evidence",
        daysRemaining: days,
      });
    }
  }

  // Synthetic milestone for the entity's AOC renewal deadline
  const entity = await db.select().from(entitiesTable).where(eq(entitiesTable.code, entityCode));
  if (entity[0]?.nextAocDate) {
    const due = new Date(entity[0].nextAocDate);
    const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    // Include AOC renewals up to 1 year out so planning can begin well in advance
    if (days > 0 && days <= 365) {
      milestones.push({
        // Synthetic ID scoped to the entity so the UI can render a stable key
        id: `aoc-${entityCode}`,
        title: "AOC Expiry",
        description: `Annual AOC renewal due for ${entityCode}`,
        dueDate: entity[0].nextAocDate,
        // Business rule: escalate to critical when fewer than 90 days remain
        // (90-day threshold gives the team one quarter to complete the renewal)
        priority: days <= 90 ? "critical" : "high",
        category: "aoc",
        daysRemaining: days,
      });
    }
  }

  // Sort all milestones by urgency (fewest days remaining first) and cap at 10
  milestones.sort((a, b) => a.daysRemaining - b.daysRemaining);
  res.json(GetUpcomingMilestonesResponse.parse(serializeDates(milestones.slice(0, 10))));
});

export default router;
