import { json } from "@/lib/auth";
import { updateQuotes } from "@/lib/db";

// Voting is open to everyone; the client remembers which quotes a browser voted on.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const delta = body?.delta === -1 ? -1 : 1;
  const upvotes = await updateQuotes((quotes) => {
    const q = quotes.find((x) => x.id === id);
    if (!q) return null;
    q.upvotes = Math.max(0, q.upvotes + delta);
    return q.upvotes;
  });
  if (upvotes === null) return json({ error: "Quote not found." }, 404);
  return json({ upvotes });
}
