"use client";

import { useState } from "react";
import type { Quote } from "@/lib/types";
import { Icon } from "./ui";

const DAY = 86400000;

export function ago(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const units: [number, string][] = [[60, "m"], [3600, "h"], [86400, "d"], [604800, "w"], [2629800, "mo"], [31557600, "y"]];
  let out = "just now";
  for (const [size, label] of units) if (s >= size) out = `${Math.floor(s / size)}${label} ago`;
  return out;
}

export function dateline(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
}

/** The kicker stamp is earned, not decorative. */
function stampFor(q: Quote): string {
  if (Date.now() - new Date(q.createdAt).getTime() < DAY) return "Breaking";
  if (q.upvotes >= 5) return "Exclusive";
  return "On record";
}

interface Props {
  quote: Quote;
  index: number;
  caseNo: number;
  voted: boolean;
  leaving: boolean;
  canDelete: boolean;
  creatorName: string;
  onVote: () => void;
  onDelete: () => void;
}

export default function QuoteCard({ quote, index, caseNo, voted, leaving, canDelete, creatorName, onVote, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [bump, setBump] = useState(0);
  const stamp = stampFor(quote);

  function vote() {
    setBump((b) => b + 1);
    onVote();
  }

  return (
    <article id={`quote-${quote.id}`} className={`clip${leaving ? " leaving" : ""}`} data-hot={stamp !== "On record"} style={{ "--i": Math.min(index, 10) } as React.CSSProperties}>
      <header className="clip-head">
        <span className="case-no">No. {String(caseNo).padStart(3, "0")}</span>
        <span className={`stamp ${stamp === "Breaking" ? "hot" : ""}`}>{stamp}</span>
        <time dateTime={quote.createdAt} suppressHydrationWarning>
          {dateline(quote.createdAt)}
        </time>
      </header>
      <blockquote className={`clip-quote${quote.quote.length <= 60 ? " short" : quote.quote.length > 150 ? " long" : ""}`}>&ldquo;{quote.quote}&rdquo;</blockquote>
      <footer className="clip-foot">
        <div className="byline">
          <b>&mdash; {quote.by}</b>
          <span suppressHydrationWarning>
            Filed by {creatorName} · {ago(quote.createdAt)}
          </span>
        </div>
        {canDelete &&
          (confirming ? (
            <button className="tool confirm" onClick={onDelete} onBlur={() => setConfirming(false)} autoFocus>
              Retract?
            </button>
          ) : (
            <button className="tool" onClick={() => setConfirming(true)} aria-label="Delete quote" title="Delete">
              <Icon.Trash width={15} height={15} />
            </button>
          ))}
        <button className="react" aria-pressed={voted} onClick={vote} aria-label={voted ? "Remove reaction" : "React"}>
          <Icon.Flame width={16} height={16} />
          <span className={`count${bump ? " bump" : ""}`} key={bump}>
            {quote.upvotes}
          </span>
        </button>
      </footer>
    </article>
  );
}
