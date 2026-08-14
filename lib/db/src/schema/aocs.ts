import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aocsTable = pgTable("aocs", {
  id: text("id").primaryKey(),
  entityCode: text("entity_code").notNull(),
  frameworkCode: text("framework_code").notNull(),
  frameworkName: text("framework_name"),
  title: text("title").notNull(),
  status: text("status").notNull().default("current"), // current|superseded|draft
  qsaCompany: text("qsa_company"),
  qsaLead: text("qsa_lead"),
  issuedDate: text("issued_date"), // YYYY-MM-DD
  expiresDate: text("expires_date"), // YYYY-MM-DD
  period: text("period"), // "FY2025"
  result: text("result"),
  controlsCovered: integer("controls_covered"),
  findings: integer("findings"),
  filename: text("filename"),
  filePath: text("file_path"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAocSchema = createInsertSchema(aocsTable).omit({ createdAt: true });
export type InsertAoc = z.infer<typeof insertAocSchema>;
export type Aoc = typeof aocsTable.$inferSelect;
