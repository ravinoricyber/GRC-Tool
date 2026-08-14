import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const controlsTable = pgTable("controls", {
  id: text("id").primaryKey(),
  frameworkId: text("framework_id").notNull(),
  frameworkCode: text("framework_code").notNull(),
  ref: text("ref").notNull(), // e.g. "1.1.1", "CC6.1"
  title: text("title").notNull(),
  description: text("description"),
  domain: text("domain").notNull(),
  domainNumber: integer("domain_number").notNull().default(1),
  entityCode: text("entity_code"), // null = applies to all entities
  finding: text("finding"), // in-place|not-applicable|not-tested|not-in-place
  notes: text("notes"),
  lastTestedAt: text("last_tested_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertControlSchema = createInsertSchema(controlsTable).omit({ createdAt: true });
export type InsertControl = z.infer<typeof insertControlSchema>;
export type Control = typeof controlsTable.$inferSelect;
