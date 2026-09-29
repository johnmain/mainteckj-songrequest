Karaoke Web Portal Development Checklist

Phase 1: Repository & Environment Setup

- [x] Initialize new Git repository for the SvelteKit web portal
- [x] Configure package.json with SvelteKit, TypeScript, and Tailwind CSS
- [x] Set up environment configuration templates (.env.example) for database and auth keys
- [x] Configure Dockerfile for easy NAS deployment

Phase 2: Database & Master Catalog

- [x] Design database schema for users, profiles, song history, and request queue
- [x] Create an ingestion endpoint to accept the distinct master song list export (Title + Artist)
- [x] Implement fast search/query indices for mobile catalog browsing (FTS5 + fuzzy ranking)

Phase 3: Authentication & User Management (Better Auth)

- [x] Integrate Better Auth into SvelteKit
- [x] Configure the SQLite database adapter for auth sessions
- [x] Set up Google OAuth provider integration
- [x] Email + password sign-in (`AUTH_EMAIL_PASSWORD_ENABLED`)
- [x] Email verification at sign-up and self-service password reset (via Resend)
- [x] Host-side password reset script (`docker/reset-password.mjs`)
- [x] Build singer profile and song history view pages

Phase 4: Request & Host Bridge

- [x] Build singer-facing song request submission flow
- [x] Implement the pull-based host bridge (desktop polls the portal)
- [x] Sync played/unplayed state between the portal and the desktop queue
- [x] Live "accepting requests" toggle surfaced via the public `GET /api/status`
- [x] Host push of one singer's app queue into the Request DB (`POST /api/host/queue/push`)
- [x] Portal singer directory for the app's "is this singer in the Request DB?" indicator (`GET /api/host/singers`)
- [x] Test end-to-end request flow over the Netbird reverse proxy

Phase 5: Polish & Deployment

- [x] Optimize mobile touch targets and responsive UI layout for venue use
- [x] Run test suite and verify zero-error compilation
- [x] Deploy the container and test live reverse-proxy routing via Netbird (`DEPLOYMENT.md`)
  - [x] Provision the Docker guest (Proxmox) + Netbird
  - [x] Configure env (`ORIGIN`, secrets, Google redirect URI, host bridge)
  - [x] Deploy the stack and confirm migrations run on start
  - [x] Expose via the Netbird reverse proxy with TLS (bundled Netbird sidecar peer)
  - [x] Load the catalog from the desktop Song DB export via `POST /api/catalog/ingest`
  - [x] Configure the desktop bridge (portal URL + `HOST_BRIDGE_TOKEN`) and the Accepting toggle
  - [x] Verify the end-to-end flow from a phone over Netbird

Phase 6: Operations (hard-won notes)

- [x] `BODY_SIZE_LIMIT=16M` — adapter-node's 512 KB default rejects the multi-MB catalog ingest (413)
- [x] `ORIGIN` must equal the public URL exactly — it drives CSRF, cookies and OAuth callbacks
      (any mismatch yields a `403` on every form post, which surfaces as a JSON.parse error in the browser)
- [x] `/api/status` is public and CORS-enabled; the marketing site must call it with **GET**
      (a form POST is rejected by SvelteKit's CSRF protection)
- [x] SQLite runs in WAL mode — watch `local.db-wal` while importing; the ingest commits in batches of 200
- [x] Backups: online snapshot of `/data/local.db` (`DEPLOYMENT.md` §8)
