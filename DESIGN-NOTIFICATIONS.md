# DESIGN — Notification System

**Status:** brainstorm complete (2026-05-08), implementation pending
**Predecessors:** `DESIGN.md`, `DESIGN-PHASE-2-ADMIN.md`, `DESIGN-MEDIA-V2.md`, `DESIGN-MEMORIAL.md`
**Approach:** A — Lean inline + JSONB prefs (Approach 1 of 3 evaluated)
**Effort estimate:** Phase 1 ~6 dev-days (N1-N3 + N5), Phase 2 +2 days (N4 chat apps)

---

## 1. Understanding Lock

### What
Hệ thống thông báo đa kênh (email + in-app + web push + chat apps) với per-user preferences và profile cá nhân. Memorial cron + future events route qua đây.

### Why
- Email-only fragile (deliverability + cô chú không xài email thường)
- VN context: **Zalo dominant**, sau Messenger, email ít dùng cho cá nhân
- User control = trust; opt-in/opt-out per channel + per event
- Profile foundation: avatar, display name, timezone, notification prefs

### Who
- **Phase 1 audience**: app_users hiện tại (admin / branch_editor / editor) — 5-10 cô chú
- **Defer**: extended family member registration công khai

### Channels — full landscape

| ChannelId | Audience VN | Phase | Adapter status |
|---|---|---|---|
| `email` | All | 1 ✅ | live (memorial M5) |
| `in_app` | Admin login users | 1 | live |
| `web_push` | Browser users | 1 | live (VAPID + Service Worker) |
| `zalo` | Đa số cô chú VN | 2 | stub Phase 1 → real Phase 2 |
| `telegram` | Tech / dev users | 2 | stub → real Phase 2 |
| `messenger` | FB users | 3 | stub (cần FB Business) |
| `whatsapp` | Quốc tế / một số VN | 3 | stub (cần Meta Business) |
| `sms` | Critical fallback | 3 | stub (eSMS / Twilio) |

8 channels declared trong types từ ngày đầu — UI profile show all, Phase 2/3 hiển thị "Sắp ra mắt" badge cho đến khi adapter swap thật.

### Event types

| Event | Recipient pool | Default channels |
|---|---|---|
| `anniversary.t-7` | admin + branch_editor cùng branch | email + in_app |
| `anniversary.t-1` | admin + branch_editor cùng branch | email + in_app + web_push + zalo |
| `anniversary.today` | admin + branch_editor cùng branch | email + in_app + web_push + zalo · **critical** |
| `condolence.pending` | admin only | in_app |
| `member.added` | all approved app_users | in_app |
| `system.welcome` | new approved user | email + in_app |
| `system.weekly_digest` | opted-in users | email |

### Constraints
- Astro 6 SSR + React islands + shadcn + Supabase
- Tech naming EN, content VN (per project convention)
- i18n-ready (event copy → message catalog)
- Lib over hand-roll (per `feedback_prefer_proven_libs`)
- No PII leak in JSON payload (only IDs + minimal context)
- Per-user preferences immutable across deploys (no column rename without migration)
- Quiet hours respected (delay non-critical)
- Admin can disable per-event globally qua settings
- **Tuyệt đối không chữ Hán** trong UI/asset/payload

### Non-goals (defer)
- ❌ Public visitor accounts / unsubscribe pages
- ❌ Marketing emails / newsletters / promotional
- ❌ Mobile native push (no app)
- ❌ Realtime websocket presence
- ❌ Notification template editor UI for admin
- ❌ A/B testing copy variants
- ❌ Slack / Discord channels

### Non-functional requirements

| Aspect | Target |
|---|---|
| Latency event→delivered | < 2s in-app, < 30s email |
| Scale | ≤ 50 users, ~100 events/day peak |
| Reliability | At-least-once email; retry exp backoff 3x; web push fire-and-forget |
| Privacy | IP/PII not in notifications JSON; channel addresses encrypted-at-rest (Postgres) |
| Maintenance | Channel adapter interface; new channel = 1 file ≤ 200 LOC |
| A11y | Bell icon keyboard nav; aria-live for new notifications |

---

## 2. Decision Log

| # | Decision | Alternatives | Why |
|---|---|---|---|
| ND1 | Approach A — lean inline | B normalized + queue, C event sourcing | Match scale (≤50 users), zero new infra, leverage memorial patterns |
| ND2 | Preferences JSONB on `app_users` | Normalized 2-table | Schema evolves via app code; <50 users → JSON path query OK |
| ND3 | Delivery inline sync | pg-boss queue | <500ms per event, cron-driven, no worker process needed |
| ND4 | Retry via cron `*/15 * * * *` | In-process setInterval, queue lib | Same Coolify pattern as memorial |
| ND5 | Channel adapters as TS modules | Plugin / dynamic loading | YAGNI; static registry enough |
| ND6 | `web-push` lib (VAPID) | OneSignal / Pusher / FCM | Free, browser-native, no vendor |
| ND7 | Zalo OA REST direct | Zalo SDK | No official Node SDK with active maintenance |
| ND8 | In-app bell polls 30s | Supabase Realtime websocket | Polling sufficient; cheap indexed query |
| ND9 | 90-day notification retention | Forever / 30d | Privacy + table size; failed rows kept forever for debug |
| ND10 | Avatar in Supabase storage | Gravatar | Self-host, leverage `family-photos/avatars/` pattern |
| ND11 | 8 channels declared upfront | Phase-by-phase types | Schema + UI stable; Phase 2/3 chỉ swap stub `send()` |
| ND12 | Channel-specific link state in `prefs.channels[id]` (user_id, chat_id, phone…) | Separate table per channel | Nested JSONB scope per-channel |
| ND13 | `ChannelAdapter` có `beginLink`/`completeLink` từ ngày đầu | Phase 2 mới thêm | OAuth + deep-link flow defined upfront |
| ND14 | UI badge "Sắp ra mắt" cho `comingSoon=true` | Hide channel | Set expectation; UI không phá khi enable thật |
| ND15 | `events.anniversary.*` default include `zalo` | Only Phase 1 channels | Audience VN; tự kích hoạt khi user link Zalo |
| ND16 | Per-channel libs + thin orchestrator (~150 LOC) | Novu, Knock, hand-roll all | Ops cost > benefit cho ≤50 users |
| ND17 | `web-push` cho Web Push | OneSignal, FCM | Standard VAPID, no vendor |
| ND18 | `grammy` cho Telegram (Phase 2) | `node-telegram-bot-api` | Modern TS-first, conversation API |
| ND19 | REST direct cho Zalo / Messenger / WhatsApp | Various unmaintained SDKs | No good Node SDK |
| ND20 | `async-retry` cho retry helper | Custom exp backoff | Standard pattern, lib over hand-roll |
| ND21 | KHÔNG dùng Novu | — | Heavyweight ops (Redis + MongoDB), lock-in |
| ND22 | Defer `pg-boss` queue | Use immediately | Cron-driven retry đủ; add khi >100 users |

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EVENT SOURCES                                    │
│  Memorial cron · Admin actions · Trigger functions · System events      │
└────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ dispatch(eventType, recipientIds, payload)
┌────────────────────────────────────────────────────────────────────────┐
│                       LIB ORCHESTRATOR                                  │
│  src/lib/notifications/                                                 │
│    types · events · preferences · dispatcher · retry · seen · purge    │
└────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ resolveChannels(prefs, eventType)
┌────────────────────────────────────────────────────────────────────────┐
│                       CHANNEL ADAPTERS (8)                              │
│  email · in_app · web_push · zalo · telegram · messenger · whatsapp · sms │
│  (Phase 1: email/in_app/web_push live; Phase 2/3: stubs)                │
└────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ insert + update
┌────────────────────────────────────────────────────────────────────────┐
│                    SUPABASE (family schema)                             │
│  notifications · web_push_subscriptions · notification_link_tokens     │
│  app_users.{avatar_url, timezone, notification_preferences}            │
│  settings (notifications.* keys)                                        │
└────────────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴────────────────┐
              ▼                                ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│   PUBLIC SURFACE         │    │   ADMIN SURFACE          │
│  Service Worker push    │    │  /admin/profile (3 tabs)  │
│  (browser → SW → tray)  │    │  /admin/notifications     │
│                          │    │  <NotificationBell>       │
└──────────────────────────┘    └──────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL                                             │
│  SMTP · VAPID push services · Zalo OA · Telegram bot · Coolify cron    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database schema

Migration `supabase/migrations/0018_notifications.sql`:

```sql
-- 1. Outbound notification log + queue
create table family.notifications (
  id                  bigserial primary key,
  user_id             uuid not null references family.app_users(id) on delete cascade,
  event_type          text not null,
  payload             jsonb not null default '{}'::jsonb,
  status              text not null default 'pending'
                       check (status in ('pending','sending','sent','partial','failed','seen')),
  channels_requested  text[] not null default '{}',
  channels_delivered  text[] not null default '{}',
  channels_failed     text[] not null default '{}',
  attempt_count       integer not null default 0,
  last_error          text,
  next_retry_at       timestamptz,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  seen_at             timestamptz
);
create index notif_user_unseen_idx on family.notifications (user_id, seen_at)
  where seen_at is null;
create index notif_status_retry_idx on family.notifications (status, next_retry_at)
  where status in ('pending','partial','failed');
create index notif_user_recent_idx on family.notifications (user_id, created_at desc);

-- 2. Web push subscriptions
create table family.web_push_subscriptions (
  id          bigserial primary key,
  user_id     uuid not null references family.app_users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_user_idx on family.web_push_subscriptions (user_id);

-- 3. Link token table (for chat channel deep-link / OAuth)
create table family.notification_link_tokens (
  token       text primary key,
  user_id     uuid not null references family.app_users(id) on delete cascade,
  channel_id  text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz
);
create index link_token_user_channel_idx on family.notification_link_tokens (user_id, channel_id);

-- 4. Profile extensions on app_users
alter table family.app_users
  add column if not exists avatar_url text,
  add column if not exists timezone text default 'Asia/Ho_Chi_Minh',
  add column if not exists notification_preferences jsonb
    not null default '{
      "channels": {
        "email":     { "enabled": true },
        "in_app":    { "enabled": true },
        "web_push":  { "enabled": false },
        "zalo":      { "enabled": false, "user_id": null, "phone": null },
        "telegram":  { "enabled": false, "chat_id": null, "username": null },
        "messenger": { "enabled": false, "psid": null },
        "whatsapp":  { "enabled": false, "phone": null },
        "sms":       { "enabled": false, "phone": null }
      },
      "events": {
        "anniversary.t-7":    ["email","in_app"],
        "anniversary.t-1":    ["email","in_app","web_push","zalo"],
        "anniversary.today":  ["email","in_app","web_push","zalo"],
        "condolence.pending": ["in_app"],
        "member.added":       ["in_app"],
        "system.welcome":     ["email","in_app"]
      },
      "quiet_hours": { "enabled": false, "from": "22:00", "to": "07:00" }
    }'::jsonb;

create index app_users_pref_gin_idx on family.app_users using gin (notification_preferences);

-- 5. Settings keys
insert into family.settings (key, value, category, description, field_type, sort_order) values
  ('notifications.enable',                 'true', 'memorial', 'Master switch toàn hệ thống thông báo', 'boolean', 100),
  ('notifications.retention_days',         '90',   'memorial', 'Số ngày giữ thông báo trước khi tự xoá', 'number', 110),
  ('notifications.web_push_vapid_public',  '',     'memorial', 'VAPID public key', 'text', 120),
  ('notifications.web_push_vapid_private', '',     'memorial', 'VAPID private key', 'password', 121),
  ('notifications.zalo_oa_token',          '',     'memorial', 'Zalo OA access token (Phase 2)', 'password', 130),
  ('notifications.zalo_oa_id',             '',     'memorial', 'Zalo OA ID (Phase 2)', 'text', 131),
  ('notifications.telegram_bot_token',     '',     'memorial', 'Telegram bot token (Phase 2)', 'password', 140),
  ('notifications.telegram_bot_username',  '',     'memorial', 'Telegram bot @username (Phase 2)', 'text', 141),
  ('notifications.messenger_page_token',   '',     'memorial', 'FB Messenger Page Access Token (Phase 3)', 'password', 150),
  ('notifications.messenger_page_id',      '',     'memorial', 'FB Messenger Page ID (Phase 3)', 'text', 151),
  ('notifications.whatsapp_token',         '',     'memorial', 'WhatsApp Business token (Phase 3)', 'password', 160),
  ('notifications.whatsapp_phone_id',      '',     'memorial', 'WhatsApp phone number ID (Phase 3)', 'text', 161),
  ('notifications.sms_provider',           'none', 'memorial', 'SMS provider', 'select:none,esms,twilio', 170),
  ('notifications.sms_api_key',            '',     'memorial', 'SMS API key (Phase 3)', 'password', 171)
on conflict (key) do nothing;
```

---

## 5. Lib layer

### File structure

```
src/lib/notifications/
├── types.ts          ChannelId, EventType union, Notification row shape, Preferences zod schema
├── events.ts         registry: id → { defaultChannels, payloadSchema, render(channel), critical, subject }
├── preferences.ts    getPreferences, updatePreferences, resolveChannels, isInQuietHours
├── dispatcher.ts     dispatch({ eventType, recipientIds, payload, forceChannels? })
├── retry.ts          processPendingRetries() — called by */15 cron
├── seen.ts           markSeen, getUnseenCount
└── purge.ts          purgeOldNotifications(days) — weekly cron

src/lib/channels/
├── types.ts          ChannelAdapter interface
├── registry.ts       { email, in_app, web_push, zalo, telegram, messenger, whatsapp, sms }
├── email.ts          ✅ Phase 1
├── in_app.ts         ✅ Phase 1
├── web_push.ts       ✅ Phase 1 (web-push lib + VAPID)
├── zalo.ts           🟡 stub Phase 1, real Phase 2
├── telegram.ts       🟡 stub Phase 1, real Phase 2 (grammy)
├── messenger.ts      🟡 stub
├── whatsapp.ts       🟡 stub
└── sms.ts            🟡 stub
```

### Key types

```ts
export type ChannelId =
  | "email" | "in_app" | "web_push" | "zalo"
  | "telegram" | "messenger" | "whatsapp" | "sms";

export type EventType =
  | "anniversary.t-7" | "anniversary.t-1" | "anniversary.today"
  | "condolence.pending" | "member.added"
  | "system.welcome" | "system.weekly_digest";

export interface ChannelAdapter {
  id: ChannelId;
  comingSoon?: boolean;
  setupGuideUrl?: string;
  isReady(): Promise<boolean>;
  isAvailableFor(user: AppUserRow): Promise<boolean>;
  beginLink?(user: AppUserRow): Promise<{ kind: "url" | "code" | "deeplink"; value: string }>;
  completeLink?(user: AppUserRow, payload: Record<string, unknown>): Promise<{ ok: boolean }>;
  send(notification: NotificationRow, user: AppUserRow): Promise<{ ok: boolean; error?: string }>;
}
```

### Dispatcher flow

```
dispatch(eventType, recipientIds, payload)
  ├─ check master switch settings.notifications.enable
  ├─ for each userId:
  │    user = await getAppUser(userId)
  │    prefs = parsePrefs(user.notification_preferences)
  │    channels = resolveChannels(prefs, eventType)
  │    if channels.empty: skip
  │    insert family.notifications row (status='sending')
  │    if isInQuietHours(prefs) && !event.critical:
  │      status='pending', next_retry_at=endOfQuietWindow
  │      continue
  │    deliverNotification(row, user)
  │      for each channel: adapter.send → track delivered/failed
  │      update status (sent / partial / failed) + next_retry_at (exp backoff)
  └─ return { enqueued, sentInline }
```

### Retry strategy

`processPendingRetries()` triggered by Coolify cron `*/15 * * * *`:
1. Query `where status in ('pending','partial','failed') and next_retry_at <= now() and attempt_count < 3` LIMIT 100
2. Re-attempt only `channels_failed`
3. Exp backoff: 15min → 1h → 4h → mark `failed` permanent

### Quiet hours

Per-user `prefs.quiet_hours = { enabled, from, to }` resolved trong `user.timezone`. Bypass cho `event.critical=true`. Cross-midnight ranges handled (vd 23:00-07:00). End-of-window scheduling: `next_retry_at = today 07:00 in user TZ` if `now < 07:00`, else `tomorrow 07:00`.

---

## 6. Channel adapters

### email.ts (Phase 1)

Reuse `src/lib/email.ts` (memorial M5). Adapter wraps `sendEmail()` với template từ `EVENTS[eventType].render(payload, user, "email")` returning React element.

### in_app.ts (Phase 1)

No-op send: row đã insert vào `family.notifications`. Bell polls DB, dropdown reads recent. `isAvailableFor()` always true (mặc định prefs enable in_app).

### web_push.ts (Phase 1)

```ts
import webpush from "web-push";

webpush.setVapidDetails("mailto:" + fromEmail, vapidPub, vapidPriv);

async send(notification, user) {
  const subs = await getSubscriptions(user.id);
  if (subs.length === 0) return { ok: false, error: "no_subscriptions" };

  const payload = JSON.stringify(renderPushPayload(notification, user));
  const results = await Promise.allSettled(
    subs.map((s) => webpush.sendNotification(s, payload))
  );
  // 410 Gone → cleanup expired sub
  // 5xx → retry next cron
  return { ok: results.some((r) => r.status === "fulfilled") };
}
```

**Setup flow per user:**
1. Profile → Bật web push → browser permission prompt
2. JS: `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUB })`
3. POST subscription → insert `family.web_push_subscriptions`
4. Service Worker `public/sw.js` listens `push` → `self.registration.showNotification()`

VAPID keys generate qua `pnpm run notif:gen-vapid` script.

### Chat channels link flow (canonical)

```ts
// telegram.ts (Phase 2 real impl)
async beginLink(user) {
  const botUsername = await getSetting("notifications.telegram_bot_username");
  const linkToken = await createLinkToken(user.id, "telegram");  // 6-char nonce, 10min TTL
  return { kind: "deeplink", value: `https://t.me/${botUsername}?start=${linkToken}` };
}

async completeLink(user, payload) {
  // Bot webhook posts here when user starts chat with /start <token>
  const { chatId, username, token } = payload;
  const userId = await consumeLinkToken(token, "telegram");
  if (!userId || userId !== user.id) return { ok: false };
  await updatePreferences(user.id, {
    channels: { telegram: { enabled: true, chat_id: chatId, username } },
  });
  return { ok: true };
}
```

UI flow: toggle channel → `beginLink()` → QR code modal → user quét → bot reply → webhook → `completeLink()` → UI polls status → toggle flips ON.

Pattern uniform cho Zalo / Messenger / WhatsApp.

### Stub adapters (Phase 2/3)

```ts
export const zaloAdapter: ChannelAdapter = {
  id: "zalo", comingSoon: true, setupGuideUrl: "/admin/help/zalo-link",
  async isReady() { return Boolean(await getSetting("notifications.zalo_oa_token")); },
  async isAvailableFor() { return false; },
  async send() { return { ok: false, error: "channel_not_implemented_phase_1" }; },
};
```

UI hiển thị "🟡 Sắp ra mắt — Phase 2" badge, disabled toggle. Khi swap real adapter, không cần thay UI.

---

## 7. Profile UI

### `/admin/profile` — 3-tab page

```
[Hồ sơ] [Thông báo] [Bảo mật]
```

#### Tab 1 — Hồ sơ

- Avatar upload (Supabase storage `family-photos/avatars/<user_id>.<ext>`)
- Tên hiển thị (`display_name`)
- Timezone (dropdown, default `Asia/Ho_Chi_Minh`)
- Ngôn ngữ ưu tiên (`vi` / `en`)
- Email (readonly + verified badge)

#### Tab 2 — Thông báo

**Channels section** — 8 channels, mỗi row:
- Icon + tên
- Toggle enable/disable
- Sub-text (vd email địa chỉ, "Sắp ra mắt — Phase 2")
- Setup button cho web_push (browser prompt) + chat channels (link dialog)

**Events matrix** — table event × channel checkbox grid
- Disabled cells nếu channel chưa enable hoặc `comingSoon`
- Save inline (debounced 800ms) → toast

**Quiet hours** — toggle + time pickers + timezone display

#### Tab 3 — Bảo mật

Link tới existing change-password flow.

### Components

```
src/components/admin/profile/
├── ProfileTabs.tsx                    React island wraps shadcn Tabs
├── ProfileForm.tsx                    avatar / name / timezone / lang
├── NotificationChannels.tsx           8-channel list with link buttons
├── NotificationEventsMatrix.tsx       event × channel grid
├── NotificationQuietHours.tsx         toggle + time pickers
├── ChannelLinkDialog.tsx              QR code + deeplink modal
└── WebPushPermission.tsx              browser permission flow
```

### API endpoints

```
src/pages/api/profile/
├── update.ts                          PATCH avatar / name / timezone / lang
└── preferences.ts                     PATCH notification_preferences (deep-merge)

src/pages/api/notifications/
├── unread.json.ts                     GET count + last 10 (bell)
├── seen.ts                            POST mark-as-seen (single or all)
├── web-push/subscribe.ts              POST subscription
└── channels/[channel]/{begin,status,webhook}.ts
```

---

## 8. Admin views

### `<NotificationBell>` topbar

- Bell icon + unread badge (poll `/api/notifications/unread.json` every 30s)
- Click → DropdownMenu (Radix) với 10 latest:
  - Icon per event_type + title + relative time
  - Click → navigate event-specific URL (memorial page, condolences page…)
- Footer: "Đánh dấu tất cả đã đọc" + "Xem tất cả"
- aria-live cho new notifications

### `/admin/notifications` — full log

```
Tabs: Tất cả · Chưa đọc · Đã gửi · Lỗi
Filter: Loại sự kiện · Kênh · Thời gian
```

Row: icon + title + relative time + 3-channel status indicators (✓/⏳/✗) + "Xem chi tiết".

### `/admin/notifications/admin` — admin-only management

- Test send (chọn user + event type)
- Toggle event types globally (master switch per event qua settings)
- Delivery rate per channel last 30d (simple table)
- Manual purge button

Sidebar nav entry: thêm vào group "TƯỞNG NIỆM" hoặc tạo group "THÔNG BÁO" mới.

---

## 9. Cron + integration

### Routes

```
src/pages/admin/cron/
├── anniversary-alerts.ts        existing; migrate to dispatch()
├── notifications-retry.ts       NEW: */15 cron — processPendingRetries()
└── notifications-purge.ts       NEW: 0 3 * * 0 weekly — retention sweep
```

### Coolify scheduled tasks (auto-create via API)

| Name | Schedule | Endpoint |
|---|---|---|
| memorial-anniversary-alerts | `0 6 * * *` | /admin/cron/anniversary-alerts (existing) |
| notifications-retry | `*/15 * * * *` | /admin/cron/notifications-retry |
| notifications-purge | `0 3 * * 0` | /admin/cron/notifications-purge |

### Memorial cron migration

```diff
- const result = await sendEmail({ to: recipients, subject, template });
- if (result.ok) await recordAlert(...)
+ await dispatch({
+   eventType: variant === "t-7" ? "anniversary.t-7"
+            : variant === "t-1" ? "anniversary.t-1"
+            : "anniversary.today",
+   recipientIds: recipients.map(r => r.userId),
+   payload: { memberId: member.id, anniversaryDate: a.date.toISOString(), variant }
+ });
+ await recordAlert(...);
```

`fetchRecipients()` đổi return shape từ `{ email, lang }` → `{ userId, email, lang }` (lookup `app_users.id`).

---

## 10. Library stack (proven over custom)

| Job | Lib | Bundle |
|---|---|---|
| Email | `nodemailer` + `react-email` | đã có |
| Web Push (VAPID) | `web-push` | ~30KB |
| Telegram (Phase 2) | `grammy` | ~50KB |
| Zalo / Messenger / WhatsApp | REST direct | 0 |
| SMS Twilio (Phase 3) | `twilio` SDK | ~80KB |
| SMS eSMS VN (Phase 3) | REST direct | 0 |
| Retry helper | `async-retry` | ~5KB |
| Concurrency cap | `p-queue` (if needed) | ~8KB |
| Validation | `zod` | đã có |
| Toast | `sonner` | đã có |
| Bell dropdown | shadcn DropdownMenu (Radix) | đã có |

Phase 1 adds: `web-push`, `async-retry`, `@types/web-push`. Phase 2 adds: `grammy`. Phase 3 conditionally: `twilio`.

---

## 11. Testing strategy

### Unit (vitest)

```
src/lib/notifications/preferences.test.ts    parsePrefs, resolveChannels, isInQuietHours
                                              edge: timezone, quiet 23:00-07:00 cross midnight
src/lib/notifications/dispatcher.test.ts     deliverNotification with mock adapters
                                              cases: all-ok, partial, all-fail, channel not-available
src/lib/notifications/retry.test.ts          backoff math, attempt cap at 3
src/lib/channels/web_push.test.ts            VAPID payload shape, 410 cleanup
src/lib/channels/email.test.ts              calls existing sendEmail with right args
```

### Integration smoke

```
scripts/smoke-notifications.mjs              cron endpoints 200, web-push subscribe 200,
                                              GET unread.json shape, POST seen 200
```

### E2E manual checklist

- Profile page render mobile + desktop
- Web Push: enable → notification arrives within 5s khi cron fires manual
- Quiet hours: gửi T-7 lúc 23:00 → defer đến 07:00
- Bell badge update real-time (after seen → count drops)
- Telegram link flow (Phase 2): scan QR → bot reply → toggle flips
- Email render đẹp Gmail web + iOS Mail (đã proven memorial M5)

### CI guards

`pnpm check:no-cjk` (existing) · `pnpm test` · `pnpm build`

---

## 12. Rollout plan — 6 phases

### Phase N1 — Core foundation (~2 days)
- Migration `0018_notifications.sql`
- Lib: `notifications/{types,events,preferences,dispatcher,retry,seen,purge}.ts`
- Lib: `channels/{types,registry,email,in_app}.ts` (live)
- Lib: `channels/{web_push,zalo,telegram,messenger,whatsapp,sms}.ts` (web_push live; rest stubs)
- Migrate memorial cron to `dispatch()`
- Unit tests
- **Ship gate:** memorial cron still works through new dispatcher; no UX change

### Phase N2 — Profile UI (~1.5 days)
- `/admin/profile` page + 3-tab structure
- ProfileForm, NotificationChannels, NotificationEventsMatrix, NotificationQuietHours
- API `/api/profile/{update,preferences}`
- **Ship gate:** user can edit prefs; saved prefs reflected next dispatch

### Phase N3 — In-app + Web Push (~1.5 days)
- `<NotificationBell>` topbar + dropdown
- `/admin/notifications` log page
- VAPID generate script `pnpm run notif:gen-vapid`
- Service Worker `public/sw.js`
- WebPushPermission + subscribe endpoint
- Cleanup expired subscriptions (410 Gone)
- **Ship gate:** desktop / iPhone Safari 16.4+ nhận push; bell drop down works

### Phase N4 — Zalo OA + Telegram (~2 days, Phase 2)
- Real `zalo.ts` adapter via Zalo OA REST
- Real `telegram.ts` via grammy
- Webhook endpoints `/api/notifications/channels/{zalo,telegram}/webhook`
- ChannelLinkDialog QR + deeplink UI
- Help docs `/admin/help/{zalo,telegram}-link`
- **Ship gate:** scan QR → bot/OA reply → notification works

### Phase N5 — Quiet hours UX + admin views (~1 day)
- Quiet hours editor finalize
- `/admin/notifications/admin` panel
- Retention sweep cron + manual purge button
- **Ship gate:** admin có panel quan sát toàn bộ delivery

### Phase N6 — Messenger / WhatsApp / SMS (defer indefinitely)
- Stub adapters đã có; real impl khi business cần

**Phase 1 effort: N1+N2+N3+N5 = ~6 days** for full multi-channel + profile + admin.
**Phase 2 (chat apps): +N4 = +2 days** = total ~8 days.

---

## 13. Risks + mitigations

| Risk | L | I | Mitigation |
|---|---|---|---|
| Web Push iOS Safari 16.4+ behavior unstable | M | M | Browser feature detect; fallback gracefully; warn unsupported version |
| VAPID keys leak qua public env | L | H | Settings-stored (DB); only `web_push_vapid_public` exposed client-side |
| Telegram webhook spam / unauthorized | M | M | Verify `X-Telegram-Bot-Api-Secret-Token`; rate limit 100/min |
| Zalo OA token rotation breaks send | M | M | Catch 401 → ping admin via in_app "Token expired" + setting prompt |
| User opt-out everything → critical alerts miss | L | H | `event.critical=true` bypass quiet hours; warning UI khi toggle all OFF |
| Notifications table phình to | M | M | Retention 90d sweep cron; partial GIN index trên unseen only |
| Bell polling 30s → DB load với 50 users | L | L | Indexed query; ETag header → 304 |
| User base scale 100+ → inline dispatch slow | M | M | Migration path to `pg-boss` queue; interface unchanged |
| JSONB prefs schema drift across users | M | M | Lazy migration trên read: parse + apply defaults nếu thiếu key |
| Phase 2 chat channels delay → "Sắp ra mắt" forever | L | L | Setting `notifications.show_coming_soon` để hide nếu admin muốn |
| Multi-device web push subs stale | M | L | Cleanup on 410 Gone; "Quản lý thiết bị" UI in profile |

---

## 14. Acceptance criteria (Phase 1)

- [ ] Memorial T-7 alert delivered qua all enabled channels per user prefs
- [ ] User toggles email OFF → email không gửi nữa, in_app vẫn gửi
- [ ] Quiet hours 22:00-07:00 → non-critical defer; "Hôm nay là giỗ" gửi ngay
- [ ] Web Push: subscribe → notification arrives với title + body đúng locale
- [ ] Bell badge tăng → click drops to 0 sau "đã đọc"
- [ ] `notifications.enable=false` → toàn bộ dispatcher skip
- [ ] Retention sweep xoá rows >90d, không xoá failed
- [ ] Profile UI mobile responsive (Pixel 7 + iPhone 14 Safari)
- [ ] WCAG AA keyboard nav profile + bell + dropdown
- [ ] i18n: switch `?lang=en` đổi UI strings
- [ ] No CJK in source (CI guard)
- [ ] 0 errors `pnpm check`, all tests xanh

---

## 15. Out of scope (defer)

- Channel adapters Phase 3 (SMS, Messenger, WhatsApp) — stubs sẵn, real impl khi cần
- Notification template editor UI for admin
- A/B test copy variants
- Public visitor unsubscribe page
- Multi-instance horizontal scale (queue worker)
- Mobile native push (no app)
- Real-time presence
- Slack / Discord channels
- Email digest "tóm tắt tuần" sender (event type defined, sender deferred)

---

## 16. Open questions resolved during brainstorm

| # | Question | Answer |
|---|---|---|
| Q1 | Public family member accounts? | No — admin/editor only. Defer registration. |
| Q2 | Avatar storage? | Supabase storage `family-photos/avatars/<user_id>` |
| Q3 | Web Push iOS support? | Yes, with graceful fallback when unsupported |
| Q4 | Phase 2 channel order? | Zalo first (VN audience), Telegram second |
| Q5 | Notification retention? | 90 days for sent rows; failed kept forever |

---

## 17. References

- `DESIGN.md` — Phase 1 foundation
- `DESIGN-PHASE-2-ADMIN.md` — admin auth, RLS, schema
- `DESIGN-MEDIA-V2.md` — media v2 patterns
- `DESIGN-MEMORIAL.md` — memorial layer (precedes notification system)
- Memory: `feedback_family_memorial_tone.md` (warm × tradition)
- Memory: `feedback_family_no_chinese_chars.md` (zero Hán rule)
- Memory: `feedback_family_i18n_ready.md`
- Memory: `feedback_family_naming_convention.md`
- Memory: `feedback_prefer_proven_libs.md`
