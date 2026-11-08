import { getSessionUser, json, unauthorized } from "@/lib/auth";
import { updateQuotes } from "@/lib/db";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  const { id } = await ctx.params;

  const outcome = await updateQuotes((quotes) => {
    const i = quotes.findIndex((q) => q.id === id);
    if (i === -1) return "missing" as const;
    if (me.role !== "admin" && quotes[i].createdBy !== me.username) return "forbidden" as const;
    quotes.splice(i, 1);
    return "ok" as const;
  });
  if (outcome === "missing") return json({ error: "Quote not found." }, 404);
  if (outcome === "forbidden") return json({ error: "You can only delete quotes you added." }, 403);
  return json({ ok: true });
}
