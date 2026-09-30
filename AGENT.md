Karaoke Portal Agent Instructions

Project Overview

This repository contains the custom SvelteKit-based singer registration and song-selection web portal for the karaoke application. It runs on a NAS/Server environment, is exposed via a Netbird reverse proxy, handles user authentication (Google OAuth plus optional email/password via Better Auth), and communicates with the local C++/QML desktop karaoke host machine via a secure pull-based HTTP bridge.

Architecture & Tech Stack

Frontend: SvelteKit (Fast, lightweight, mobile-optimized UI for singers).

Authentication: Better Auth (Self-hosted user management, profiles, history, social logins).

Database: SQLite / PostgreSQL (Stores master song catalog sync, user profiles, singer histories, and incoming request queues).

Communication Bridge: REST endpoints or WebSockets connecting the NAS portal to the local desktop app host.

Core Workflows

Catalog Sync: The web app consumes a de-duplicated master song list (Title + Artist) exported from the desktop karaoke app.

Singer Request Flow: Authenticated singers search the master list, select a song, and submit a request.

Host Triage: Requests land in a staging queue on the desktop app, where the host sees all available provider file versions and selects the optimal file to add to the rotation.

Host Bridge Endpoints (authenticated with `HOST_BRIDGE_TOKEN`)

- `POST /api/host/requests/poll` — the desktop host's pull/heartbeat. Claims pending
  requests and returns `{ count, requests, updates, removals }`; the `X-Accepting`
  header carries the host's "accepting requests" toggle. `removals` lists requests
  the singer deleted (`pending_removal`).
- `PATCH /api/host/requests/{id}` — host reports `approved | playing | played | rejected`,
  or `removed` to acknowledge a singer deletion (which deletes the request).
- `POST /api/catalog/ingest` — host pushes the master song export (`[{ Artist, Title }]`).
- `GET /api/host/singers` — portal account directory (`{ singers: [{ id, name, stageName }] }`),
  used by the desktop app to show whether a singer exists in the Request DB.
- `POST /api/host/queue/push` — full reconcile of one singer's queue:
  body `{ singerName, songs: [{ title, artist, played }] }`. Queued songs are created
  as `approved`/delivered requests; active requests whose song is no longer queued are
  removed (played/rejected history is untouched). Returns
  `requests: [{ title, artist, requestId }]` so the host can write the ids back onto
  its queue rows (empty on a `dryRun`). `404` unknown singer, `409` ambiguous.

Public endpoints

- `GET /api/status` — CORS-enabled `{ accepting, hostSeenAt, updatedAt }` the marketing
  site checks (GET only; a form POST is rejected by CSRF).
- `GET /api/health` — liveness probe.

Autonomous Agent Guidelines (for OpenCode / DeepSeek)

Test-Driven Development: Write unit tests for API routes, database schemas, and Svelte component logic before finalizing code patches.

Iterative Refinement: If a build error, type mismatch, or auth token bug occurs, parse the error logs and iterate autonomously until assertions pass.

Preserve Security: Ensure user credentials, database secrets, and Netbird communication keys are strictly managed via environment variables (.env).
