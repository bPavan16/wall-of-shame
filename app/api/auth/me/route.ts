import { getSessionUser, json, toPublic } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  return json({ user: user ? toPublic(user) : null });
}
