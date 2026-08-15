/**
 * @file lib/db/src/index.ts
 * @description Database entry-point for the GRC (Governance, Risk & Compliance) platform.
 *
 * ## Responsibilities
 * This module has two jobs:
 *  1. **Bootstrap the PostgreSQL connection** — it creates a `pg.Pool` from the
 *     `DATABASE_URL` environment variable and fails fast (at process startup) if
 *     the variable is absent.
 *  2. **Expose a single import surface** — it re-exports every Drizzle table
 *     definition, Zod insert schema, and TypeScript type from `./schema/index.ts`
 *     so that application code only ever needs one import path:
 *
 * ```ts
 * import {
 *   db,
 *   pool,
 *   evidenceRequestsTable,
 *   insertEvidenceSchema,
 *   type EvidenceRequest,
 *   type InsertEvidence,
 * } from "@repo/db";
 * ```
 *
 * ## Architecture note
 * The full GRC data model is spread across domain-specific schema files
 * (`entities`, `frameworks`, `controls`, `evidence`, `policies`, `aocs`,
 * `assessments`, `vendors`, `activity`) and assembled by the barrel export in
 * `./schema/index.ts`.  This file adds the live Drizzle database client on top
 * of that schema layer.
 *
 * ## Environment variable
 * `DATABASE_URL` must be a valid `libpq`-compatible connection string, e.g.:
 *   `postgres://user:password@host:5432/dbname`
 *
 * The application throws immediately on startup rather than surfacing a cryptic
 * "connection refused" error at query time.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

/**
 * Guard: fail fast at module load time if the database URL is not configured.
 *
 * Without this check a missing `DATABASE_URL` would surface as an opaque
 * PostgreSQL client error on the first query, making it hard to diagnose
 * deployment misconfiguration.
 *
 * @throws {Error} If `process.env.DATABASE_URL` is falsy.
 */
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * Shared `pg` connection pool.
 *
 * A single pool is shared across the entire application to avoid exhausting
 * PostgreSQL's `max_connections` limit.  The pool manages connection lifecycle
 * automatically (acquiring, releasing, and recycling connections as needed).
 *
 * **Graceful shutdown**: callers that need to drain in-flight queries before
 * process exit should call `await pool.end()`.
 *
 * @example
 * ```ts
 * // Graceful shutdown in an Express server
 * process.on("SIGTERM", async () => {
 *   await pool.end();
 *   process.exit(0);
 * });
 * ```
 */
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Drizzle ORM client bound to the shared `pg` connection pool and the full GRC schema.
 *
 * Use this instance for **all** database queries throughout the application.
 * Passing the `schema` object to `drizzle()` enables relational query helpers
 * (e.g. `db.query.evidenceRequestsTable.findMany()`).
 *
 * @example
 * ```ts
 * // Simple select
 * const entities = await db.select().from(entitiesTable);
 *
 * // Filtered insert
 * const [newRequest] = await db
 *   .insert(evidenceRequestsTable)
 *   .values({ id: uuid(), code: "EVR-2026-0001", ... })
 *   .returning();
 *
 * // Relational query (requires schema passed to drizzle())
 * const requests = await db.query.evidenceRequestsTable.findMany({
 *   where: eq(evidenceRequestsTable.entityCode, "gopuff"),
 * });
 * ```
 */
export const db = drizzle(pool, { schema });

/**
 * Re-export every table definition, Zod insert schema, and TypeScript type from
 * the schema layer so consumers never need to import from sub-paths.
 *
 * Exported symbols include (non-exhaustive):
 *  - Table objects:  `entitiesTable`, `frameworksTable`, `controlsTable`,
 *    `evidenceRequestsTable`, `policiesTable`, `aocsTable`,
 *    `assessmentsTable`, `vendorsTable`, `activityLogTable`
 *  - Insert schemas: `insertEntitySchema`, `insertFrameworkSchema`,
 *    `insertControlSchema`, `insertEvidenceSchema`, `insertPolicySchema`,
 *    `insertAocSchema`, `insertAssessmentSchema`, `insertVendorSchema`,
 *    `insertActivitySchema`
 *  - Types:          `Entity`, `InsertEntity`, `Framework`, `InsertFramework`,
 *    `Control`, `InsertControl`, `EvidenceRequest`, `InsertEvidence`,
 *    `Policy`, `InsertPolicy`, `Aoc`, `InsertAoc`, `Assessment`,
 *    `InsertAssessment`, `Vendor`, `InsertVendor`, `ActivityEntry`,
 *    `InsertActivity`
 */
export * from "./schema";
