import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * DATABASE_URL is read defensively rather than with prisma's `env()` helper,
 * which throws when the variable is absent.
 *
 * `prisma generate` only emits TypeScript types and never opens a connection,
 * but it still loads this file — so on Vercel, where `npm install` runs before
 * environment variables are injected, a throwing config fails the whole install.
 * Commands that genuinely need the database (migrate, studio) still fail loudly
 * on an empty URL, which is the correct behaviour.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
