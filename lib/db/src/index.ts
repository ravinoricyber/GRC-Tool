/**
 * @file lib/db/src/index.ts
 * @description Database entry-point for the GRC (Governance, Risk & Compliance) platform.
 *
 * This module bootstraps the PostgreSQL connection pool and the Drizzle ORM client,
 * then re-exports every schema symbol (tables, insert schemas, and TypeScript types)
 * so that application code only needs a single import path:
 *
 *   import { db, evidenceRequestsTable, type EvidenceRequest } from "@repo/db";
 *
 * The full GRC data model is spread across domain-specific schema files and assembled
 * by the barrel export in `./schema/index.ts`.  This file adds the live database
 * connection on top of that schema layer.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Fail fast at startup if the connection string is absent rather than producing
// cryptic runtime errors on the first query.
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/** Shared `pg` connection pool.  Exported so callers can manage lifecycle (e.g. graceful shutdown). */
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Drizzle ORM client bound to the shared connection pool and the full GRC schema.
 * Use this for all database queries throughout the application.
 */
export const db = drizzle(pool, { schema });

// Re-export every table definition, Zod insert schema, and TypeScript type from
// the schema layer so consumers never need to import from sub-paths.
export * from "./schema";
