/**
 * @file lib/db/src/schema/vendors.ts
 * @description Schema for the **Vendors** domain of the GRC data model.
 *
 * "Vendors" are third-party service providers whose products or services interact
 * with, or could impact, the organisation's Cardholder Data Environment (CDE) or
 * broader information security posture.  Under PCI DSS Requirement 12.8, merchants
 * must maintain a list of all third-party service providers (TPSPs) that handle or
 * could affect the security of cardholder data, and must manage their compliance
 * status accordingly.
 *
 * The platform tracks:
 *  - Which entities engage each vendor (a vendor may serve one or all brands)
 *  - The vendor's inherent risk level (driving review frequency)
 *  - Whether the vendor holds its own PCI DSS certification (reducing residual risk)
 *  - Review cadence dates (annual or risk-driven)
 *
 * Relationships:
 *  - Many vendors ←→ many Entities (via `entities[]` array of entity codes)
 *  - Vendors may be referenced in evidence requests as evidence of third-party compliance
 */

import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * `vendors` table — one row per third-party service provider managed by the compliance programme.
 */
export const vendorsTable = pgTable("vendors", {
  /** UUID primary key. */
  id: text("id").primaryKey(),

  /** Vendor company name as it appears in contracts and the PCI TPSP register. */
  name: text("name").notNull(),

  /**
   * Category of service provided, used for risk classification and filtering.
   * Examples: `"Payment Processing"`, `"Cloud Infrastructure"`,
   * `"Penetration Testing"`, `"Identity & Access Management"`.
   */
  serviceType: text("service_type").notNull(),

  /** Free-text description of what the vendor does and how they interact with the CDE. */
  description: text("description"),

  /**
   * Inherent risk level assigned to this vendor based on their access to and
   * impact on cardholder data or critical systems.
   * - `critical` – direct access to PANs or core payment infrastructure
   * - `high`     – significant access to systems in or connected to the CDE
   * - `medium`   – indirect or limited CDE exposure
   * - `low`      – no meaningful CDE interaction (e.g. marketing tools)
   */
  riskLevel: text("risk_level").notNull().default("medium"), // critical|high|medium|low

  /**
   * Current engagement status of this vendor relationship.
   * - `active`       – vendor is currently in use and under active management
   * - `inactive`     – vendor is no longer engaged but retained for historical records
   * - `under-review` – vendor is being evaluated (new onboarding or periodic re-assessment)
   */
  status: text("status").notNull().default("active"), // active|inactive|under-review

  /**
   * Array of entity codes identifying which merchant brands engage this vendor.
   * A vendor used across all brands will have all three codes; a brand-specific
   * vendor may have only one.
   */
  entities: text("entities").array().notNull().default([]),

  /** Primary point-of-contact name at the vendor for compliance and security matters. */
  contactName: text("contact_name"),

  /** Email address for the vendor's compliance or security contact. */
  contactEmail: text("contact_email"),

  /**
   * ISO-8601 date (YYYY-MM-DD) of the most recent vendor compliance review.
   * PCI DSS Requirement 12.8.3 mandates that vendor compliance status is reviewed
   * at least annually (or more frequently for high-risk TPSPs).
   */
  lastReviewDate: text("last_review_date"), // YYYY-MM-DD

  /** ISO-8601 date (YYYY-MM-DD) when the next scheduled review of this vendor is due. */
  nextReviewDate: text("next_review_date"), // YYYY-MM-DD

  /**
   * Whether this vendor holds its own current PCI DSS certification (e.g. as a
   * Level-1 service provider listed on a card brand's registry).
   * A certified vendor reduces the assessing entity's audit burden for controls
   * delegated to that provider.
   */
  hasPciCertification: boolean("has_pci_certification").notNull().default(false),

  /**
   * ISO-8601 date (YYYY-MM-DD) when the vendor's PCI DSS certification expires.
   * Null when `hasPciCertification` is false.  The platform uses this to surface
   * alerts when a vendor's certification is approaching expiry.
   */
  certificationExpiry: text("certification_expiry"), // YYYY-MM-DD

  /** Free-text notes about the vendor relationship, risk exceptions, or review outcomes. */
  notes: text("notes"),

  /** Row creation timestamp, stored with time zone for auditability. */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Zod schema for validating insert payloads.
 * `createdAt` is omitted because the database default handles it automatically.
 */
export const insertVendorSchema = createInsertSchema(vendorsTable).omit({ createdAt: true });

/** TypeScript type inferred from the insert Zod schema — use for API request bodies. */
export type InsertVendor = z.infer<typeof insertVendorSchema>;

/** TypeScript type inferred from the full table select — use for data returned from queries. */
export type Vendor = typeof vendorsTable.$inferSelect;
