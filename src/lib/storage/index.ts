import "server-only";
import { env } from "@/lib/env";
import type { StorageDriver } from "./driver";
import { createR2Driver } from "./r2.client";
import { createLocalDriver } from "./local.driver";

let driver: StorageDriver | null = null;

/** R2 in production; the local driver is refused in production. */
export function storage(): StorageDriver {
  if (driver) return driver;
  const e = env();
  const choice = e.STORAGE_DRIVER ?? (e.R2_BUCKET ? "r2" : "local");
  if (choice === "local" && e.NODE_ENV === "production" && !process.env.ALLOW_LOCAL_STORAGE) {
    throw new Error("Local storage is not allowed in production. Configure Cloudflare R2.");
  }
  driver = choice === "r2" ? createR2Driver() : createLocalDriver();
  return driver;
}

export type { StorageDriver } from "./driver";
