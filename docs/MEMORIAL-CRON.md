# Memorial cron — operations runbook

Daily scheduled task that emails admin + branch_editor recipients before
each upcoming giỗ.

## Endpoint

```
POST /admin/cron/anniversary-alerts
Authorization: Bearer ${CRON_SECRET}
```

Returns JSON:
```json
{ "ok": true, "processed": 1, "sent": 1 }
```

## Required environment variables

Set on the Coolify family app (`Production environment`, both build-time
and runtime are fine):

- `CRON_SECRET` — random ≥32-char hex/base64 string. Generate via
  `openssl rand -hex 32`. The cron caller must send this in the
  `Authorization: Bearer …` header. Constant-time compared on the server.

## Required `family.settings` keys

These are seeded by migration `0017_memorial.sql` but the SMTP-related
keys are not pre-filled — fill them via `/admin/settings`:

- `smtp.host` — e.g. `smtp.gmail.com`, `smtp.zoho.com`, `smtp.resend.com`
- `smtp.port` — `587` (STARTTLS) or `465` (SSL)
- `smtp.user` — SMTP login
- `smtp.password` — SMTP app password
- `smtp.from_email` — `From:` address (must be verified at the provider)
- `site.public_url` — e.g. `https://family.huynhvantuan.net`. Defaults to
  this exact value if absent. Used in `Xem trang tưởng niệm` button URL.
- `memorial.enable` — `true` (default). Set to `false` to disable the
  whole cron.
- `memorial.alert_days_before` — csv of trigger days. Default `7,1,0`.

Recipients are auto-derived from `family.app_users`:
`status = approved AND role IN ('admin', 'branch_editor')`. Each row's
`preferred_lang` (default `vi`) drives the email locale.

## Coolify scheduled task setup

In the family app dashboard → **Scheduled Tasks** → Add new:

- **Name**: `memorial-anniversary-alerts`
- **Schedule**: `0 6 * * *` (every day at 06:00)
- **Timezone**: `Asia/Ho_Chi_Minh`
- **Command**:
  ```
  curl -fsS -X POST \
    -H "Authorization: Bearer ${CRON_SECRET}" \
    https://family.huynhvantuan.net/admin/cron/anniversary-alerts
  ```

If Coolify doesn't expose the `CRON_SECRET` env var inside the scheduled
task shell, replace `${CRON_SECRET}` with the literal value (gitignored
since the task config never lands in the repo).

## Verifying

1. Hit the endpoint manually with the secret to confirm the route is
   reachable and the secret matches.
2. The first run on any given day with no upcoming anniversaries
   returns `{ "ok": true, "processed": 0, "sent": 0 }`. That's normal.
3. Each (member, alert_type, year) is recorded in
   `family.anniversary_alerts` with `UNIQUE` constraint — running the
   cron twice the same day is safe (duplicates skipped).
4. Audit log entry `cron_run / anniversary_alerts` appears under
   `/admin/audit` after each successful run.
5. View past sends at `/admin/memorial/alerts-log`.

## Failure modes

- **SMTP not configured**: `sendMail` falls back to `console.warn` and
  the alert row is NOT inserted, so the cron will retry tomorrow.
- **SMTP send fails (auth/network)**: same as above — error logged,
  no DB row, retry tomorrow.
- **Cron miss (Coolify host down)**: the missed alert will trigger the
  next morning if its trigger day is still ≥0. T-7 missed → T-6 won't
  fire (no trigger), but T-1 and today still will. Admin can manually
  trigger via `/admin/memorial/anniversaries` once that page wires the
  manual button (not yet — defer).

## Notifications cron tasks

- `notifications-retry` — `*/15 * * * *` — re-attempts pending/partial/failed notification rows (max 3 attempts, exp backoff 15m → 1h → 4h)
- `notifications-purge` — `0 3 * * 0` weekly — deletes `status='sent'` rows older than `notifications.retention_days` (default 90), plus expired link tokens. Failed rows kept indefinitely for debug.

Both endpoints share the same `CRON_SECRET` bearer auth as `anniversary-alerts`. Manual trigger:

```bash
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://family.huynhvantuan.net/admin/cron/notifications-retry
```

Coolify scheduled tasks created via API (uuids: `qjs9s00pxkzkr9s01nazaja7` retry, `yjxuaptjlipku45m2mnnwuv8` purge).
