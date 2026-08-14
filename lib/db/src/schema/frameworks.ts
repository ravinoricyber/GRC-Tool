import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const frameworksTable = pgTable("frameworks", {
  id: text("id").primaryKey(), // uuid or slug like "pci-dss-4"
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  priority: text("priority").notNull().default("medium"), // critical|high|medium|low
  status: text("status").notNull().default("active"), // active|monitored|retired
  summary: text("summary").notNull(),
  domainsCount: integer("domains_count").notNull().default(0),
  nextMilestone: text("next_milestone"),
  owner: text("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFrameworkSchema = createInsertSchema(frameworksTable).omit({ createdAt: true });
export type InsertFramework = z.infer<typeof insertFrameworkSchema>;
export type Framework = typeof frameworksTable.$inferSelect;
