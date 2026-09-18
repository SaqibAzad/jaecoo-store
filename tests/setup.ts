/**
 * Runs before every test file.
 *
 * Integration tests hit a real Postgres database (jaecoo_test) rather than a
 * mock, because the things most likely to break — money columns, enum values,
 * cascade deletes, unique constraints — only exist in the database. Mocking
 * Prisma would test the mock.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(__dirname, "../.env.test"), override: true });

if (!process.env.DATABASE_URL?.includes("jaecoo_test")) {
  throw new Error(
    `Tests must run against jaecoo_test, but DATABASE_URL is "${process.env.DATABASE_URL}". ` +
      `Refusing to run in case this is the development database.`
  );
}
