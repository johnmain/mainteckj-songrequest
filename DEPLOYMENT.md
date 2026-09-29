# Deploying the Singer Portal (Proxmox + Netbird)

The portal is a single Node (SvelteKit `adapter-node`) container with a SQLite
file on a persistent volume. It is meant to run on a Proxmox guest and be
exposed to singers through Netbird.

```
singer phone ──HTTPS──▶ Netbird address ──▶ reverse proxy ──▶ portal:3000
                                                                 │
                                                                 └─ POST /requests ─▶ desktop host (LAN)
```

---

## 0. Create the GitHub repo & publish the image (once)

From the project directory:

```bash
# with the GitHub CLI (creates the repo, adds the remote, pushes):
gh repo create mainteckj-songrequest --private --source=. --remote=origin --push

# or without gh:
git remote add origin git@github.com:<owner>/mainteckj-songrequest.git
git branch -M main
git push -u origin main
```

The **CI & Publish** workflow (`.github/workflows/ci.yml`) runs the checks and,
on the default branch, builds and pushes the image to GHCR:

```
ghcr.io/<owner>/mainteckj-songrequest:latest
```

GHCR packages default to **private**: either make the package public in your
GitHub _Packages_ settings, or `docker login ghcr.io` on the VM (see §5). Note
the exact image name for the next steps.

---

## 1. Create the Proxmox guest

A **Debian 12 LXC** is the lightest option; a small VM also works.

- **LXC** (recommended): unprivileged, with `nesting=1` and `keyctl=1` so Docker
  can run inside it.
  - 2 vCPU, 1–2 GB RAM, 8–16 GB disk, static LAN IP.
  - Keep the SQLite file on the guest's **local disk** (WAL over NFS/SMB is
    fragile). Back it up to the NAS with the job in §8.
- **VM**: Debian 12/Ubuntu, 2 vCPU, 2 GB RAM, 16 GB disk — simpler Docker
  support, slightly more overhead.

Open only SSH from your admin network; the portal port stays bound to
`127.0.0.1` and is reached through the reverse proxy.

## 2. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker "$USER"   # re-login
```

## 3. Get the compose stack

The image is pulled, so the source is not needed on the VM — but cloning is the
simplest way to get the compose files:

```bash
git clone https://github.com/<owner>/mainteckj-songrequest.git /opt/maintec-kj-portal
cd /opt/maintec-kj-portal
```

Set the image to your package in `.env` (or edit the compose default):

```
PORTAL_IMAGE=ghcr.io/<owner>/mainteckj-songrequest:latest
```

## 4. Configure `.env`

Start from `.env.example` and set, at minimum:

| Variable                                    | Notes                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `ORIGIN`                                    | Public HTTPS URL (the Netbird address) — **must match** what singers visit |
| `DATABASE_URL`                              | `/data/local.db` (inside the container)                                    |
| `BETTER_AUTH_SECRET`                        | `openssl rand -base64 32`                                                  |
| `AUTH_EMAIL_PASSWORD_ENABLED`               | `true` to let singers sign up with email + password                        |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | optional                                                                   |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET`   | optional                                                                   |
| `RESEND_API_KEY` / `EMAIL_FROM`             | optional — enables self-service password reset (see below)                 |
| `HOST_BRIDGE_TOKEN`                         | Shared secret the desktop host uses to poll/update (must match)            |

Register these redirect URIs with each provider (they must use the public
`ORIGIN`):

- `${ORIGIN}/api/auth/callback/google`
- `${ORIGIN}/api/auth/callback/apple`

`AUTH_EMAIL_PASSWORD_ENABLED=true` adds email/password sign-in for singers
without Google/Apple. Set `RESEND_API_KEY` and `EMAIL_FROM` too, and the login
page grows a **Forgot password?** link that emails a reset link (via Resend).
`EMAIL_FROM` must be on a domain verified in Resend. Note there is still **no
email verification at sign-up**, so treat open sign-up as "trusted venue"
unless you also enable verification. Leave `AUTH_EMAIL_PASSWORD_ENABLED=false`
if you only want OAuth.

## 5. Run the stack (CLI)

```bash
# only if the GHCR package is private:
#   echo "$GHCR_PAT" | docker login ghcr.io -u johnmain --password-stdin
docker compose pull
docker compose up -d
docker compose logs -f
```

Compose reads `.env` from the project directory for the `${...}` values, and the
SQLite file goes into the `portal_data` volume (set `PORTAL_DATA` in `.env` to a
host path to bind-mount instead).

To build the image on the VM instead of pulling:

```bash
docker compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
```

The container applies pending migrations on start (`docker/entrypoint.sh`), then
serves on port 3000, published only on `127.0.0.1`. `docker compose ps` should
show the `portal` service as **healthy**.

## 5b. Deploying with Portainer (recommended on a Portainer Docker VM)

The stack is **pull-only** — no build runs on the VM — and reads its settings
from the stack's environment variables.

1. **Registry** — _Registries → Add registry → Custom_:
   - Name `ghcr.io`, URL `ghcr.io`, username `johnmain`,
     password = a PAT with `read:packages`.
   - Skip if you make the package public.

2. **Stack** — _Stacks → Add stack → Repository_:
   - Repository URL: `https://github.com/johnmain/mainteckj-songrequest`
   - Reference: `refs/heads/main`
   - Authentication: **on** — username `johnmain`, password = a PAT with `repo` read
   - Compose path: `docker-compose.yml`

3. **Environment variables** — add these in the stack's _Environment variables_:

   | Variable                       | Value                                             |
   | ------------------------------ | ------------------------------------------------- |
   | `ORIGIN`                       | `https://your-netbird-name`                       |
   | `BETTER_AUTH_SECRET`           | `openssl rand -base64 32`                         |
   | `HOST_BRIDGE_TOKEN`            | shared secret — the same value in the desktop app |
   | `GOOGLE_CLIENT_ID` / `_SECRET` | optional                                          |
   | `APPLE_CLIENT_ID` / `_SECRET`  | optional                                          |
   | `PORTAL_DATA`                  | optional — host path instead of the named volume  |

4. **Deploy the stack.** `portal` should come up **healthy**. Enable _GitOps
   updates_ (polling) to redeploy when CI publishes a new image, or click
   _Update the stack_ with _Re-pull image_ on.

The SQLite file lives in the **`portal_data`** volume; back it up with the
`docker exec` command in §8.

## 6. Expose it through NetBird

Pick one of the two approaches below, then create the Reverse Proxy service.

### Option A — NetBird on the host

Install the client on the guest and join your network:

```bash
curl -fsSL https://pkgs.netbird.io/install.sh | sh
sudo netbird up --setup-key <SETUP_KEY>
```

Then create a **NetBird Reverse Proxy** service (dashboard → Reverse Proxy →
Add service) with a **Peer** target pointing at this VM, protocol HTTP, port
`3000`.

> **Bind address matters.** A NetBird **Peer** target delivers traffic to the
> peer's overlay IP (`100.x`), not loopback, so the published port must not be
> loopback-only: set `PORTAL_BIND=0.0.0.0` in the stack environment (§5b).
> A proxy that dials `127.0.0.1:3000` on this host (`netbird expose 3000`, or a
> local Caddy) works with the default `PORTAL_BIND=127.0.0.1`, but the port is
> then also reachable on the VM's LAN address.

### Option B — NetBird sidecar (default, no host client)

The stack ships a `netbird` service that shares the portal's network namespace,
the same layout the OpenKJ stack used. The peer's `wt0` interface and overlay IP
live inside the portal container, so a **Peer** target reaches `0.0.0.0:3000`
directly while the published host port stays loopback-only.

Just set `NETBIRD_SETUP_KEY` (a reusable key) in the stack's environment and
redeploy — no extra compose file or host install:

```bash
# .env (CLI): NETBIRD_SETUP_KEY=...
docker compose up -d
```

The service needs `NET_ADMIN`, `SYS_ADMIN/SYS_RESOURCE/SYS_MODULE` and
`/dev/net/tun`, all granted in the compose file. The peer registers under the
portal container's hostname — rename it in the dashboard if you like. A stack
redeploy recreates `netbird` alongside `portal`, so it rejoins the new
namespace automatically.

Comment the `netbird` service out of `docker-compose.yml` if you run the
NetBird client on the host instead (Option A).

Either way, `ORIGIN` must equal the public HTTPS URL exactly, and the proxy must
forward `X-Forwarded-For` (or `X-Real-IP`) — the portal uses them for rate
limiting.

## 7. Load the song catalog

The catalog payload is **the same JSON the desktop app already writes for the
song book** via _Export Song List…_ (`[{ "Artist": …, "Title": … }]`) — there is
no separate export format to maintain. The production image does not ship the
dev-only `tsx` CLI, so import through the host-facing endpoint (this is also what
the desktop app's **Sync now** does):

```bash
# karaoke_clean.json is the Song DB export, reused as-is
curl -X POST "$ORIGIN/api/catalog/ingest" \
  -H "Authorization: Bearer $HOST_BRIDGE_TOKEN" \
  -H "Content-Type: application/json" \
  --data @karaoke_clean.json
```

Or, from the desktop app once Phase 11 is built, press **Sync now**.

## 8. Backups

SQLite WAL needs a consistent snapshot. Take an online backup, then copy it out
of the volume:

```bash
docker exec maintec-kj-portal node -e "require('better-sqlite3')('/data/local.db').backup('/data/backup.db')"
docker cp maintec-kj-portal:/data/backup.db "./backup-$(date +%F).db"
docker exec maintec-kj-portal rm -f /data/backup.db
```

(If you set `PORTAL_DATA` to a host path, the snapshot appears there directly.)
Back up the stack's environment/secrets too — via Portainer or `.env`. A nightly
cron/job that copies the snapshot to the NAS is enough.

## 9. Updating

CI publishes a fresh image on every push to the default branch, so updating is a
pull:

```bash
cd /opt/maintec-kj-portal
docker compose pull
docker compose up -d        # migrations run automatically
```

If you build on the VM instead: `git pull && docker compose up -d --build`.

## 10. Troubleshooting

- **502 from the proxy** — check `docker compose logs`; the container binds
  `127.0.0.1:3000`.
- **OAuth redirect mismatch** — `ORIGIN` and the provider's redirect URI must be
  the exact public HTTPS URL.
- **Requests not reaching the host** — the _host_ must reach the portal. Check the
  desktop's Portal URL and **Test** button, and that both sides share the same
  `HOST_BRIDGE_TOKEN`.
- **`/data` permission errors** — the container runs as `node` (uid 1000);
  `chown 1000:1000 data` on the host directory.
