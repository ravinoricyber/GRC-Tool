/**
 * @file routes/dashboard.ts
 * @description Aggregated read-only endpoints that power the compliance
 * dashboard. Each endpoint performs in-process aggregation over data fetched
 * from multiple tables rather than relying on complex SQL views, which keeps
 * the queries readable and portable. All endpoints require an `entityCode`
 * query parameter so the dashboard can display per-entity metrics.
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

const router: IRouter = Router();

/**
 * GET /dashboard/summary
 *
 * Returns headline compliance KPIs for a specific entity. Metrics include:
 * - Overall readiness percentage (passing controls / total controls)
 * - Open, overdue, and due-soon evidence request counts
 * - Active framework and policy counts (global, not entity-scoped)
 * - Open assessment count and vendor count
 * - The entity's next AOC renewal date
 *
 * "Due soon" is defined as having a due date within the next 7 days.
 * Controls and vendors are fetched globally (not filtered by entity) because
 * those tables represent the shared compliance baseline.
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
  const openEvidence = evidenceRows.filter(e => e.status === "requested" || e.status === "in-progress");
  const now = new Date();
  // "Due soon" threshold: 7 days from now
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const overdue = openEvidence.filter(e => e.dueDate && new Date(e.dueDate) < now);
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
 * Returns evidence request counts grouped by status for a specific entity.
 * All five canonical status values are always present in the response (with
 * a count of 0 when no rows match) so the front-end chart does not need to
 * handle missing keys.
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
 * Returns per-domain control coverage metrics for the PCI DSS 4.0 framework.
 * Controls are grouped by their `domainNumber` (1–12, corresponding to the
 * 12 PCI DSS requirements). Each domain entry includes pass/in-progress/
 * blocked counts and an overall pass percentage.
 *
 * The domain name map is defined in-file because PCI DSS requirement names
 * are stable and do not need to be stored in the database.
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

  // Static mapping of PCI DSS requirement numbers to their official titles
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
 * Returns time-sensitive compliance items due in the near future for a
 * specific entity, sorted by days remaining ascending. At most 10 items are
 * returned to keep the dashboard widget focused on the most urgent work.
 *
 * Two categories of milestones are included:
 * 1. **Evidence requests** — open items due within the next 60 days.
 * 2. **AOC expiry** — the entity's next AOC renewal if it falls within 365 days.
 *    Priority is `"critical"` when fewer than 90 days remain, otherwise `"high"`.
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
    // Only surface open items that are due within the 60-day horizon
    if (days > 0 && days <= 60 && (e.status === "requested" || e.status === "in-progress")) {
      milestones.push({
        id: e.id,
        title: e.title,
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
        id: `aoc-${entityCode}`,
        title: "AOC Expiry",
        description: `Annual AOC renewal due for ${entityCode}`,
        dueDate: entity[0].nextAocDate,
        // Escalate priority to critical when fewer than 90 days remain
        priority: days <= 90 ? "critical" : "high",
        category: "aoc",
        daysRemaining: days,
      });
    }
  }

  // Sort all milestones by urgency and return at most 10 to keep the widget concise
  milestones.sort((a, b) => a.daysRemaining - b.daysRemaining);
  res.json(GetUpcomingMilestonesResponse.parse(serializeDates(milestones.slice(0, 10))));
});

export default router;
