/**
 * @file lib/db/src/schema/index.ts
 * @description Barrel re-export for the entire GRC database schema.
 *
 * ## Purpose
 * Each sub-module covers a distinct domain in the Governance, Risk & Compliance
 * (GRC) data model.  They are assembled here so that both the Drizzle ORM client
 * (in `lib/db/src/index.ts`) and application code can import from a single,
 * stable surface.
 *
 * ## Domain overview
 *
 * | Sub-module    | Domain description                                                         |
 * |---------------|----------------------------------------------------------------------------|
 * | `entities`    | Legal business units (merchants) that carry independent compliance scope   |
 * | `frameworks`  | Regulatory / industry-standard programmes (PCI DSS, SOC 2, ISO 27001 …)  |
 * | `controls`    | Individual requirements drawn from a framework, tested during assessments  |
 * | `evidence`    | Evidence requests raised to gather audit artefacts for specific controls   |
 * | `policies`    | Internal policy documents mapped to frameworks and entities                |
 * | `aocs`        | Attestations of Compliance issued by a QSA after a PCI assessment          |
 * | `assessments` | Formal assessment engagements (fieldwork cycles tied to entities)          |
 * | `vendors`     | Third-party service providers with CDE or compliance relevance (TPSP list) |
 * | `activity`    | Immutable audit log of user actions across the platform (PCI DSS Req 10)   |
 *
 * ## Import pattern
 * ```ts
 * // Preferred — import everything from the top-level package entry point:
 * import { entitiesTable, type Entity } from "@repo/db";
 *
 * // Alternative — import directly from the schema barrel (within the db lib):
 * import { controlsTable, type Control } from "./schema";
 * ```
 *
 * ## Naming conventions
 * - **Table objects**:  `<domain>Table`         e.g. `evidenceRequestsTable`
 * - **Insert schemas**: `insert<Domain>Schema`  e.g. `insertEvidenceSchema`
 * - **Select types**:   `<Domain>`              e.g. `EvidenceRequest`
 * - **Insert types**:   `Insert<Domain>`        e.g. `InsertEvidence`
 */

export * from "./entities";
export * from "./frameworks";
export * from "./controls";
export * from "./evidence";
export * from "./policies";
export * from "./aocs";
export * from "./assessments";
export * from "./vendors";
export * from "./activity";
