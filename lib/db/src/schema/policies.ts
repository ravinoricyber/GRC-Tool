import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const policiesTable = pgTable("policies", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // POL-001
  name: text("name").notNull(),
  owner: text("owner").notNull(),
  version: text("version").notNull(),
  status: text("status").notNull().default("current"), // draft|current|review-due|overdue|retired
  effectiveDate: text("effective_date"), // YYYY-MM-DD
  reviewDate: text("review_date"), // YYYY-MM-DD
  pages: integer("pages"),
  frameworks: text("frameworks").array().notNull().default([]),
  entities: text("entities").array().notNull().default([]),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPolicySchema = createInsertSchema(policiesTable).omit({ createdAt: true });
export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export type Policy = typeof policiesTable.$inferSelect;
