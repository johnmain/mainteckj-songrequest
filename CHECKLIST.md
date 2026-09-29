Karaoke Web Portal Development Checklist

Phase 1: Repository & Environment Setup

- [x] Initialize new Git repository for the SvelteKit web portal
- [x] Configure package.json with SvelteKit, TypeScript, and Tailwind CSS (or styling framework of choice)
- [x] Set up environment configuration templates (.env.example) for database and auth keys
- [x] Configure Dockerfile for easy NAS deployment

Phase 2: Database & Master Catalog

- [x] Design database schema for users, profiles, song history, and request queue
- [x] Create an ingestion script/endpoint to accept the distinct master song list export (Title + Artist) from the desktop app
- [x] Implement fast search/query indices for mobile catalog browsing

Phase 3: Authentication & User Management (Better Auth)

- [x] Integrate Better Auth into SvelteKit
- [x] Configure local SQLite/PostgreSQL database adapter for auth sessions
- [x] Set up Google OAuth provider integration
- [x] Set up Apple OAuth provider integration
- [x] Build singer profile and song history view pages

Phase 4: Request & Host Bridge

- [x] Build singer-facing song request submission flow
- [x] Implement local API endpoint / WebSocket client to transmit requests from the NAS portal to the desktop host application
- [ ] Test end-to-end request latency over local network / Netbird proxy

Phase 5: Polish & Deployment

- [x] Optimize mobile touch targets and responsive UI layout for venue use
- [x] Run test suite and verify zero-error compilation
- [ ] Deploy container to a Proxmox guest and test live reverse proxy routing via Netbird (see `DEPLOYMENT.md`)
  - [ ] Create the Debian 12 LXC/VM guest and install Docker
  - [ ] Configure `.env` (`ORIGIN`, secrets, OAuth redirect URIs, host bridge)
  - [ ] `docker compose up -d --build` and confirm migrations run on start
  - [ ] Join Netbird and expose via ingress / reverse proxy with TLS
  - [ ] Load the catalog from the desktop **Song DB export** via `POST /api/catalog/ingest`
  - [ ] Configure SQLite backups and the desktop bridge (`HOST_BRIDGE_URL` / `HOST_BRIDGE_TOKEN`)
  - [ ] Verify end-to-end request latency from a phone over Netbird
