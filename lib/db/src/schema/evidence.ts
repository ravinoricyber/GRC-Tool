/**
 * @file lib/db/src/schema/evidence.ts
 * @description Schema for the **Evidence Requests** domain of the GRC data model.
 *
 * Evidence requests are the primary workflow unit for gathering audit artefacts.
 * During an assessment, the QSA or internal compliance team raises evidence
 * requests — each one asks a control owner or system team to provide documentation
 * (e.g. firewall rule exports, penetration test reports, access-review screenshots)
 * that demonstrates a specific control is operating effectively.
 *
 * Each evidence request is tied to:
 *   - A specific control reference (and optionally its control row)
 *   - A framework (so the request appears in the correct compliance programme)
 *   - An entity (so evidence is segregated by merchant brand)
 *   - Optionally an assessment engagement (for structured fieldwork cycles)
 *
 * Relationships:
 *  - Many evidence requests → one Assessment (via assessmentId, optional)
 *  - Many evidence requests → one Control (via controlId / controlRef, optional)
 *  - Many evidence requests → one Entity (via entityCode)
 *  - Many evidence requests → one Framework (via frameworkCode)
 */

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * `evidence_requests` table — one row per evidence item requested from control owners.
 */
export const evidenceRequestsTable = pgTable("evidence_requests", {
  /** UUID primary key. */
  id: text("id").primaryKey(),

  /**
   * Human-readable sequential identifier shown in the UI and email notifications.
   * Format: `EVR-YYYY-NNNN`, e.g. `"EVR-2026-0001"`.
   * Must be unique so stakeholders can reference a specific request unambiguously.
   */
  code: text("code").notNull().unique(), // EVR-2026-0001

  /**
   * Foreign key to `assessments.id` (optional).
   * Links this request to a formal assessment engagement; null for ad-hoc requests
   * raised outside of a scheduled assessment cycle.
   */
  assessmentId: text("assessment_id"),

  /**
   * Foreign key to `controls.id` (optional).
   * When populated, ties the evidence directly to a specific control row,
   * enabling the platform to auto-update that control's finding status once
   * evidence is approved.
   */
  controlId: text("control_id"),

  /**
   * Denormalised framework control reference (e.g. `"1.2.1"`, `"CC6.1"`).
   * Stored separately so the request can be displayed with its control ref
   * even if the full controls row is unavailable.
   */
  controlRef: text("control_ref").notNull(), // "1.2.1"

  /** Denormalised title of the related control for display without a join. */
  controlName: text("control_name"),

  /**
   * Short code of the parent framework (e.g. `"PCI-DSS"`, `"SOC2"`).
   * Used for filtering evidence requests by compliance programme.
   */
  frameworkCode: text("framework_code").notNull(),

  /** Full framework display name, denormalised for read-heavy UI queries. */
  frameworkName: text("framework_name"),

  /**
   * Foreign key to `entities.code`.
   * Evidence is always scoped to an entity so that each merchant's audit artefacts
   * remain segregated.
   */
  entityCode: text("entity_code").notNull(),

  /** Short descriptive title of what evidence is being requested. */
  title: text("title").notNull(),

  /** Detailed instructions for the assignee explaining what artefact to provide and in what format. */
  description: text("description"),

  /**
   * Workflow status tracking the request through its lifecycle.
   * - `requested`   – request has been raised but not yet picked up
   * - `in-progress` – assignee is actively gathering the evidence
   * - `submitted`   – assignee has uploaded/provided the artefact for review
   * - `approved`    – reviewer has accepted the evidence as sufficient
   * - `rejected`    – reviewer found the evidence insufficient; requires re-submission
   */
  status: text("status").notNull().default("requested"), // requested|in-progress|submitted|approved|rejected

  /**
   * Priority level influencing how urgently the evidence must be collected.
   * Allowed values: `critical` | `high` | `medium` | `low`
   */
  priority: text("priority").notNull().default("medium"), // critical|high|medium|low

  /**
   * Username or display name of the person responsible for providing the evidence.
   * Typically a control owner or system team member within the entity.
   */
  assignee: text("assignee"),

  /** Username or display name of the compliance team member who raised this request. */
  requestedBy: text("requested_by"),

  /** ISO-8601 date (YYYY-MM-DD) by which the evidence must be submitted to stay on track for the assessment timeline. */
  dueDate: text("due_date"), // YYYY-MM-DD

  /** Timestamp of when the evidence request was first raised (defaults to row insertion time). */
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),

  /** Timestamp of when the evidence was formally approved; null until a reviewer accepts the submission. */
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  /** Row creation timestamp (distinct from `requestedAt` in case records are back-filled). */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Zod schema for validating insert payloads.
 * Both `requestedAt` and `createdAt` are omitted because database defaults handle them.
 */
export const insertEvidenceSchema = createInsertSchema(evidenceRequestsTable).omit({ requestedAt: true, createdAt: true });

/** TypeScript type inferred from the insert Zod schema — use for API request bodies. */
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;

/** TypeScript type inferred from the full table select — use for data returned from queries. */
export type EvidenceRequest = typeof evidenceRequestsTable.$inferSelect;
