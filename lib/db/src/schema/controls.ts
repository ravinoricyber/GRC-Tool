/**
 * @file lib/db/src/schema/controls.ts
 * @description Schema for the **Controls** domain of the GRC data model.
 *
 * A "control" is an individual requirement or safeguard drawn from a compliance
 * framework (e.g. PCI DSS Requirement 1.1.1 or SOC 2 CC6.1).  Controls are the
 * atomic unit of compliance evidence: each one must be tested, found in-place (or
 * explicitly exempted), and backed by evidence before an attestation can be issued.
 *
 * Controls can be global (entityCode = null, applying to all entities) or scoped to
 * a specific merchant entity when their CDE boundaries differ — for example, a
 * control relating to physical terminals may only apply to BevMo! and Liquor Barn.
 *
 * Relationships:
 *  - Many controls → one Framework (via frameworkId / frameworkCode)
 *  - One control   → many EvidenceRequests (via evidenceRequests.controlId)
 *  - Many controls → one Entity, or null if the control is shared (via entityCode)
 */

import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * `controls` table — one row per individual framework requirement tracked by the platform.
 */
export const controlsTable = pgTable("controls", {
  /** UUID primary key for this control instance. */
  id: text("id").primaryKey(),

  /**
   * Foreign key to `frameworks.id`.
   * Links this control back to the parent compliance framework.
   */
  frameworkId: text("framework_id").notNull(),

  /**
   * Denormalised short code of the parent framework (e.g. `"PCI-DSS"`, `"SOC2"`).
   * Stored redundantly to avoid joins on common list/filter queries.
   */
  frameworkCode: text("framework_code").notNull(),

  /**
   * Human-readable control reference number as defined by the framework publisher.
   * Examples: `"1.1.1"` (PCI DSS sub-requirement), `"CC6.1"` (SOC 2 Common Criteria),
   * `"A.9.4.2"` (ISO 27001 Annex A control).
   */
  ref: text("ref").notNull(), // e.g. "1.1.1", "CC6.1"

  /** Short title of the control as published in the framework documentation. */
  title: text("title").notNull(),

  /** Full requirement text or description providing implementation guidance. */
  description: text("description"),

  /**
   * Top-level domain (grouping) this control belongs to within its framework.
   * In PCI DSS these map to the 12 high-level requirements
   * (e.g. "Network Security Controls", "Protect Account Data").
   */
  domain: text("domain").notNull(),

  /**
   * Numeric ordering key for the domain, enabling sorted display of domains in
   * the UI without a string sort that might mis-order (e.g. "10" before "2").
   */
  domainNumber: integer("domain_number").notNull().default(1),

  /**
   * Foreign key to `entities.code`, scoping this control to a single merchant entity.
   * When null, the control applies universally to all entities under this framework.
   * This allows entity-specific exclusions (e.g. a control not relevant to a purely
   * e-commerce entity that has no physical card-present terminals).
   */
  entityCode: text("entity_code"), // null = applies to all entities

  /**
   * Assessment finding status for this control, populated during fieldwork.
   * - `in-place`       – control is fully implemented and effective
   * - `not-applicable` – control does not apply to this entity's environment (documented exception)
   * - `not-tested`     – control is within scope but has not yet been tested
   * - `not-in-place`   – control was tested and found to be deficient (a finding/gap)
   */
  finding: text("finding"), // in-place|not-applicable|not-tested|not-in-place

  /** Free-text assessor notes or remediation guidance associated with this control's current finding. */
  notes: text("notes"),

  /**
   * ISO-8601 date-time string (YYYY-MM-DD or full ISO timestamp) recording when
   * this control was most recently tested or reviewed by the assessor.
   */
  lastTestedAt: text("last_tested_at"),

  /** Row creation timestamp, stored with time zone for auditability. */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Zod schema for validating insert payloads.
 * `createdAt` is omitted because the database default handles it automatically.
 */
export const insertControlSchema = createInsertSchema(controlsTable).omit({ createdAt: true });

/** TypeScript type inferred from the insert Zod schema — use for API request bodies. */
export type InsertControl = z.infer<typeof insertControlSchema>;

/** TypeScript type inferred from the full table select — use for data returned from queries. */
export type Control = typeof controlsTable.$inferSelect;
