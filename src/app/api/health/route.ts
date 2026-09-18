import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Configuration health check.
 *
 * Reports only whether each piece is configured — never a value, never a
 * fragment of a secret. Exists because a missing environment variable on a
 * hosting platform otherwise surfaces as an opaque "server error" page with
 * no way to tell which variable is at fault.
 */
export async function GET() {
  const checks: Record<string, string> = {};

  const secret = process.env.SESSION_SECRET;
  checks.sessionSecret = !secret
    ? "MISSING — admin sign-in will fail"
    : secret.length < 32
      ? `TOO SHORT (${secret.length} chars, needs 32+) — admin sign-in will fail`
      : "ok";

  checks.databaseUrl = process.env.DATABASE_URL ? "ok" : "MISSING";

  try {
    const [products, admins] = await Promise.all([
      db.product.count(),
      db.adminUser.count(),
    ]);
    checks.database = "ok";
    checks.products = String(products);
    checks.adminAccounts = admins > 0 ? String(admins) : "NONE — nobody can sign in";
  } catch (e) {
    checks.database = `FAILED — ${e instanceof Error ? e.message.slice(0, 120) : "unknown"}`;
  }

  const healthy = Object.entries(checks).every(
    ([, v]) => !v.includes("MISSING") && !v.includes("FAILED") && !v.includes("TOO SHORT") && !v.includes("NONE")
  );

  return NextResponse.json({ healthy, checks }, { status: healthy ? 200 : 503 });
}
