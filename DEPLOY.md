# Deploy

This site deploys to **Coolify** (self-hosted PaaS) at
`https://coolify.huynhvantuan.net`, served behind a Cloudflare Tunnel that
points at the Coolify Traefik proxy on the host machine.

The full Coolify operations manual lives in the internal wiki:
**`/tech/coolify`** (http://192.168.100.125:3080/en/tech/coolify). What
follows is the project-specific runbook.

---

## Pipeline

```
git push main
   │
   ▼
GitHub Actions (.github/workflows/ci.yml)
   │  • pnpm install --frozen-lockfile
   │  • pnpm build           # astro check + astro build
   │  • pnpm check:privacy   # verifies no contact-field leak
   │  • curl COOLIFY_WEBHOOK with bearer COOLIFY_TOKEN
   ▼
Coolify
   │  • git pull main
   │  • docker build .         (multi-stage Dockerfile)
   │  • container swap (zero-downtime)
   │  • Traefik picks up new labels (Host=family.huynhvantuan.net)
   ▼
Cloudflare Tunnel → host:80 → Traefik → container
   ▼
https://family.huynhvantuan.net
```

## Coolify application

| Field | Value |
|---|---|
| Project | `Family` (uuid `umidjdc882i2adtorxwp3pxm`) |
| App name | `family` (uuid `x12pnqywbdwg5gqudhb4j5tj`) |
| Server | `localhost` (uuid `ba53gqlmi88i268mw0zx9okw`) |
| Build pack | `dockerfile` |
| Repository | `https://github.com/hvtuan/family.git` |
| Branch | `main` |
| Ports exposes | `80` |
| FQDN | `http://family.huynhvantuan.net` (Cloudflare terminates TLS) |
| Healthcheck | `GET /` (configured by Dockerfile HEALTHCHECK) |

## GitHub secrets

Set in `https://github.com/hvtuan/family/settings/secrets/actions`:

| Name | Description |
|---|---|
| `COOLIFY_WEBHOOK` | `https://coolify.huynhvantuan.net/api/v1/deploy?uuid=<app-uuid>&force=false` |
| `COOLIFY_TOKEN` | Coolify API token, scope `deploy` only |

If a secret is missing, the workflow logs a `::warning::` and continues with
exit 0 — build is verified but no deploy is triggered. **Don't put production
secrets into a `deploy` token; create a dedicated one for GHA.**

## Cloudflare Tunnel

| Hostname | Service |
|---|---|
| `family.huynhvantuan.net` | `http://localhost:80` |

Traefik routes by Host header. Adding another app under Coolify only needs a
new Cloudflare Tunnel hostname pointing at the same `localhost:80` — no proxy
or DNS changes elsewhere.

## Local Docker test

```bash
docker build -t family:test .
docker run --rm -p 18080:80 family:test
curl -I http://localhost:18080/   # 200, X-Frame-Options: DENY, ...
```

## Manual deploy from CLI

If GHA is broken or you want to redeploy without a commit:

```bash
curl -fsS \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "https://coolify.huynhvantuan.net/api/v1/deploy?uuid=x12pnqywbdwg5gqudhb4j5tj&force=true"
```

`force=true` rebuilds even when the commit hash hasn't changed.

## Common failure modes

| Symptom | Cause | Fix |
|---|---|---|
| GHA `Coolify deploy skipped` warning | secret missing | set both secrets |
| GHA curl 401 | token revoked or wrong scope | regenerate `COOLIFY_TOKEN` |
| GHA curl 404 | webhook UUID stale (app deleted/recreated) | update `COOLIFY_WEBHOOK` |
| Deploy succeeds but `family.huynhvantuan.net` returns 404 | container labels stale (Traefik missed update) | trigger redeploy with `force=true` |
| Build fails on `sharp` (Astro Image) | Alpine missing libc | already fixed in Dockerfile (`apk add libc6-compat`) |
| `pnpm check:privacy` fails on PR | a private-contact value leaked into the bundle | check the listed file/field; if member should be public, set `contactPublic: true` in frontmatter |

## Rollback

The container that was running before the latest deploy stays in Docker until
the next docker prune. To roll back:

1. In Coolify panel → app `family` → tab **Deployments** → click **Restore**
   on a previous successful deployment, or
2. `git revert <bad-sha> && git push` — re-runs the pipeline with the
   reverted commit, building a new image without the bad changes.

## Where things live

- Coolify proxy compose (manually patched to keep dashboard off port 8080):
  `/data/coolify/proxy/docker-compose.yml` (`.bak` retained)
- Coolify data dir: `/data/coolify` → symlinked to `/home/coolify-data`
- Cloudflare Tunnel ID: `04a82d9a-4953-455c-bf37-3e6e77fd0fe1` (shared with
  Pterodactyl + Coolify panel)
- App build logs: Coolify panel → app `family` → **Deployments** tab
- Container logs: `docker logs $(docker ps --format '{{.Names}}' | grep x12pn)`
