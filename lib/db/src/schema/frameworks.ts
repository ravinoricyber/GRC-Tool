/**
 * @file lib/db/src/schema/frameworks.ts
 * @description Schema for the **Frameworks** domain of the GRC data model.
 *
 * ## What is a Framework?
 * A "framework" is a regulatory, industry-standard, or contractual compliance
 * programme that the organisation must adhere to.  Examples include:
 *
 * | Code        | Name                                        | Publisher         |
 * |-------------|---------------------------------------------|-------------------|
 * | `PCI-DSS`   | Payment Card Industry Data Security Standard | PCI SSC           |
 * | `SOC2`      | SOC 2 Type II (Trust Services Criteria)      | AICPA             |
 * | `ISO27001`  | ISO/IEC 27001 Information Security Mgmt      | ISO / IEC          |
 * | `NIST-CSF`  | NIST Cybersecurity Framework                 | NIST              |
 *
 * ## Role in the data model
 * Frameworks act as the **top-level grouping** for controls: every control
 * belongs to exactly one framework.  Assessments, AoCs, and Policies are also
 * associated with a specific framework to indicate which standard they address.
 *
 * ## Relationships
 *  - One framework → many Controls     (via `controls.frameworkId` / `frameworkCode`)
 *  - One framework → many Assessments  (via `assessments.frameworkId`)
 *  - One framework → many Aocs         (via `aocs.frameworkCode`)
 *  - Referenced by Policies through their `frameworks[]` array column
 */

import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Table definition
// ---------------------------------------------------------------------------

/**
 * `frameworks` table — one row per compliance framework managed by the organisation.
 *
 * The table supports both UUID-keyed rows (for programmatically generated records)
 * and human-readable slug keys (e.g. `"pci-dss-4"`) to keep seed data legible.
 */
export const frameworksTable = pgTable("frameworks", {
  /**
   * Unique identifier for the framework row.
   *
   * - Constraints: primary key, text, not null (implicit for PK).
   * - May be a UUID (auto-generated) or a human-readable slug such as
   *   `"pci-dss-4"`, `"soc2-2023"`, `"iso27001-2022"`.
   * - Slug-style IDs make seed data and migration scripts more readable.
   */
  id: text("id").primaryKey(), // uuid or slug like "pci-dss-4"

  /**
   * Short uppercase code used as a compact **foreign key** across the schema.
   *
   * - Constraints: not null, unique.
   * - Examples: `"PCI-DSS"`, `"SOC2"`, `"ISO27001"`, `"NIST-CSF"`.
   * - This code is stored denormalised in `controls`, `assessments`, `aocs`,
   *   and `evidenceRequests` to avoid joins on high-frequency filter queries.
   * - Must be stable: changing a framework `code` requires updating all
   *   denormalised references in child tables.
   */
  code: text("code").notNull().unique(),

  /**
   * Full display name of the framework.
   *
   * - Constraints: not null.
   * - Examples: `"PCI DSS 4.0"`, `"SOC 2 Type II"`, `"ISO/IEC 27001:2022"`.
   * - Shown in page headings, reports, and compliance dashboards.
   */
  name: text("name").notNull(),

  /**
   * Version string of the framework as published by its governing body.
   *
   * - Constraints: not null.
   * - Examples: `"4.0"` (PCI DSS 4.0), `"2017"` (ISO 27001:2017), `"2022"`.
   * - The version matters for compliance: PCI DSS 3.2.1 and 4.0 have different
   *   requirement sets, so assessments must specify which version was assessed.
   */
  version: text("version").notNull(),

  /**
   * Operational priority assigned to this framework by the compliance programme owner.
   *
   * - Constraints: not null, defaults to `"medium"`.
   * - Allowed values: `"critical"` | `"high"` | `"medium"` | `"low"`.
   * - Drives UI ordering (higher-priority frameworks appear first), alerting
   *   thresholds, and escalation rules.
   * - Example: PCI DSS is typically `"critical"` for a payment company; an
   *   informational framework being monitored may be `"low"`.
   */
  priority: text("priority").notNull().default("medium"), // critical|high|medium|low

  /**
   * Lifecycle status of this framework within the organisation's compliance programme.
   *
   * - Constraints: not null, defaults to `"active"`.
   * - Allowed values:
   *   - `"active"`    — currently under formal management; assessments are scheduled
   *                     and evidence requests are being raised against its controls.
   *   - `"monitored"` — tracked for informational purposes (gap analysis, readiness
   *                     reviews) but not yet formally assessed or contractually required.
   *   - `"retired"`   — no longer applicable to the organisation; retained only for
   *                     historical context and traceability of past assessments.
   */
  status: text("status").notNull().default("active"), // active|monitored|retired

  /**
   * High-level narrative description of what the framework covers and why it
   * applies to the organisation.
   *
   * - Constraints: not null.
   * - Displayed on the framework detail page and in management reports.
   * - Should summarise scope, applicability, and key obligations.
   */
  summary: text("summary").notNull(),

  /**
   * Denormalised count of top-level requirement domains (groupings of controls)
   * within this framework.
   *
   * - Constraints: not null, defaults to `0`.
   * - In PCI DSS, domains map to the 12 high-level requirements
   *   (e.g. "Build and Maintain a Secure Network", "Protect Account Data").
   * - Stored here to support quick summary display without a COUNT query against
   *   the `controls` table.
   * - Application logic is responsible for keeping this in sync when controls
   *   are added or removed.
   */
  domainsCount: integer("domains_count").notNull().default(0),

  /**
   * Human-readable label for the next key compliance milestone.
   *
   * - Constraints: nullable.
   * - Examples: `"Annual ROC renewal – Q3 2025"`, `"SAQ-D submission – 2025-06-30"`.
   * - Displayed on the framework dashboard card to give stakeholders a quick
   *   view of upcoming deadlines without opening the full assessment record.
   */
  nextMilestone: text("next_milestone"),

  /**
   * Name of the internal team member, role, or department accountable for this
   * framework's compliance programme.
   *
   * - Constraints: nullable.
   * - Examples: `"Head of Information Security"`, `"Jane Smith"`, `"PCI Team"`.
   * - Used for escalation routing and ownership dashboards.
   */
  owner: text("owner"),

  /**
   * Row creation timestamp, stored with time zone.
   *
   * - Constraints: not null, defaults to `now()` at insert time.
   * - Immutable after insert — never update this column.
   */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Zod insert schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for validating `frameworks` insert payloads sent via the API.
 *
 * **Generated from** `frameworksTable` by `drizzle-zod`'s `createInsertSchema`.
 *
 * **Required fields** (caller must supply):
 *  - `id`      — primary key (UUID or slug).
 *  - `code`    — unique short code (e.g. `"PCI-DSS"`).
 *  - `name`    — full display name.
 *  - `version` — framework version string.
 *  - `summary` — narrative description.
 *
 * **Optional / defaulted fields**:
 *  - `priority`      — defaults to `"medium"` if omitted.
 *  - `status`        — defaults to `"active"` if omitted.
 *  - `domainsCount`  — defaults to `0` if omitted.
 *  - `nextMilestone` — nullable, may be omitted.
 *  - `owner`         — nullable, may be omitted.
 *
 * **Omitted fields**:
 *  - `createdAt` — handled by the database `defaultNow()`.
 *
 * @example
 * ```ts
 * const payload = insertFrameworkSchema.parse({
 *   id: "pci-dss-4",
 *   code: "PCI-DSS",
 *   name: "PCI DSS 4.0",
 *   version: "4.0",
 *   summary: "Payment Card Industry Data Security Standard version 4.0",
 *   priority: "critical",
 * });
 * await db.insert(frameworksTable).values(payload);
 * ```
 */
export const insertFrameworkSchema = createInsertSchema(frameworksTable).omit({ createdAt: true });

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

/**
 * `InsertFramework` — shape of the object required to insert a new framework row.
 *
 * Inferred from `insertFrameworkSchema` (the Zod insert schema).
 *
 * **Usage**: API request body validation, admin seed scripts, migration helpers.
 *
 * @example
 * ```ts
 * async function createFramework(body: InsertFramework) {
 *   const validated = insertFrameworkSchema.parse(body);
 *   const [row] = await db.insert(frameworksTable).values(validated).returning();
 *   return row;
 * }
 * ```
 */
export type InsertFramework = z.infer<typeof insertFrameworkSchema>;

/**
 * `Framework` — full shape of a row returned by a SELECT on `frameworksTable`.
 *
 * Inferred from the Drizzle table definition via `$inferSelect`.
 *
 * **Usage**: API response types, component props, anywhere framework data is read.
 *
 * @example
 * ```ts
 * const frameworks: Framework[] = await db.select().from(frameworksTable);
 * const active = frameworks.filter((f) => f.status === "active");
 * ```
 */
export type Framework = typeof frameworksTable.$inferSelect;
