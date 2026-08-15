/**
 * @file lib/db/src/schema/frameworks.ts
 * @description Schema for the **Frameworks** domain of the GRC data model.
 *
 * A "framework" is a regulatory or industry-standard compliance programme that
 * the organisation must adhere to.  Examples include:
 *   - PCI DSS 4.0   – Payment Card Industry Data Security Standard
 *   - SOC 2 Type II – Service Organization Controls (AICPA Trust Services Criteria)
 *   - ISO 27001      – Information Security Management System standard
 *
 * Frameworks act as the top-level grouping for controls: every control belongs
 * to exactly one framework.  Assessments, AoCs, and Policies are also associated
 * with a specific framework to indicate which standard they address.
 *
 * Relationships:
 *  - One framework → many Controls (via controls.frameworkId / frameworkCode)
 *  - One framework → many Assessments (via assessments.frameworkId)
 *  - One framework → many Aocs (via aocs.frameworkCode)
 *  - Referenced by Policies through their `frameworks[]` array
 */

import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * `frameworks` table — one row per compliance framework the organisation manages.
 */
export const frameworksTable = pgTable("frameworks", {
  /**
   * Unique identifier for the framework.
   * May be a UUID or a human-readable slug such as `"pci-dss-4"` or `"soc2-2023"`.
   */
  id: text("id").primaryKey(), // uuid or slug like "pci-dss-4"

  /**
   * Short uppercase code used as a compact foreign key across the schema.
   * e.g. `"PCI-DSS"`, `"SOC2"`, `"ISO27001"`.
   */
  code: text("code").notNull().unique(),

  /** Full display name of the framework, e.g. "PCI DSS 4.0". */
  name: text("name").notNull(),

  /** Version string of the framework, e.g. "4.0", "2017", "2022". */
  version: text("version").notNull(),

  /**
   * Operational priority assigned to this framework by the compliance team.
   * Drives UI ordering and alerting thresholds.
   * Allowed values: `critical` | `high` | `medium` | `low`
   */
  priority: text("priority").notNull().default("medium"), // critical|high|medium|low

  /**
   * Lifecycle status of the framework within the organisation's compliance programme.
   * - `active`    – currently under active management and assessment
   * - `monitored` – tracked for informational purposes but not yet formally assessed
   * - `retired`   – no longer applicable; retained for historical context
   */
  status: text("status").notNull().default("active"), // active|monitored|retired

  /** High-level narrative description of what the framework covers and why it applies. */
  summary: text("summary").notNull(),

  /**
   * Denormalised count of top-level requirement domains (groupings of controls)
   * within this framework.  Kept in sync by application logic for quick display
   * without a COUNT query.
   */
  domainsCount: integer("domains_count").notNull().default(0),

  /** Human-readable label for the next key compliance milestone, e.g. "Annual ROC renewal – Q3 2025". */
  nextMilestone: text("next_milestone"),

  /** Name of the internal team member or role accountable for this framework. */
  owner: text("owner"),

  /** Row creation timestamp, stored with time zone for auditability. */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Zod schema for validating insert payloads.
 * `createdAt` is omitted because the database default handles it automatically.
 */
export const insertFrameworkSchema = createInsertSchema(frameworksTable).omit({ createdAt: true });

/** TypeScript type inferred from the insert Zod schema — use for API request bodies. */
export type InsertFramework = z.infer<typeof insertFrameworkSchema>;

/** TypeScript type inferred from the full table select — use for data returned from queries. */
export type Framework = typeof frameworksTable.$inferSelect;
