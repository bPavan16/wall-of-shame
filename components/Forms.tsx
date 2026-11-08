"use client";

import { useState, type FormEvent } from "react";
import type { PublicUser } from "@/lib/types";
import { Modal } from "./ui";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

function useSubmit(action: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }
  return { busy, error, submit };
}

export function LoginModal({ onClose, onDone, reason }: { onClose: () => void; onDone: (u: PublicUser) => void; reason?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { busy, error, submit } = useSubmit(async () => {
    const { user } = await post("/api/auth/login", { username, password });
    onDone(user);
  });
  return (
    <Modal title="Staff login" sub={reason ?? "Only crew members can add or delete quotes. Reading is free for everyone."} onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field">
          <span>Username</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus required />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? "Checking…" : "Let me in"}
        </button>
      </form>
    </Modal>
  );
}

export function AddQuoteModal({ speakers, onClose, onDone }: { speakers: string[]; onClose: () => void; onDone: (text: string, by: string) => Promise<void> }) {
  const [quote, setQuote] = useState("");
  const [by, setBy] = useState("");
  const { busy, error, submit } = useSubmit(() => onDone(quote.trim(), by.trim()));
  return (
    <Modal title="File a scandal" sub="Verbatim only. No editing, no context, no mercy." onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field">
          <span>
            The quote <small>{quote.length}/400</small>
          </span>
          <textarea className="input" value={quote} onChange={(e) => setQuote(e.target.value)} maxLength={400} placeholder="I thought a vegan was someone from Vegas…" autoFocus required />
        </label>
        <label className="field">
          <span>Who said it?</span>
          <input className="input" value={by} onChange={(e) => setBy(e.target.value)} maxLength={40} placeholder="The culprit" required />
        </label>
        {speakers.length > 0 && (
          <div className="suggest">
            {speakers.slice(0, 8).map((s) => (
              <button type="button" className="chip" key={s} onClick={() => setBy(s)} aria-pressed={by === s}>
                {s}
              </button>
            ))}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? "Posting…" : "Send to print"}
        </button>
      </form>
    </Modal>
  );
}

export function PasswordModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const { busy, error, submit } = useSubmit(async () => {
    if (next !== again) throw new Error("New passwords don't match.");
    await post("/api/auth/password", { current, next });
    onDone();
  });
  return (
    <Modal title="Change password" sub="Enter your current password first. Other devices will be signed out." onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field">
          <span>Current password</span>
          <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus required />
        </label>
        <label className="field">
          <span>
            New password <small>min 6 characters</small>
          </span>
          <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={6} required />
        </label>
        <label className="field">
          <span>Repeat new password</span>
          <input className="input" type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" minLength={6} required />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary block" disabled={busy}>
          {busy ? "Saving…" : "Update password"}
        </button>
      </form>
    </Modal>
  );
}
