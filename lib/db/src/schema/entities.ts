/**
 * @file lib/db/src/schema/entities.ts
 * @description Schema for the **Entities** domain of the GRC data model.
 *
 * An "entity" in this system represents a distinct legal merchant (business unit)
 * that operates within the Gopuff family of brands and carries its own compliance
 * obligations — chiefly under PCI DSS.  Each entity has its own merchant-level
 * classification, SAQ type, and CDE (Cardholder Data Environment) scope, allowing
 * the platform to track compliance posture independently for each brand.
 *
 * Relationships:
 *  - One entity → many Controls  (via controls.entityCode)
 *  - One entity → many EvidenceRequests (via evidenceRequests.entityCode)
 *  - One entity → many Assessments (via assessments.entityCode)
 *  - One entity → many Aocs (via aocs.entityCode)
 *  - Referenced by Policies and Vendors through their `entities[]` arrays
 */

import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * `entities` table — one row per legal merchant / business unit.
 *
 * The three expected entities in the current deployment are:
 *   - `gopuff`      – Gopuff (the parent rapid-delivery brand)
 *   - `bevmo`       – BevMo! (retail alcohol chain)
 *   - `liquorbarn`  – Liquor Barn (regional retail chain)
 */
export const entitiesTable = pgTable("entities", {
  /** Short, URL-safe identifier used as a foreign key throughout the schema. e.g. `gopuff`, `bevmo`, `liquorbarn` */
  code: text("code").primaryKey(), // gopuff | bevmo | liquorbarn

  /** Human-readable brand / trade name shown in the UI. */
  name: text("name").notNull(),

  /** Full legal entity name as it appears on compliance filings and contracts. */
  legalName: text("legal_name").notNull(),

  /**
   * PCI DSS merchant level (1–4) assigned by the card brands (Visa/Mastercard).
   * Level 1 is the highest volume (> 6 M transactions/year) and requires an
   * on-site QSA assessment; lower levels may self-assess via SAQ.
   * Stored as text to accommodate labels like "Level 1" or "1".
   */
  merchantLevel: text("merchant_level"),

  /**
   * Self-Assessment Questionnaire type (e.g. "SAQ-A", "SAQ-D").
   * Under PCI DSS, the SAQ type determines which subset of controls a merchant
   * must attest to — it depends on how the entity processes, stores, and
   * transmits cardholder data.  Level-1 merchants typically file an ROC instead.
   */
  saqType: text("saq_type"),

  /**
   * Description or boundary of the entity's Cardholder Data Environment (CDE).
   * The CDE is the set of people, processes, and technology that store, process,
   * or transmit cardholder data (PANs, CVVs, etc.).  Scoping the CDE is the
   * first step of every PCI DSS assessment.
   */
  cdeScope: text("cde_scope"),

  /** ISO-8601 date (YYYY-MM-DD) of the most recently issued Attestation of Compliance for this entity. */
  lastAocDate: text("last_aoc_date"), // YYYY-MM-DD string

  /** ISO-8601 date (YYYY-MM-DD) when the next AoC must be filed to maintain compliance status. */
  nextAocDate: text("next_aoc_date"), // YYYY-MM-DD string

  /**
   * Name of the Qualified Security Assessor (QSA) company engaged by this entity.
   * A QSA is a PCI SSC-certified firm authorised to perform PCI DSS audits and
   * sign off on Reports on Compliance (ROC) or Attestations of Compliance (AoC).
   */
  qsaCompany: text("qsa_company"),

  /** Soft-delete flag; inactive entities are hidden from the UI but retained for historical data integrity. */
  isActive: boolean("is_active").notNull().default(true),

  /** Row creation timestamp, stored with time zone for auditability. */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Zod schema for validating insert payloads.
 * `createdAt` is omitted because the database default handles it automatically.
 */
export const insertEntitySchema = createInsertSchema(entitiesTable).omit({ createdAt: true });

/** TypeScript type inferred from the insert Zod schema — use for API request bodies. */
export type InsertEntity = z.infer<typeof insertEntitySchema>;

/** TypeScript type inferred from the full table select — use for data returned from queries. */
export type Entity = typeof entitiesTable.$inferSelect;
