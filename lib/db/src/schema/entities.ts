/**
 * @file lib/db/src/schema/entities.ts
 * @description Schema for the **Entities** domain of the GRC data model.
 *
 * ## What is an Entity?
 * An "entity" in this system represents a distinct legal merchant (business unit)
 * that operates within the Gopuff family of brands and carries its **own**
 * compliance obligations — chiefly under PCI DSS.  Because each brand may have
 * different card-processing channels, terminal environments, and acquiring bank
 * relationships, they each receive a separate PCI DSS scoping exercise,
 * separate evidence requests, and separate Attestations of Compliance.
 *
 * Current entities:
 *  - `gopuff`      – Gopuff (parent rapid-delivery brand, primarily e-commerce)
 *  - `bevmo`       – BevMo! (retail alcohol chain with physical card-present terminals)
 *  - `liquorbarn`  – Liquor Barn (regional retail chain with physical card-present terminals)
 *
 * ## PCI DSS relevance
 * The `merchantLevel`, `saqType`, and `cdeScope` columns are the three key
 * PCI DSS intake fields.  They determine the **assessment pathway** the entity
 * must follow:
 *  - **Merchant Level** (Requirement 3.3.x / card-brand rules): sets whether a
 *    QSA on-site ROC, a SAQ, or a reduced-scope assessment is required.
 *  - **SAQ type**: narrows which PCI DSS requirements are in scope (e.g. SAQ-A
 *    merchants only need to answer ~22 questions vs. SAQ-D which covers all 250+).
 *  - **CDE scope**: defines the technical and physical boundary within which
 *    cardholder data (PANs, CVVs, track data) flows.
 *
 * ## Relationships
 *  - One entity → many Controls     (via `controls.entityCode`)
 *  - One entity → many EvidenceRequests (via `evidenceRequests.entityCode`)
 *  - One entity → many Assessments  (via `assessments.entityCode`)
 *  - One entity → many Aocs         (via `aocs.entityCode`)
 *  - Referenced by Policies and Vendors through their `entities[]` array columns
 */

import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Table definition
// ---------------------------------------------------------------------------

/**
 * `entities` table — one row per legal merchant / business unit.
 *
 * The primary key (`code`) is a short alphanumeric slug rather than a UUID
 * because it doubles as a human-readable foreign key used throughout the schema
 * (e.g. `evidenceRequests.entityCode = "gopuff"`).  This keeps SQL joins
 * readable during incident investigation and makes seed data easy to author.
 */
export const entitiesTable = pgTable("entities", {
  /**
   * Short, URL-safe identifier used as a **foreign key** throughout the schema.
   *
   * - Constraints: primary key, text, not null (implicit for PK).
   * - Examples: `"gopuff"`, `"bevmo"`, `"liquorbarn"`.
   * - Used as FK in: `controls.entityCode`, `evidenceRequests.entityCode`,
   *   `assessments.entityCode`, `aocs.entityCode`, `vendors.entities[]`,
   *   `policies.entities[]`, `activity_log.entityCode`.
   */
  code: text("code").primaryKey(), // gopuff | bevmo | liquorbarn

  /**
   * Human-readable brand / trade name shown in the UI.
   *
   * - Constraints: not null.
   * - Examples: `"Gopuff"`, `"BevMo!"`, `"Liquor Barn"`.
   * - Displayed in page headings, dropdowns, and report labels.
   */
  name: text("name").notNull(),

  /**
   * Full legal entity name as it appears on compliance filings and contracts.
   *
   * - Constraints: not null.
   * - Examples: `"Go Puff, Inc."`, `"BevMo! Inc."`.
   * - Used on AoC documents, vendor agreements, and ROC cover pages.
   */
  legalName: text("legal_name").notNull(),

  /**
   * PCI DSS merchant level (1–4) assigned by the card brands (Visa / Mastercard).
   *
   * - Constraints: nullable (may be unknown / not yet classified).
   * - Domain values:
   *   - `"1"` — > 6 million Visa / Mastercard transactions per year; requires
   *             on-site QSA assessment and annual ROC.
   *   - `"2"` — 1–6 million transactions; requires annual SAQ and quarterly scans.
   *   - `"3"` — 20,000–1 million e-commerce transactions; requires annual SAQ.
   *   - `"4"` — < 20,000 e-commerce or any merchant up to 1 million transactions;
   *             SAQ recommended, exact requirements set by acquirer.
   * - Stored as text (not integer) to accommodate labels like `"Level 1"`.
   */
  merchantLevel: text("merchant_level"),

  /**
   * Self-Assessment Questionnaire type applicable to this entity.
   *
   * - Constraints: nullable (Level-1 merchants typically file a ROC, not an SAQ).
   * - Common values: `"SAQ-A"`, `"SAQ-A-EP"`, `"SAQ-B"`, `"SAQ-B-IP"`,
   *   `"SAQ-C"`, `"SAQ-C-VT"`, `"SAQ-D"`, `"SAQ-P2PE"`.
   * - The SAQ type is determined by the entity's card-data flow:
   *   - **SAQ-A**: card-not-present merchants that fully outsource all cardholder
   *     data functions (e.g. iframe-based checkout).
   *   - **SAQ-D**: merchants that don't qualify for a reduced SAQ — covers all
   *     PCI DSS requirements.
   * - Understanding the SAQ type is essential for correctly scoping which
   *   controls are in scope for an assessment.
   */
  saqType: text("saq_type"),

  /**
   * Description or boundary of the entity's Cardholder Data Environment (CDE).
   *
   * - Constraints: nullable (populated during initial scoping).
   * - The CDE is defined by PCI DSS as: all system components, people, and
   *   processes that store, process, or transmit cardholder data (CHD) or
   *   sensitive authentication data (SAD), plus any systems connected to them.
   * - This free-text field documents the technical boundary used by the QSA
   *   to determine which systems, networks, and processes fall within scope.
   * - Accurate CDE documentation is the foundation of every PCI DSS assessment.
   */
  cdeScope: text("cde_scope"),

  /**
   * ISO-8601 date (YYYY-MM-DD) of the most recently issued Attestation of
   * Compliance (AoC) for this entity.
   *
   * - Constraints: nullable (new entities will not yet have an AoC).
   * - Used by the dashboard to show "days since last AoC" and compliance status.
   * - Denormalised here for quick status queries; the canonical AoC record is in
   *   the `aocs` table.
   */
  lastAocDate: text("last_aoc_date"), // YYYY-MM-DD string

  /**
   * ISO-8601 date (YYYY-MM-DD) when the next AoC must be filed to maintain
   * compliance status.
   *
   * - Constraints: nullable.
   * - Card brands revoke "compliant" status if a renewal AoC is not submitted
   *   within 12 months of the previous one; this field drives renewal alerts.
   */
  nextAocDate: text("next_aoc_date"), // YYYY-MM-DD string

  /**
   * Name of the Qualified Security Assessor (QSA) company engaged by this entity.
   *
   * - Constraints: nullable (entities conducting internal assessments may have none).
   * - A QSA is a firm certified by the PCI Security Standards Council (PCI SSC)
   *   to perform PCI DSS audits, test controls, and countersign AoCs / ROCs.
   * - Examples: `"Verizon Business"`, `"Coalfire"`, `"Trustwave"`.
   */
  qsaCompany: text("qsa_company"),

  /**
   * Soft-delete flag.
   *
   * - Constraints: not null, defaults to `true`.
   * - Inactive entities (`false`) are hidden from all active UI views but their
   *   historical records (controls, evidence, AoCs) are preserved for audit trail
   *   and regulatory retention purposes.
   * - Do NOT hard-delete entity rows; use this flag instead.
   */
  isActive: boolean("is_active").notNull().default(true),

  /**
   * Row creation timestamp, stored with time zone.
   *
   * - Constraints: not null, defaults to `now()` at insert time.
   * - Stored with time zone to avoid ambiguity across server regions.
   * - Immutable after insert — never update this column.
   */
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// Zod insert schema
// ---------------------------------------------------------------------------

/**
 * Zod schema for validating `entities` insert payloads sent via the API.
 *
 * **Generated from** `entitiesTable` by `drizzle-zod`'s `createInsertSchema`,
 * which maps each Drizzle column type to the appropriate Zod validator:
 *  - `text` columns → `z.string()`
 *  - `boolean` columns → `z.boolean()`, with the Drizzle default (`true`) applied
 *    automatically when the field is omitted.
 *  - `timestamp` columns → omitted (see below).
 *
 * **Required fields** (not null, no default beyond what the caller must provide):
 *  - `code`      — entity slug (primary key)
 *  - `name`      — display name
 *  - `legalName` — legal name
 *
 * **Optional fields** (nullable or have defaults):
 *  - `merchantLevel`, `saqType`, `cdeScope`, `lastAocDate`, `nextAocDate`,
 *    `qsaCompany` — nullable, may be omitted or passed as `null`.
 *  - `isActive` — defaults to `true` if omitted.
 *
 * **Omitted fields**:
 *  - `createdAt` — handled by the database `defaultNow()`, never sent by the client.
 *
 * @example
 * ```ts
 * const payload = insertEntitySchema.parse({
 *   code: "newbrand",
 *   name: "New Brand",
 *   legalName: "New Brand, LLC",
 *   merchantLevel: "2",
 *   saqType: "SAQ-D",
 * });
 * await db.insert(entitiesTable).values(payload);
 * ```
 */
export const insertEntitySchema = createInsertSchema(entitiesTable).omit({ createdAt: true });

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

/**
 * `InsertEntity` — shape of the object required to insert a new entity row.
 *
 * Inferred from `insertEntitySchema` (the Zod insert schema).
 *
 * **Usage**: API request body validation, seed data files, form handlers.
 *
 * @example
 * ```ts
 * const body: InsertEntity = await req.json();
 * const validated = insertEntitySchema.parse(body);
 * ```
 */
export type InsertEntity = z.infer<typeof insertEntitySchema>;

/**
 * `Entity` — full shape of a row returned by a SELECT on `entitiesTable`.
 *
 * Inferred from the Drizzle table definition via `$inferSelect`, so it always
 * reflects the actual column set (including `createdAt` and all nullable fields).
 *
 * **Usage**: API response types, component props, any code that reads entity data.
 *
 * @example
 * ```ts
 * const entities: Entity[] = await db.select().from(entitiesTable);
 * const active = entities.filter((e) => e.isActive);
 * ```
 */
export type Entity = typeof entitiesTable.$inferSelect;
