# Wall of Shame

A mobile-first wall of the dumbest things your group has said. Anyone can read and upvote; logging in is needed to add or delete quotes.

## Run locally

Works on Node 22+.

```bash
npm install
npm run dev
```

Locally, quotes and users are read from and written to `data/quotes.json` and `data/users.json`.

## Accounts

Seeded in `data/users.json` (passwords are stored as scrypt hashes).

| Username | Password |
| --- | --- |
| `pavan`, `harish`, `anirudh`, `varun`, `samarth`, `narendra` | `shame123` |
| `admin` | `admin123` |

Rename the members by editing `username` / `name` in `data/users.json` **before the first deploy**. To change a default password, generate a hash with `hashPassword` from `lib/password.ts` and paste it into the `passwordHash` field.

- Members can delete their own quotes. The admin can delete any quote.
- Everyone can change their password from the profile menu (requires the current password).

## Deploy to Vercel

Vercel's filesystem is read-only, so writes are stored in a private **Vercel Blob** store as the same JSON files (seeded from `data/` on first use).

1. Push to GitHub and import the repo in Vercel.
2. Project > Storage > create a **Blob** store and connect it. This sets `BLOB_READ_WRITE_TOKEN`.
3. Add the env var `SESSION_SECRET` (any long random string, e.g. `openssl rand -hex 32`).
4. Deploy.

Without the Blob store the app still runs, but writes go to `/tmp` and are lost on cold starts.

## Data shape

`quotes.json`: `{ id, quote, by, createdBy, createdAt, upvotes }`
# wall-of-shame
