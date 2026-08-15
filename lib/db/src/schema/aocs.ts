/**
 * @file lib/db/src/schema/aocs.ts
 * @description Schema for the **Attestations of Compliance (AoC)** domain of the GRC data model.
 *
 * An Attestation of Compliance (AoC) is the formal certificate issued by a Qualified
 * Security Assessor (QSA) upon successful completion of a PCI DSS assessment.  It
 * confirms that the assessed entity was compliant with the PCI DSS standard as of the
 * assessment period.  Card brands (Visa, Mastercard) and acquiring banks require a
 * valid, current AoC as proof of PCI DSS compliance.
 *
 * Key concepts:
 *  - An AoC is issued per entity, per framework, and covers a specific fiscal period.
 *  - It has an expiry date (typically 12 months after issuance) — once expired, the
 *    entity must complete a new assessment cycle.
 *  - The `status` field tracks whether the AoC is the current live certificate
 *    (`current`), has been replaced by a newer one (`superseded`), or is still
 *    being drafted (`draft`).
 *
 * Relationships:
 *  - Many AoCs → one Entity (via entityCode)
 *  - Many AoCs → one Framework (via frameworkCode)
 *  - Optionally linked to a file stored in the platform (via filename / filePath)
 */

import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * `aocs` table — one row per Attestation of Compliance document.
 */
export const aocsTable = pgTable("aocs", {
  /** UUID primary key. */
  id: text("id").primaryKey(),

  /**
   * Foreign key to `entities.code`.
   * Identifies which merchant entity this AoC was issued for.
   */
  entityCode: text("entity_code").notNull(),

  /**
   * Short code of the framework this AoC attests compliance to (e.g. `"PCI-DSS"`).
   * In practice, most AoCs in this system are PCI DSS AoCs, but the field is
   * framework-agnostic to support future frameworks.
   */
  frameworkCode: text("framework_code").notNull(),

  /** Full framework display name, denormalised for read queries (e.g. "PCI DSS 4.0"). */
  frameworkName: text("framework_name"),

  /** Descriptive title for this AoC record as displayed in the UI, e.g. "PCI DSS AoC – Gopuff FY2025". */
  title: text("title").notNull(),

  /**
   * Lifecycle status of this AoC within the entity's compliance history.
   * - `current`    – the active, valid AoC that satisfies current compliance requirements
   * - `superseded` – replaced by a newer AoC after a subsequent assessment
   * - `draft`      – the assessment is complete but the formal AoC document is not yet signed
   */
  status: text("status").notNull().default("current"), // current|superseded|draft

  /**
   * Name of the QSA (Qualified Security Assessor) firm that conducted the assessment
   * and signed this AoC.  A QSA must be certified by the PCI Security Standards Council.
   */
  qsaCompany: text("qsa_company"),

  /** Name of the lead QSA individual who signed the Attestation of Compliance. */
  qsaLead: text("qsa_lead"),

  /** ISO-8601 date (YYYY-MM-DD) when this AoC was formally issued and signed. */
  issuedDate: text("issued_date"), // YYYY-MM-DD

  /**
   * ISO-8601 date (YYYY-MM-DD) when this AoC expires.
   * PCI DSS AoCs are typically valid for 12 months from the issuance date, after which
   * the entity must complete a new assessment to remain compliant.
   */
  expiresDate: text("expires_date"), // YYYY-MM-DD

  /**
   * Fiscal or assessment period this AoC covers, e.g. `"FY2025"` or `"Q3 2024"`.
   * Provides a human-readable period label separate from the exact date range.
   */
  period: text("period"), // "FY2025"

  /**
   * Overall assessment result or compliance determination, e.g.
   * `"Compliant"`, `"Compliant with CCW"` (Compensating Control Worksheet),
   * or `"Non-Compliant"`.
   */
  result: text("result"),

  /**
   * Number of individual PCI DSS controls (sub-requirements) covered by this assessment.
   * Useful for comparing the scope of successive assessments.
   */
  controlsCovered: integer("controls_covered"),

  /**
   * Count of open findings or exceptions documented in the assessment.
   * A finding of 0 indicates full compliance with no exceptions or CCWs.
   */
  findings: integer("findings"),

  /** Original filename of the uploaded AoC PDF document (e.g. `"gopuff-aoc-fy2025.pdf"`). */
  filename: text("filename"),

  /** Server-side file path or storage key where the AoC document is persisted. */
  filePath: text("file_path"),

  /** Free-text notes about this AoC, such as scope limitations or context about specific findings. */
  notes: text("notes"),

  /** Row creation timestamp, stored with time zone for auditability. */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Zod schema for validating insert payloads.
 * `createdAt` is omitted because the database default handles it automatically.
 */
export const insertAocSchema = createInsertSchema(aocsTable).omit({ createdAt: true });

/** TypeScript type inferred from the insert Zod schema — use for API request bodies. */
export type InsertAoc = z.infer<typeof insertAocSchema>;

/** TypeScript type inferred from the full table select — use for data returned from queries. */
export type Aoc = typeof aocsTable.$inferSelect;
