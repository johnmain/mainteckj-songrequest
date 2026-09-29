# Maintec KJ — Singer Portal

Custom, self-hosted SvelteKit singer registration and song-selection portal for the
mobile karaoke / DJ operation. Runs on a NAS, is exposed through the Netbird reverse
proxy, and talks to the C++/QML desktop host over a secure API/WebSocket bridge.

See `AGENT.md` for architecture and `CHECKLIST.md` for the phased roadmap.

## Tech stack

- **SvelteKit** (TypeScript, Vite, Svelte 5 runes)
- **Tailwind CSS v4** for the mobile-first UI
- **Better Auth** for authentication (Google & Apple OAuth)
- **Drizzle ORM + SQLite** (`better-sqlite3`) for persistence
- **Vitest** for unit tests, **ESLint + Prettier** for code quality
- **@sveltejs/adapter-node** + Docker for NAS deployment

## Getting started

```bash
npm install
cp .env.example .env      # then fill in the values
npm run db:migrate        # create/update the SQLite schema
npm run dev
```

### Environment

All secrets live in `.env` (git-ignored). See `.env.example` for the full list:

| Variable                                    | Purpose                                            |
| ------------------------------------------- | -------------------------------------------------- |
| `ORIGIN`                                    | Public portal URL (auth callbacks/cookies)         |
| `DATABASE_URL`                              | Path to the SQLite file                            |
| `BETTER_AUTH_SECRET`                        | Session signing secret (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth credentials                           |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET`   | Sign in with Apple credentials                     |
| `AUTH_EMAIL_PASSWORD_ENABLED`               | Dev-only password login (`true` for local testing) |
| `HOST_BRIDGE_TOKEN`                         | Shared secret for the desktop host bridge (pull)   |

Register these redirect URIs with each provider:

- `${ORIGIN}/api/auth/callback/google`
- `${ORIGIN}/api/auth/callback/apple`

Social providers are only enabled when their credentials are present.

## Singer profile & history (Phase 3)

Authenticated singers get two protected pages:

- **`/profile`** — edits the `singer_profile` record (stage name, phone, bio) via a
  server action with server-side trimming and length validation. Account name and
  avatar come from the OAuth provider and are read-only.
- **`/history`** — a paginated list of performed songs from `song_history`, joined
  with catalog details and ordered newest-first.

The underlying helpers are `upsertProfile`/`getProfile` (`profile/profile.ts`) and
`listSongHistory`/`countSongHistory`/`recordSongHistory` (`history/history.ts`).
`recordSongHistory` is what the host bridge will call when a request is marked played.

## Scripts

| Command                  | Description                               |
| ------------------------ | ----------------------------------------- |
| `npm run dev`            | Start the dev server                      |
| `npm run dev:host`       | Dev server bound to the LAN (for testing) |
| `npm run build`          | Production build (Node adapter)           |
| `npm run preview`        | Preview the production build              |
| `npm run check`          | `svelte-check` type checking              |
| `npm run lint`           | Prettier + ESLint check                   |
| `npm run format`         | Format with Prettier                      |
| `npm test`               | Run the Vitest suite                      |
| `npm run db:generate`    | Generate Drizzle migrations               |
| `npm run db:migrate`     | Apply migrations to the SQLite database   |
| `npm run db:studio`      | Open Drizzle Studio                       |
| `npm run auth:schema`    | Regenerate the Better Auth Drizzle schema |
| `npm run catalog:ingest` | Import a master song export (JSON/CSV)    |
| `npm run mock-host`      | Polling stand-in for the desktop host     |
| `npm run token:generate` | Print a fresh bridge/secret token         |

## Authentication flow

Better Auth is wired into `hooks.server.ts` via `svelteKitHandler`, which serves all
`/api/auth/*` endpoints directly. Sessions are attached to `event.locals` so server
load functions and actions can use them. The `sveltekitCookies` plugin makes cookie
writes work from server actions.

## Catalog & search (Phase 2)

The master catalog lives in the `song` table and is de-duplicated on a normalized
title + artist key (lower-cased, accent/punctuation-stripped), so repeated imports of
the desktop app's export refresh existing rows instead of creating duplicates.
`song_file` holds the per-provider file versions the host chooses from at triage time.

A SQLite **FTS5** index (`song_fts`) is kept in sync by triggers and powers fast
prefix search across title and artist. Search is case- and accent-insensitive and
supports non-Latin titles.

**Ingest an export** — either the CLI:

```bash
npm run catalog:ingest -- path/to/master-songs.csv   # or .json
```

or the host-facing endpoint (requires `HOST_BRIDGE_TOKEN`):

```bash
curl -X POST "$ORIGIN/api/catalog/ingest" \
  -H "Authorization: Bearer $HOST_BRIDGE_TOKEN" \
  -H "Content-Type: application/json" \
  --data '[{"title":"Bohemian Rhapsody","artist":"Queen"}]'
```

Both accept JSON (`[{title, artist}]`, `[[title, artist]]`, or `{ "songs": [...] }`)
and CSV/TSV (`Title,Artist` with an optional header). The response is an
`IngestSummary` (`received`, `imported`, `created`, `updated`, `skipped`).

**Search the catalog** — public endpoint used by mobile browsing:

```
GET /api/catalog/search?q=bohem&sort=artist&limit=20&offset=0
```

`sort` accepts `relevance` (default), `artist`, or `title`. Search is **fuzzy**:
candidates come from the FTS5 prefix index plus indexed substring matches, then are
ranked by character-bigram similarity (Sørensen–Dice), so typos and word variations
still match ("noa kahan" → Noah Kahan). A full-catalog ranking is used as a
typo-tolerant fallback when nothing scores well. The `searchSongs`, `listSongs` and
`getSongById` helpers live in `src/lib/server/catalog/search.ts`.

## Request flow & host bridge (Phase 4)

Authenticated singers search at **`/songs`** and submit a request; it is stored in
`song_request` and awaits the desktop host. Submitting redirects to **`/requests`**
with a confirmation notice, where the singer's requests are listed with live status.

- **Pull, not push:** the host polls `POST /api/host/requests/poll` on a timer with
  `Authorization: Bearer ${HOST_BRIDGE_TOKEN}`. That token is a shared secret you
  generate once (`npm run token:generate`) and set identically here and in the desktop
  app. Each poll returns pending requests **and claims them** (`delivered_at`), so a
  request is handed out exactly once. The portal never needs to reach the host, which
  suits a DJ machine behind NAT. The payload carries the song (id/title/artist), the
  singer's name/stage name, the note and a timestamp.
- **Callbacks:** the host updates progress via
  `PATCH /api/host/requests/:id` with `{ "status": "approved|playing|played|rejected" }`.
  Marking a request `played` records it in the singer's history exactly once.
- **Duplicate guard:** a singer can't queue the same song twice while it is still
  pending/approved/playing.
- **Played/unplayed sync:** the poll response also carries `updates` — played
  toggles the singer made. The host applies each to its queue row (matched by
  `portal_request_id`) and `PATCH`es the result back; the portal shows the host's
  `host_played` state and clears the pending toggle. So a singer can mark a song
  unplayed to sing it again at the next event, or played once they're done.
- **Cancelling:** a request can be deleted from `/requests` while it is pending,
  approved, or rejected, so a singer can change their mind or clear a rejected one.

### Local testing without the karaoke host

1. Set `AUTH_EMAIL_PASSWORD_ENABLED="true"` and `HOST_BRIDGE_TOKEN="dev-bridge-token"`
   in `.env`.
2. Import a catalog: `npm run catalog:ingest -- /path/to/karaoke_clean.json`.
3. Start the mock host poller: `npm run mock-host` (reads `.env`).
4. Start the portal (`npm run dev`), create a local test account on `/login`, then
   search and request songs. The poller logs each claimed request; mark one
   `played` to see it appear under `/history`:

```bash
curl -X PATCH -H "Authorization: Bearer dev-bridge-token" \
  -H "Content-Type: application/json" \
  --data '{"status":"played"}' \
  "$ORIGIN/api/host/requests/<request-id>"
```

### Testing the desktop app's sync over the LAN (plain HTTP)

The desktop host's "Singer Portal" sync talks to `/api/catalog/ingest` and
`/api/health`, which are **not** auth routes — so they work over plain `http://`
regardless of `ORIGIN`. To let another machine reach the dev server:

```bash
npm run dev:host        # vite dev --host — binds to your network
```

Then set the desktop's **Portal URL** to `http://<portal-ip>:5173` (a bare
`host:port` is accepted and defaults to `http`) and the same `HOST_BRIDGE_TOKEN`.
`ORIGIN` only needs to match the browser URL if you are also testing singer
sign-in (OAuth) from a phone.

## Project layout

```
src/
  hooks.server.ts              # session hydration + auth API routing
  lib/
    auth-client.ts             # client-side Better Auth SDK
    config/nav.ts              # portal navigation
    server/
      auth.ts                  # Better Auth configuration (Google/Apple)
      catalog/
        normalize.ts           # text normalization + FTS query builder
        parse.ts               # JSON/CSV master export parser
        ingest.ts              # de-duplicating catalog upsert
        search.ts              # FTS5-backed catalog search
      profile/profile.ts       # singer profile upsert (stage name, phone, bio)
      history/history.ts       # singer song history list/count/record
      requests/
        requests.ts            # request queue CRUD + status transitions
        submitRequest.ts       # create request + deliver to host bridge
      bridge/
        bridgeAuth.ts          # shared-token guard for host endpoints
      db/
        index.ts               # Drizzle SQLite client (uses $env)
        client.ts              # createDb() factory (testable/scriptable)
        testing.ts             # in-memory migrated DB for tests
        schema.ts              # application schema (re-exports auth schema)
        auth.schema.ts         # generated Better Auth tables
  routes/
    +layout.svelte             # mobile-first app shell
    +layout.server.ts          # exposes the current user
    +page.svelte               # landing page
    login/                     # sign-in (OAuth + optional dev password)
    profile/                   # protected singer profile editor + sign out
    history/                   # protected, paginated song history
    songs/                     # protected catalog search + request submission
    requests/                  # protected "My Requests" with delivery status
    api/catalog/ingest/        # host-facing catalog import endpoint
    api/catalog/search/        # public catalog search endpoint
    api/host/requests/poll/    # host poll: claim pending requests (pull)
    api/host/requests/[id]/    # host callback: update request status
drizzle/                       # generated SQL migrations (incl. FTS5 index)
scripts/ingest-catalog.ts      # CLI catalog importer
scripts/mock-host.mjs          # local host poller (pull model)
```

## Deploy

The image is published to GHCR by `.github/workflows/ci.yml`. See
[`DEPLOYMENT.md`](DEPLOYMENT.md) for the full Proxmox + Netbird guide.

```bash
cp .env.example .env        # then fill it in; set PORTAL_IMAGE to your GHCR image
mkdir -p data
docker compose pull
docker compose up -d
```

`docker compose up -d --build` builds locally instead of pulling. The container
applies pending Drizzle migrations on startup (`docker/entrypoint.sh`) and mounts
`./data` at `/data` for the SQLite file, so singer data survives restarts.

An optional Caddy service (compose profile `tls`) terminates HTTPS — enable it
with `docker compose --profile tls up -d` and set `PORTAL_DOMAIN` in `.env`.
