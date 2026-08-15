/**
 * @file lib/db/src/schema/policies.ts
 * @description Schema for the **Policies** domain of the GRC data model.
 *
 * Policies are the organisation's internal written documents (information security
 * policies, procedures, standards, and guidelines) that demonstrate how controls
 * are implemented and maintained.  In a PCI DSS or SOC 2 audit, auditors will
 * request policy documents as evidence that governance processes are formalised.
 *
 * Each policy:
 *  - Has a unique code (e.g. "POL-001") for easy cross-referencing in evidence packages
 *  - Is mapped to one or more frameworks to indicate which standards it satisfies
 *  - Is scoped to one or more entities, reflecting which brands operate under that policy
 *  - Carries version and review-date metadata to support policy lifecycle management
 *
 * Relationships:
 *  - Many policies ←→ many Frameworks (via `frameworks[]` array of framework codes)
 *  - Many policies ←→ many Entities   (via `entities[]` array of entity codes)
 *  - Policies are referenced by EvidenceRequests as supporting documentation
 */

import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * `policies` table — one row per internal governance document.
 */
export const policiesTable = pgTable("policies", {
  /** UUID primary key. */
  id: text("id").primaryKey(),

  /**
   * Sequential human-readable policy identifier used in document headers and
   * compliance evidence packages.  Format: `POL-NNN`, e.g. `"POL-001"`.
   * Must be unique across all policies.
   */
  code: text("code").notNull().unique(), // POL-001

  /** Full title of the policy document, e.g. "Information Security Policy". */
  name: text("name").notNull(),

  /**
   * Name of the policy owner — the role or individual accountable for maintaining
   * this document and ensuring it is reviewed on schedule.
   */
  owner: text("owner").notNull(),

  /**
   * Document version string, e.g. `"1.0"`, `"2.3"`.
   * Incremented each time the policy is substantively revised.
   */
  version: text("version").notNull(),

  /**
   * Lifecycle status of the policy.
   * - `draft`      – under authorship, not yet in force
   * - `current`    – approved and currently in effect
   * - `review-due` – in effect but past the scheduled review date; review is overdue
   * - `overdue`    – significantly past review date; escalation warranted
   * - `retired`    – superseded or no longer applicable
   */
  status: text("status").notNull().default("current"), // draft|current|review-due|overdue|retired

  /** ISO-8601 date (YYYY-MM-DD) when this version of the policy came into effect. */
  effectiveDate: text("effective_date"), // YYYY-MM-DD

  /**
   * ISO-8601 date (YYYY-MM-DD) by which the policy must be reviewed and re-approved.
   * PCI DSS Requirement 12.1 mandates that information security policies are reviewed
   * at least once every 12 months.
   */
  reviewDate: text("review_date"), // YYYY-MM-DD

  /** Total page count of the policy document (informational; used in UI summaries). */
  pages: integer("pages"),

  /**
   * Array of framework codes (e.g. `["PCI-DSS", "SOC2"]`) indicating which
   * compliance frameworks this policy satisfies controls for.
   */
  frameworks: text("frameworks").array().notNull().default([]),

  /**
   * Array of entity codes (e.g. `["gopuff", "bevmo"]`) indicating which merchant
   * entities this policy applies to.  Enables entity-scoped policy filtering.
   */
  entities: text("entities").array().notNull().default([]),

  /** Brief narrative summary of the policy's scope and purpose. */
  description: text("description"),

  /** Row creation timestamp, stored with time zone for auditability. */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Zod schema for validating insert payloads.
 * `createdAt` is omitted because the database default handles it automatically.
 */
export const insertPolicySchema = createInsertSchema(policiesTable).omit({ createdAt: true });

/** TypeScript type inferred from the insert Zod schema — use for API request bodies. */
export type InsertPolicy = z.infer<typeof insertPolicySchema>;

/** TypeScript type inferred from the full table select — use for data returned from queries. */
export type Policy = typeof policiesTable.$inferSelect;
