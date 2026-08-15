/**
 * @file lib/db/src/schema/index.ts
 * @description Barrel re-export for the entire GRC database schema.
 *
 * Each sub-module covers a distinct domain in the Governance, Risk & Compliance
 * data model.  They are assembled here so that application code and the Drizzle
 * client can consume a single import surface:
 *
 *  • entities    – Legal business units (merchants) subject to compliance obligations
 *  • frameworks  – Regulatory/security frameworks (PCI DSS, SOC 2, ISO 27001 …)
 *  • controls    – Individual requirements drawn from a framework
 *  • evidence    – Evidence requests created during assessments
 *  • policies    – Internal policy documents mapped to frameworks and entities
 *  • aocs        – Attestations of Compliance issued by a QSA after a PCI assessment
 *  • assessments – Formal assessment engagements (fieldwork cycles)
 *  • vendors     – Third-party service providers with CDE or compliance relevance
 *  • activity    – Immutable audit log of user actions across the platform
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
