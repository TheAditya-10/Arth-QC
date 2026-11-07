import "server-only";
import { drizzle as drizzleNeon, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import ws from "ws";
import * as schema from "./schema";
import { requireEnv } from "@/lib/env";

export type DB = NeonDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | Tx;

declare global {
  var __arthDb: DB | undefined;
}

function create(): DB {
  const url = requireEnv("DATABASE_URL");
  if (/\.neon\.tech|neon\.build/.test(url)) {
    // Neon's WebSocket pool supports interactive transactions.
    neonConfig.webSocketConstructor = ws;
    const pool = new NeonPool({ connectionString: url, max: 5 });
    return drizzleNeon({ client: pool, schema });
  }
  // Standard Postgres (local development / CI). Same query API.
  const pool = new PgPool({ connectionString: url, max: 5 });
  return drizzlePg({ client: pool, schema }) as unknown as DB;
}

/** Lazily-created singleton (survives hot reload in development). */
export function db(): DB {
  if (!globalThis.__arthDb) globalThis.__arthDb = create();
  return globalThis.__arthDb;
}

export { schema };
