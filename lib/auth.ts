import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getUsers } from "./db";
import type { PublicUser, UserRecord } from "./types";

const COOKIE = "wos_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET env var is required in production");
  }
  return "dev-only-secret-change-me";
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

// The password hash fragment is baked into the token, so changing a password
// signs out every other device.
const fingerprint = (u: UserRecord) => u.passwordHash.slice(-12);

export function toPublic(u: UserRecord): PublicUser {
  return { username: u.username, name: u.name, role: u.role };
}

export async function createSession(user: UserRecord): Promise<void> {
  const payload = Buffer.from(
    JSON.stringify({ u: user.username, f: fingerprint(user), exp: Date.now() + MAX_AGE * 1000 }),
  ).toString("base64url");
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** Returns the full user record for the current request, or null. */
export async function getSessionUser(): Promise<UserRecord | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { u, f, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof exp !== "number" || exp < Date.now()) return null;
    const user = (await getUsers()).find((x) => x.username === u);
    return user && fingerprint(user) === f ? user : null;
  } catch {
    return null;
  }
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const unauthorized = () => json({ error: "Please log in first." }, 401);
