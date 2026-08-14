import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const evidenceRequestsTable = pgTable("evidence_requests", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // EVR-2026-0001
  assessmentId: text("assessment_id"),
  controlId: text("control_id"),
  controlRef: text("control_ref").notNull(), // "1.2.1"
  controlName: text("control_name"),
  frameworkCode: text("framework_code").notNull(),
  frameworkName: text("framework_name"),
  entityCode: text("entity_code").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("requested"), // requested|in-progress|submitted|approved|rejected
  priority: text("priority").notNull().default("medium"), // critical|high|medium|low
  assignee: text("assignee"),
  requestedBy: text("requested_by"),
  dueDate: text("due_date"), // YYYY-MM-DD
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEvidenceSchema = createInsertSchema(evidenceRequestsTable).omit({ requestedAt: true, createdAt: true });
export type InsertEvidence = z.infer<typeof insertEvidenceSchema>;
export type EvidenceRequest = typeof evidenceRequestsTable.$inferSelect;
