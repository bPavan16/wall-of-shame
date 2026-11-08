import { randomUUID } from "crypto";
import { getSessionUser, json, unauthorized } from "@/lib/auth";
import { getQuotes, updateQuotes } from "@/lib/db";
import type { Quote } from "@/lib/types";

export async function GET() {
  const quotes = await getQuotes();
  return Response.json(quotes, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const me = await getSessionUser();
  if (!me) return unauthorized();
  const body = await req.json().catch(() => null);
  const text = String(body?.quote ?? "").trim();
  const by = String(body?.by ?? "").trim();
  if (!text || !by) return json({ error: "Both the quote and who said it are required." }, 400);
  if (text.length > 400) return json({ error: "Quote is too long (max 400 characters)." }, 400);
  if (by.length > 40) return json({ error: "Speaker name is too long (max 40 characters)." }, 400);

  const quote: Quote = {
    id: randomUUID(),
    quote: text,
    by,
    createdBy: me.username,
    createdAt: new Date().toISOString(),
    upvotes: 0,
  };
  await updateQuotes((quotes) => {
    quotes.push(quote);
  });
  return json(quote, 201);
}
