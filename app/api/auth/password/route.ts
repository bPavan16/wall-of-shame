import { createSession, getSessionUser, json, unauthorized } from "@/lib/auth";
import { updateUsers } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  const body = await req.json().catch(() => null);
  const current = String(body?.current ?? "");
  const next = String(body?.next ?? "");
  if (next.length < 6) return json({ error: "New password must be at least 6 characters." }, 400);
  if (next === current) return json({ error: "New password must be different." }, 400);

  const result = await updateUsers((users) => {
    const user = users.find((u) => u.username === me.username);
    if (!user || !verifyPassword(current, user.passwordHash)) return null;
    user.passwordHash = hashPassword(next);
    return user;
  });
  if (!result) return json({ error: "Current password is incorrect." }, 403);
  await createSession(result); // keep this device signed in
  return json({ ok: true });
}
