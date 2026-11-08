import { createSession, json, toPublic } from "@/lib/auth";
import { getUsers } from "@/lib/db";
import { verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const username = String(body?.username ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const user = (await getUsers()).find((u) => u.username === username);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return json({ error: "Wrong username or password." }, 401);
  }
  await createSession(user);
  return json({ user: toPublic(user) });
}
