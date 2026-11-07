import { customType, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/** Object storage inside Postgres (STORAGE_DRIVER=db) — for small deployments without R2. */
export const storedObjects = pgTable(
  "stored_objects",
  {
    key: text("key").primaryKey(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stored_objects_created_idx").on(t.createdAt)],
);
