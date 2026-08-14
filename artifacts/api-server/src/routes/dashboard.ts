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

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const entityCode = req.query.entityCode as string;
  if (!entityCode) {
    res.status(400).json({ error: "entityCode is required" });
    return;
  }

  const [entity] = await db.select().from(entitiesTable).where(eq(entitiesTable.code, entityCode));

  // Count open evidence
  const evidenceRows = await db.select().from(evidenceRequestsTable).where(eq(evidenceRequestsTable.entityCode, entityCode));
  const openEvidence = evidenceRows.filter(e => e.status === "requested" || e.status === "in-progress");
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const overdue = openEvidence.filter(e => e.dueDate && new Date(e.dueDate) < now);
  const dueSoon = openEvidence.filter(e => e.dueDate && new Date(e.dueDate) >= now && new Date(e.dueDate) <= soon);

  // Controls
  const controls = await db.select().from(controlsTable);
  const passing = controls.filter(c => c.finding === "in-place").length;

  // Policy count
  const policies = await db.select().from(policiesTable);
  const activePolicies = policies.filter(p => p.status === "current").length;

  // Frameworks
  const frameworks = await db.select().from(frameworksTable);
  const activeFrameworks = frameworks.filter(f => f.status === "active").length;

  // Assessments
  const assessments = await db.select().from(assessmentsTable).where(eq(assessmentsTable.entityCode, entityCode));
  const openAssessments = assessments.filter(a => a.status !== "closed").length;

  // Vendors
  const vendors = await db.select().from(vendorsTable);

  // Overall readiness %: passing controls / total (avoid divide by 0)
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

router.get("/dashboard/evidence-by-status", async (req, res): Promise<void> => {
  const entityCode = req.query.entityCode as string;
  if (!entityCode) {
    res.status(400).json({ error: "entityCode is required" });
    return;
  }

  const rows = await db
    .select({ status: evidenceRequestsTable.status, count: count() })
    .from(evidenceRequestsTable)
    .where(eq(evidenceRequestsTable.entityCode, entityCode))
    .groupBy(evidenceRequestsTable.status);

  const statuses = ["requested", "in-progress", "submitted", "approved", "rejected"];
  const result = statuses.map(s => ({
    status: s,
    count: rows.find(r => r.status === s)?.count ?? 0,
  }));
  res.json(GetEvidenceByStatusResponse.parse(serializeDates(result)));
});

router.get("/dashboard/control-coverage", async (req, res): Promise<void> => {
  const entityCode = req.query.entityCode as string;
  if (!entityCode) {
    res.status(400).json({ error: "entityCode is required" });
    return;
  }

  // Group PCI DSS controls by domain
  const pciControls = await db
    .select()
    .from(controlsTable)
    .where(eq(controlsTable.frameworkCode, "pci-dss-4"));

  // Group by domainNumber
  const byDomain = new Map<number, typeof pciControls>();
  for (const c of pciControls) {
    const d = c.domainNumber;
    if (!byDomain.has(d)) byDomain.set(d, []);
    byDomain.get(d)!.push(c);
  }

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
    const inProgress = controls.filter(c => c.finding === "not-tested").length;
    const blocked = controls.filter(c => c.finding === "not-in-place").length;
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
  }).sort((a, b) => Number(a.requirementId) - Number(b.requirementId));

  res.json(GetControlCoverageResponse.parse(serializeDates(result)));
});

router.get("/dashboard/upcoming-milestones", async (req, res): Promise<void> => {
  const entityCode = req.query.entityCode as string;
  if (!entityCode) {
    res.status(400).json({ error: "entityCode is required" });
    return;
  }

  const now = new Date();

  // Evidence due soon (next 60 days)
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
    const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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

  // AOC expiry milestone
  const entity = await db.select().from(entitiesTable).where(eq(entitiesTable.code, entityCode));
  if (entity[0]?.nextAocDate) {
    const due = new Date(entity[0].nextAocDate);
    const days = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days > 0 && days <= 365) {
      milestones.push({
        id: `aoc-${entityCode}`,
        title: "AOC Expiry",
        description: `Annual AOC renewal due for ${entityCode}`,
        dueDate: entity[0].nextAocDate,
        priority: days <= 90 ? "critical" : "high",
        category: "aoc",
        daysRemaining: days,
      });
    }
  }

  // Sort by daysRemaining ascending
  milestones.sort((a, b) => a.daysRemaining - b.daysRemaining);
  res.json(GetUpcomingMilestonesResponse.parse(serializeDates(milestones.slice(0, 10))));
});

export default router;
