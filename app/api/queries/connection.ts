import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>>;

export function getDb() {
  if (!instance) {
    // "default" (real MySQL, foreign keys enforced) — not "planetscale",
    // which disables FK constraints/cascades to match PlanetScale's serverless
    // MySQL semantics. This app runs against a real local MySQL server.
    instance = drizzle(env.databaseUrl, {
      mode: "default",
      schema: fullSchema,
    });
  }
  return instance;
}
