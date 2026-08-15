/**
 * @file lib/db/src/schema/activity.ts
 * @description Schema for the **Activity Log** domain of the GRC data model.
 *
 * The activity log provides an append-only audit trail of user-initiated actions
 * across the compliance platform.  It is used to:
 *  - Satisfy PCI DSS Requirement 10 (log and monitor all access to system components
 *    and cardholder data) at the application level
 *  - Power the "Recent Activity" feed in the UI dashboard
 *  - Support forensic investigation of who changed what and when
 *
 * Records are never updated or deleted — new rows are only ever appended.
 * The `entityCode` may be null for platform-level actions (e.g. framework
 * configuration changes) that are not scoped to a single merchant.
 *
 * Relationships:
 *  - Many activity entries → one Entity (via entityCode, optional)
 *  - Activity entries reference other records descriptively via `target` (no FK enforcement)
 */

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * `activity_log` table — immutable audit trail of user actions in the GRC platform.
 */
export const activityLogTable = pgTable("activity_log", {
  /** UUID primary key. */
  id: text("id").primaryKey(),

  /**
   * Foreign key to `entities.code` (optional).
   * When set, scopes this log entry to a specific merchant entity, enabling
   * per-entity activity feeds.  Null for cross-entity or platform-level actions.
   */
  entityCode: text("entity_code"),

  /**
   * Identifier of the user who performed the action — typically a username,
   * email address, or display name from the authentication system.
   */
  actor: text("actor").notNull(),

  /**
   * Short verb-phrase describing what was done, e.g.
   * `"created evidence request"`, `"updated control finding"`,
   * `"approved AoC"`, `"assigned vendor review"`.
   * Kept intentionally brief for display in activity feeds.
   */
  action: text("action").notNull(),

  /**
   * Human-readable identifier of the object acted upon, e.g.
   * `"EVR-2026-0042"`, `"POL-007"`, `"PCI-DSS Req 1.1.1"`.
   * Not a foreign key — stored as a display string to remain readable
   * even if the referenced record is later deleted.
   */
  target: text("target").notNull(),

  /** Timestamp when this action occurred; used for chronological ordering of the activity feed. */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Zod schema for validating insert payloads.
 * `createdAt` is omitted because the database default handles it automatically.
 */
export const insertActivitySchema = createInsertSchema(activityLogTable).omit({ createdAt: true });

/** TypeScript type inferred from the insert Zod schema — use for API request bodies. */
export type InsertActivity = z.infer<typeof insertActivitySchema>;

/** TypeScript type inferred from the full table select — use for data returned from queries. */
export type ActivityEntry = typeof activityLogTable.$inferSelect;
