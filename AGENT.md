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

Autonomous Agent Guidelines (for OpenCode / DeepSeek)

Test-Driven Development: Write unit tests for API routes, database schemas, and Svelte component logic before finalizing code patches.

Iterative Refinement: If a build error, type mismatch, or auth token bug occurs, parse the error logs and iterate autonomously until assertions pass.

Preserve Security: Ensure user credentials, database secrets, and Netbird communication keys are strictly managed via environment variables (.env).
