import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityLogTable = pgTable("activity_log", {
  id: text("id").primaryKey(),
  entityCode: text("entity_code"),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activityLogTable).omit({ createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type ActivityEntry = typeof activityLogTable.$inferSelect;
