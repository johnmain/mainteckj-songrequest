Karaoke Web Portal Development Checklist

Phase 1: Repository & Environment Setup

[ ] Initialize new Git repository for the SvelteKit web portal

[ ] Configure package.json with SvelteKit, TypeScript, and Tailwind CSS (or styling framework of choice)

[ ] Set up environment configuration templates (.env.example) for database and auth keys

[ ] Configure Dockerfile for easy NAS deployment

Phase 2: Database & Master Catalog

[ ] Design database schema for users, profiles, song history, and request queue

[ ] Create an ingestion script/endpoint to accept the distinct master song list export (Title + Artist) from the desktop app

[ ] Implement fast search/query indices for mobile catalog browsing

Phase 3: Authentication & User Management (Better Auth)

[ ] Integrate Better Auth into SvelteKit

[ ] Configure local SQLite/PostgreSQL database adapter for auth sessions

[ ] Set up Google OAuth provider integration

[ ] Set up Apple OAuth provider integration

[ ] Build singer profile and song history view pages

Phase 4: Request & Host Bridge

[ ] Build singer-facing song request submission flow

[ ] Implement local API endpoint / WebSocket client to transmit requests from the NAS portal to the desktop host application

[ ] Test end-to-end request latency over local network / Netbird proxy

Phase 5: Polish & Deployment

[ ] Optimize mobile touch targets and responsive UI layout for venue use

[ ] Run test suite and verify zero-error compilation

[ ] Deploy container to NAS and test live reverse proxy routing via Netbird
