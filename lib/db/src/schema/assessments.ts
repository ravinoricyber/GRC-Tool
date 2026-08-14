import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const assessmentsTable = pgTable("assessments", {
  id: text("id").primaryKey(),
  entityCode: text("entity_code").notNull(),
  frameworkId: text("framework_id").notNull(),
  frameworkCode: text("framework_code").notNull(),
  frameworkName: text("framework_name"),
  name: text("name").notNull(),
  qsaCompany: text("qsa_company"),
  leadAssessor: text("lead_assessor"),
  plannedStart: text("planned_start"), // YYYY-MM-DD
  plannedEnd: text("planned_end"), // YYYY-MM-DD
  actualStart: text("actual_start"), // YYYY-MM-DD
  actualEnd: text("actual_end"), // YYYY-MM-DD
  status: text("status").notNull().default("planning"), // planning|fieldwork|reporting|closed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAssessmentSchema = createInsertSchema(assessmentsTable).omit({ createdAt: true });
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type Assessment = typeof assessmentsTable.$inferSelect;
