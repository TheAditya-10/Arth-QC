import "server-only";
import { env } from "@/lib/env";
import type { StorageDriver } from "./driver";
import { createR2Driver } from "./r2.client";
import { createLocalDriver } from "./local.driver";
import { createDbDriver } from "./db.driver";

let driver: StorageDriver | null = null;

export function storageDriverName(): "r2" | "db" | "local" {
  const e = env();
  return e.STORAGE_DRIVER ?? (e.R2_BUCKET ? "r2" : e.NODE_ENV === "production" ? "db" : "local");
}

/** R2 or Postgres in production; the local disk driver is refused in production. */
export function storage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  const choice = storageDriverName();
  if (choice === "local" && e.NODE_ENV === "production" && !process.env.ALLOW_LOCAL_STORAGE) {
    throw new Error("Local storage is not allowed in production. Configure Cloudflare R2.");
  }
  driver = choice === "r2" ? createR2Driver() : choice === "db" ? createDbDriver() : createLocalDriver();
  return driver;
}

export type { StorageDriver } from "./driver";
