import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const vendorsTable = pgTable("vendors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  serviceType: text("service_type").notNull(),
  description: text("description"),
  riskLevel: text("risk_level").notNull().default("medium"), // critical|high|medium|low
  status: text("status").notNull().default("active"), // active|inactive|under-review
  entities: text("entities").array().notNull().default([]),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  lastReviewDate: text("last_review_date"), // YYYY-MM-DD
  nextReviewDate: text("next_review_date"), // YYYY-MM-DD
  hasPciCertification: boolean("has_pci_certification").notNull().default(false),
  certificationExpiry: text("certification_expiry"), // YYYY-MM-DD
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ createdAt: true });
export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendorsTable.$inferSelect;
