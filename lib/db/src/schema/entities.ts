import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const entitiesTable = pgTable("entities", {
  code: text("code").primaryKey(), // gopuff | bevmo | liquorbarn
  name: text("name").notNull(),
  legalName: text("legal_name").notNull(),
  merchantLevel: text("merchant_level"),
  saqType: text("saq_type"),
  cdeScope: text("cde_scope"),
  lastAocDate: text("last_aoc_date"), // YYYY-MM-DD string
  nextAocDate: text("next_aoc_date"), // YYYY-MM-DD string
  qsaCompany: text("qsa_company"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEntitySchema = createInsertSchema(entitiesTable).omit({ createdAt: true });
export type InsertEntity = z.infer<typeof insertEntitySchema>;
export type Entity = typeof entitiesTable.$inferSelect;
