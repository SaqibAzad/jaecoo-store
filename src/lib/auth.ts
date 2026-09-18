import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";

/**
 * Admin authentication.
 *
 * Deliberately small: one admin account, a scrypt password hash in the
 * database, and a signed session cookie. No third-party auth service, because
 * the only thing being protected is a single-operator back office.
 *
 * Passwords are never stored or logged in plaintext, and never live in the
 * repository — the seed reads them from the environment.
 */

const COOKIE = "jaecoo_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12; // a working day

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short (needs 32+ characters). " +
        "Generate one with: openssl rand -hex 32"
    );
  }
  return s;
}

// ---------------------------------------------------------------- passwords

/** scrypt with a per-password salt, stored as "salt:hash". */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false, which would leak through an exception.
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

// ---------------------------------------------------------------- sessions

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Token is `email.expiry.signature` — signed, not encrypted. */
export function createToken(email: string): string {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${Buffer.from(email).toString("base64url")}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function readToken(token: string | undefined): { email: string } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [emailB64, expiresRaw, signature] = parts;
  const payload = `${emailB64}.${expiresRaw}`;

  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || Date.now() > expires) return null;

  return { email: Buffer.from(emailB64, "base64url").toString() };
}

// ---------------------------------------------------------------- session io

export async function startSession(email: string) {
  const jar = await cookies();
  jar.set(COOKIE, createToken(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** The signed-in admin, or null. `cookies()` is async in Next 16. */
export async function currentAdmin() {
  const jar = await cookies();
  const session = readToken(jar.get(COOKIE)?.value);
  if (!session) return null;
  return db.adminUser.findUnique({
    where: { email: session.email },
    select: { id: true, email: true, name: true },
  });
}

/** Check an email/password pair against the database. */
export async function authenticate(email: string, password: string) {
  const user = await db.adminUser.findUnique({
    where: { email: email.trim().toLowerCase() },
  });
  // Hash anyway when the user is missing, so a wrong email and a wrong
  // password take the same time and cannot be told apart.
  const stored = user?.passwordHash ?? `${"0".repeat(32)}:${"0".repeat(128)}`;
  const ok = verifyPassword(password, stored);
  return ok && user ? user : null;
}

export const SESSION_COOKIE = COOKIE;
