import "server-only";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { get, put } from "@vercel/blob";
import type { Quote, UserRecord } from "./types";

/**
 * JSON storage.
 *  - Seed files live in /data (committed to git).
 *  - Local dev: reads/writes /data directly.
 *  - Vercel + BLOB_READ_WRITE_TOKEN: the JSON files are stored in a private
 *    Vercel Blob store (the Vercel filesystem is read-only, so this is what
 *    makes writes persist). Missing blobs are seeded from /data.
 *  - Vercel without a token: falls back to /tmp (works, but is NOT durable).
 */
const SEED_DIR = path.join(process.cwd(), "data");
const useBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
const WRITE_DIR = process.env.VERCEL ? path.join(os.tmpdir(), "wall-of-shame") : SEED_DIR;

async function readFileJson<T>(dir: string, name: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, name), "utf8")) as T;
  } catch {
    return null;
  }
}

async function readJson<T>(name: string): Promise<T> {
  if (useBlob) {
    const res = await get(name, { access: "private", useCache: false });
    if (res && res.stream) {
      return JSON.parse(await new Response(res.stream).text()) as T;
    }
    const seed = await readFileJson<T>(SEED_DIR, name);
    if (!seed) throw new Error(`Missing seed file data/${name}`);
    await writeJson(name, seed);
    return seed;
  }
  const current = await readFileJson<T>(WRITE_DIR, name);
  if (current) return current;
  const seed = await readFileJson<T>(SEED_DIR, name);
  if (!seed) throw new Error(`Missing seed file data/${name}`);
  return seed;
}

async function writeJson(name: string, data: unknown): Promise<void> {
  const body = JSON.stringify(data, null, 2) + "\n";
  if (useBlob) {
    await put(name, body, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }
  await fs.mkdir(WRITE_DIR, { recursive: true });
  await fs.writeFile(path.join(WRITE_DIR, name), body, "utf8");
}

// Serialise read-modify-write cycles within one server instance.
let queue: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

export const getUsers = () => readJson<UserRecord[]>("users.json");
export const getQuotes = () => readJson<Quote[]>("quotes.json");

export function updateUsers<T>(fn: (users: UserRecord[]) => T | Promise<T>): Promise<T> {
  return locked(async () => {
    const users = await getUsers();
    const result = await fn(users);
    await writeJson("users.json", users);
    return result;
  });
}

export function updateQuotes<T>(fn: (quotes: Quote[]) => T | Promise<T>): Promise<T> {
  return locked(async () => {
    const quotes = await getQuotes();
    const result = await fn(quotes);
    await writeJson("quotes.json", quotes);
    return result;
  });
}
