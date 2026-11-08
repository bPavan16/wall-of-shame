"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicUser, Quote } from "@/lib/types";
import { AddQuoteModal, LoginModal, PasswordModal } from "./Forms";
import QuoteCard from "./QuoteCard";
import { Icon, ThemeToggle } from "./ui";

type Sort = "new" | "old" | "votes";
type Dialog = "login" | "add" | "password" | null;
interface Toast {
  id: number;
  text: string;
  err?: boolean;
}

const SORTS: { key: Sort; label: string }[] = [
  { key: "old", label: "Oldest" },
  { key: "new", label: "Newest" },
  { key: "votes", label: "Most votes" },
];

// Date is filled in after mount so prerendering never depends on the current time.
const cap =(s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function loadVoted(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem("voted") ?? "[]"));
  } catch {
    return new Set();
  }
}

export default function Wall() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [user, setUser] = useState<PublicUser | null>(null);
  const [sort, setSort] = useState<Sort>("old");
  const [speaker, setSpeaker] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [wantsAdd, setWantsAdd] = useState(false);
  const [menu, setMenu] = useState(false);
  const [voted, setVoted] = useState<Set<string>>(loadVoted);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string, err = false) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  useEffect(() => {
    fetch("/api/quotes", { cache: "no-store" })
      .then((r) => r.json())
      .then(setQuotes)
      .catch(() => {
        setQuotes([]);
        toast("Couldn't load the wall. Try refreshing.", true);
      });
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setUser(d.user))
      .catch(() => {});
  }, [toast]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menu]);

  // Per-speaker standings: drives the "Most Wanted" board and the filter chips.
  const standings = useMemo(() => {
    const map = new Map<string, { name: string; count: number; votes: number }>();
    for (const q of quotes ?? []) {
      const s = map.get(q.by) ?? { name: q.by, count: 0, votes: 0 };
      s.count += 1;
      s.votes += q.upvotes;
      map.set(q.by, s);
    }
    return [...map.values()].sort((a, b) => b.votes - a.votes || b.count - a.count || a.name.localeCompare(b.name));
  }, [quotes]);

  const visible = useMemo(() => {
    const list = (quotes ?? []).filter((q) => !speaker || q.by === speaker);
    const byDate = (a: Quote, b: Quote) => b.createdAt.localeCompare(a.createdAt);
    return list.sort((a, b) => {
      if (sort === "old") return byDate(b, a);
      if (sort === "votes") return b.upvotes - a.upvotes || byDate(a, b);
      return byDate(a, b);
    });
  }, [quotes, sort, speaker]);

  const caseNo = useMemo(() => {
    const sorted = [...(quotes ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return new Map(sorted.map((q, i) => [q.id, i + 1]));
  }, [quotes]);

  const ticker = useMemo(() => [...(quotes ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6), [quotes]);
  const totalVotes = (quotes ?? []).reduce((n, q) => n + q.upvotes, 0);
  const maxVotes = Math.max(1, ...standings.map((s) => s.votes));

  function openAdd() {
    if (user) return setDialog("add");
    setWantsAdd(true);
    setDialog("login");
  }

  function focusSpeaker(name: string) {
    setSpeaker(name);
    document.getElementById("archive")?.scrollIntoView({ behavior: "smooth" });
  }

  async function addQuote(text: string, by: string) {
    const res = await fetch("/api/quotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quote: text, by }) });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setUser(null);
      setDialog("login");
      throw new Error("Your session expired. Log in again.");
    }
    if (!res.ok) throw new Error(data.error ?? "Couldn't post that.");
    setQuotes((q) => [...(q ?? []), data]);
    setSpeaker(null);
    setDialog(null);
    toast("Stop the presses. Scandal filed.");
    // keep the chosen sort; just bring the new card into view
    setTimeout(() => document.getElementById(`quote-${data.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
  }

  async function deleteQuote(id: string) {
    setLeaving((s) => new Set(s).add(id));
    const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setLeaving((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
      toast(data.error ?? "Couldn't delete that.", true);
      return;
    }
    setTimeout(() => {
      setQuotes((q) => (q ?? []).filter((x) => x.id !== id));
      setLeaving((s) => {
        const n = new Set(s);
        n.delete(id);
        return n;
      });
    }, 380);
    toast("Story retracted. Evidence destroyed.");
  }

  async function vote(id: string) {
    const had = voted.has(id);
    const delta = had ? -1 : 1;
    const next = new Set(voted);
    if (had) next.delete(id);
    else next.add(id);
    setVoted(next);
    try {
      localStorage.setItem("voted", JSON.stringify([...next]));
    } catch {}
    setQuotes((q) => (q ?? []).map((x) => (x.id === id ? { ...x, upvotes: Math.max(0, x.upvotes + delta) } : x)));
    try {
      const res = await fetch(`/api/quotes/${id}/upvote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ delta }) });
      if (!res.ok) throw new Error();
      const { upvotes } = await res.json();
      setQuotes((q) => (q ?? []).map((x) => (x.id === id ? { ...x, upvotes } : x)));
    } catch {
      setQuotes((q) => (q ?? []).map((x) => (x.id === id ? { ...x, upvotes: Math.max(0, x.upvotes - delta) } : x)));
      setVoted(voted);
      toast("Vote didn't go through.", true);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    toast("Logged out. See you at the next incident.");
  }

  return (
    <>
      <header className="nav">
        <div className="nav-row">
          <a className="brand" href="#top" aria-label="The Wall of Shame, back to top">
            <span className="brand-the">The</span>
            <span className="brand-name">Wall of Shame</span>
          </a>
          <nav className="nav-links" aria-label="Sections">
            <a href="#archive">Archive</a>
            <a href="#most-wanted">Most wanted</a>
          </nav>
          <div className="nav-actions">
            <ThemeToggle />
            {user ? (
              <div className="menu-wrap" onClick={(e) => e.stopPropagation()}>
                <button className="who-chip" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}>
                  <em>{user.name}</em>
                </button>
                {menu && (
                  <div className="menu" role="menu">
                    <div className="tag">{user.role === "admin" ? "Editor-in-chief" : "Staff reporter"}</div>
                    <button
                      onClick={() => {
                        setMenu(false);
                        setDialog("password");
                      }}
                    >
                      <Icon.Key width={16} height={16} /> Change password
                    </button>
                    <button
                      onClick={() => {
                        setMenu(false);
                        logout();
                      }}
                    >
                      <Icon.Out width={16} height={16} /> Log out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="btn" onClick={() => setDialog("login")}>
                <Icon.In width={15} height={15} /> <span className="lbl">Log in</span>
              </button>
            )}
            <button className="btn primary nav-cta" onClick={openAdd}>
              <Icon.Plus width={15} height={15} /> File
            </button>
          </div>
        </div>
        {ticker.length > 0 && (
          <div className="ticker" aria-label="Latest quotes">
            <span className="ticker-tag">Latest</span>
            <div className="ticker-track">
              {[0, 1].map((dup) => (
                <div className="ticker-run" key={dup} aria-hidden={dup === 1}>
                  {ticker.map((q) => (
                    <span key={q.id}>
                      &ldquo;{q.quote}&rdquo; <b>&mdash; {q.by}</b>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </header>

      <main id="top" className="page">
        {/* ───────── Archive ───────── */}
        <section className="section first" id="archive">
          <div className="section-head">
            <h2>The Archive</h2>
            <p>
              {speaker ? (
                <>
                  Showing every quote from <b>{speaker}</b>.{" "}
                  <button className="link" onClick={() => setSpeaker(null)}>
                    Clear filter
                  </button>
                </>
              ) : (
                quotes ? `${quotes.length} ${quotes.length === 1 ? "quote" : "quotes"} on record, ${totalVotes} ${totalVotes === 1 ? "reaction" : "reactions"}.` : "Counting the damage…"
              )}
            </p>
          </div>

          <div className="controls">
            <div className="seg" role="group" aria-label="Sort quotes">
              {SORTS.map((s) => (
                <button key={s.key} aria-pressed={sort === s.key} onClick={() => setSort(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
            {standings.length > 1 && (
              <div className="chips" role="group" aria-label="Filter by speaker">
                <button className="chip" aria-pressed={speaker === null} onClick={() => setSpeaker(null)}>
                  Everyone
                </button>
                {standings.map((s) => (
                  <button key={s.name} className="chip" aria-pressed={speaker === s.name} onClick={() => setSpeaker(speaker === s.name ? null : s.name)}>
                    {s.name} <small>{s.count}</small>
                  </button>
                ))}
              </div>
            )}
          </div>

          {quotes === null ? (
            <div className="grid" aria-busy>
              {Array.from({ length: 6 }, (_, i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="empty">
              <b>No quotes in the archive.</b>
              <p>{speaker ? `${speaker} has been suspiciously quiet.` : "Log in and file the first one."}</p>
              <button className="btn primary" onClick={openAdd}>
                File
              </button>
            </div>
          ) : (
            <div className="grid">
              {visible.map((q, i) => (
                <QuoteCard
                  key={q.id}
                  quote={q}
                  index={i}
                  caseNo={caseNo.get(q.id) ?? 0}
                  voted={voted.has(q.id)}
                  leaving={leaving.has(q.id)}
                  canDelete={!!user && (user.role === "admin" || user.username === q.createdBy)}
                  creatorName={cap(q.createdBy)}
                  onVote={() => vote(q.id)}
                  onDelete={() => deleteQuote(q.id)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ───────── Most wanted ───────── */}
        <section className="section" id="most-wanted">
          <div className="section-head">
            <h2>Most Wanted</h2>
            <p>Ranked by total reactions. Tap an offender to pull their file.</p>
          </div>
          {quotes === null ? (
            <div className="board-skel" aria-busy />
          ) : standings.length === 0 ? (
            <p className="muted">No suspects yet.</p>
          ) : (
            <ol className="board">
              {standings.slice(0, 6).map((s, i) => (
                <li key={s.name} style={{ "--i": i } as React.CSSProperties}>
                  <button onClick={() => focusSpeaker(s.name)} aria-label={`${s.name}: ${s.count} quotes, ${s.votes} reactions. Show their quotes.`}>
                    <span className="rank">{i + 1}</span>
                    <span className="board-name">
                      <b>{s.name}</b>
                      <small>
                        {s.count} {s.count === 1 ? "quote" : "quotes"}
                      </small>
                    </span>
                    <span className="bar" aria-hidden>
                      <i style={{ width: `${Math.max(6, (s.votes / maxVotes) * 100)}%` }} />
                    </span>
                    <span className="board-votes">
                      {s.votes}
                      <small>reactions</small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <footer className="colophon">
          <span>The Wall of Shame</span>
          <span>All quotes verbatim. No retractions unless an editor gets involved.</span>
        </footer>
      </main>

      <button className="btn primary fab" onClick={openAdd}>
        <Icon.Plus width={16} height={16} /> File
      </button>

      {dialog === "login" && (
        <LoginModal
          reason={wantsAdd ? "Only staff can file a scandal. Log in to continue." : undefined}
          onClose={() => {
            setDialog(null);
            setWantsAdd(false);
          }}
          onDone={(u) => {
            setUser(u);
            toast(`Welcome back, ${u.name}.`);
            setDialog(wantsAdd ? "add" : null);
            setWantsAdd(false);
          }}
        />
      )}
      {dialog === "add" && <AddQuoteModal speakers={standings.map((s) => s.name)} onClose={() => setDialog(null)} onDone={addQuote} />}
      {dialog === "password" && (
        <PasswordModal
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            toast("Password updated.");
          }}
        />
      )}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.err ? " err" : ""}`}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}
