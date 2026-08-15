/**
 * @file lib/db/src/schema/assessments.ts
 * @description Schema for the **Assessments** domain of the GRC data model.
 *
 * An "assessment" represents a formal audit engagement — a bounded time-period
 * during which a QSA or internal team tests controls, gathers evidence, and
 * ultimately produces a compliance artefact (Report on Compliance, AoC, or
 * SOC 2 report).
 *
 * Assessment lifecycle stages:
 *  1. `planning`  – scope, schedule, and assessor assignment are being agreed
 *  2. `fieldwork` – active testing; evidence requests are being raised and fulfilled
 *  3. `reporting` – fieldwork complete; QSA is drafting the report / AoC
 *  4. `closed`    – report issued and AoC (or equivalent) finalised
 *
 * Relationships:
 *  - Many assessments → one Entity (via entityCode)
 *  - Many assessments → one Framework (via frameworkId / frameworkCode)
 *  - One assessment   → many EvidenceRequests (via evidenceRequests.assessmentId)
 *  - One assessment   → one AoC (logical, not enforced by FK — linked via entityCode + period)
 */

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * `assessments` table — one row per formal compliance assessment engagement.
 */
export const assessmentsTable = pgTable("assessments", {
  /** UUID primary key. */
  id: text("id").primaryKey(),

  /**
   * Foreign key to `entities.code`.
   * Identifies which merchant entity this assessment is being conducted for.
   */
  entityCode: text("entity_code").notNull(),

  /**
   * Foreign key to `frameworks.id`.
   * Identifies the compliance framework being assessed (e.g. PCI DSS, SOC 2).
   */
  frameworkId: text("framework_id").notNull(),

  /**
   * Denormalised short code of the parent framework (e.g. `"PCI-DSS"`, `"SOC2"`).
   * Stored redundantly to simplify filtered list queries.
   */
  frameworkCode: text("framework_code").notNull(),

  /** Full framework display name, denormalised for read queries. */
  frameworkName: text("framework_name"),

  /** Human-readable name for this assessment engagement, e.g. "Gopuff PCI DSS 4.0 Annual Assessment FY2025". */
  name: text("name").notNull(),

  /**
   * Name of the Qualified Security Assessor company conducting this engagement.
   * Null for internal (first-party) assessments not requiring a certified QSA.
   */
  qsaCompany: text("qsa_company"),

  /**
   * Name of the lead assessor individual managing fieldwork and reporting.
   * May be a QSA for PCI assessments or an internal auditor for readiness reviews.
   */
  leadAssessor: text("lead_assessor"),

  /** ISO-8601 date (YYYY-MM-DD) when assessment fieldwork is scheduled to begin. */
  plannedStart: text("planned_start"), // YYYY-MM-DD

  /** ISO-8601 date (YYYY-MM-DD) when the assessment is scheduled to be completed. */
  plannedEnd: text("planned_end"), // YYYY-MM-DD

  /**
   * ISO-8601 date (YYYY-MM-DD) when fieldwork actually commenced.
   * May differ from `plannedStart` due to scheduling changes or scope adjustments.
   */
  actualStart: text("actual_start"), // YYYY-MM-DD

  /**
   * ISO-8601 date (YYYY-MM-DD) when the assessment was actually completed.
   * Null until the assessment reaches the `closed` status.
   */
  actualEnd: text("actual_end"), // YYYY-MM-DD

  /**
   * Current lifecycle stage of the assessment engagement.
   * - `planning`  – scope and schedule are being defined
   * - `fieldwork` – active evidence gathering and control testing
   * - `reporting` – drafting the final compliance report / AoC
   * - `closed`    – assessment complete and report issued
   */
  status: text("status").notNull().default("planning"), // planning|fieldwork|reporting|closed

  /** Row creation timestamp, stored with time zone for auditability. */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Zod schema for validating insert payloads.
 * `createdAt` is omitted because the database default handles it automatically.
 */
export const insertAssessmentSchema = createInsertSchema(assessmentsTable).omit({ createdAt: true });

/** TypeScript type inferred from the insert Zod schema — use for API request bodies. */
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;

/** TypeScript type inferred from the full table select — use for data returned from queries. */
export type Assessment = typeof assessmentsTable.$inferSelect;
