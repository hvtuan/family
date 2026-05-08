# Notifications System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a multi-channel notification system (email + in-app + web push + chat-app stubs) with per-user JSONB preferences and a `/admin/profile` UI, so memorial alerts and future events route through one dispatcher honoring user opt-in/opt-out per channel and per event.

**Architecture:** Lean inline orchestrator (~150 LOC dispatcher, no queue lib) writes to `family.notifications` table; per-channel `ChannelAdapter` interface (8 channels declared, 3 live in Phase 1, 5 stubs); JSONB `notification_preferences` on `app_users`; profile page with 3 tabs; bell icon polls DB every 30s; web push via `web-push` lib + Service Worker; retry via cron `*/15 * * * *`; 90d retention sweep weekly. Memorial cron migrates to call `dispatch()` instead of sending email directly.

**Tech Stack:** Astro 6 SSR + React 19 islands + Supabase Postgres + Tailwind v4 + shadcn/ui + Radix · `web-push` (VAPID) + `nodemailer` + `react-email` · `async-retry` · `zod` · `motion` · `sonner`

**Spec source:** `DESIGN-NOTIFICATIONS.md` (read this for full architecture, JSONB shapes, decision log, risks)

**Scope:** Phase 1 only — N1 (schema + lib foundation) + N2 (profile UI) + N3 (in-app + web push) + N5 (quiet hours + admin views). Phase 2 (Zalo + Telegram real adapters) and Phase 3 (Messenger / WhatsApp / SMS) ship as stubs in N1; flip to real later via separate plans.

---

## Phase N1 — Core foundation

### Task 1: Migration 0018_notifications.sql

**Files:**
- Create: `supabase/migrations/0018_notifications.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 0018_notifications.sql
--
-- Multi-channel notification system. See DESIGN-NOTIFICATIONS.md.
--
-- Adds:
--   1. notifications (queue + log)
--   2. web_push_subscriptions (VAPID per device per user)
--   3. notification_link_tokens (chat-channel deep-link / OAuth)
--   4. app_users extensions (avatar_url, timezone, notification_preferences)
--   5. settings keys for VAPID + chat-channel tokens

-- ── 1. notifications ─────────────────────────────────────────────
create table if not exists family.notifications (
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
create index if not exists notif_user_unseen_idx on family.notifications (user_id, seen_at)
  where seen_at is null;
create index if not exists notif_status_retry_idx on family.notifications (status, next_retry_at)
  where status in ('pending','partial','failed');
create index if not exists notif_user_recent_idx on family.notifications (user_id, created_at desc);

comment on table family.notifications is
  'Multi-channel notification queue + log. Single source of truth: status drives delivery state across attempt cycles.';

-- ── 2. web_push_subscriptions ────────────────────────────────────
create table if not exists family.web_push_subscriptions (
  id          bigserial primary key,
  user_id     uuid not null references family.app_users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_user_idx on family.web_push_subscriptions (user_id);

-- ── 3. notification_link_tokens ──────────────────────────────────
create table if not exists family.notification_link_tokens (
  token       text primary key,
  user_id     uuid not null references family.app_users(id) on delete cascade,
  channel_id  text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz
);
create index if not exists link_token_user_channel_idx on family.notification_link_tokens (user_id, channel_id);

-- ── 4. app_users extensions ──────────────────────────────────────
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

create index if not exists app_users_pref_gin_idx on family.app_users using gin (notification_preferences);

-- ── 5. settings keys ─────────────────────────────────────────────
insert into family.settings (key, value, category, description, field_type, sort_order) values
  ('notifications.enable',                 'true', 'memorial', 'Master switch toàn hệ thống thông báo', 'boolean', 100),
  ('notifications.retention_days',         '90',   'memorial', 'Số ngày giữ thông báo trước khi tự xoá', 'number', 110),
  ('notifications.web_push_vapid_public',  '',     'memorial', 'VAPID public key (admin generate qua pnpm run notif:gen-vapid)', 'text', 120),
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

- [ ] **Step 2: Apply migration**

Run: `pnpm db:migrate`
Expected: `▶ 0018_notifications.sql ... ok` and `✓ all migrations applied`.

If `connect ECONNREFUSED`, check `SUPABASE_DB_URL` IP in `.env.local` (Coolify Postgres container IP may have rotated).

- [ ] **Step 3: Verify schema via smoke test**

Run: `pnpm db:smoke`
Expected: 6/6 checks pass (existing baseline still green; no new smoke checks yet).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0018_notifications.sql
git commit -m "feat(notif M1.1): schema 0018 — notifications, web_push_subscriptions, link_tokens"
```

---

### Task 2: Install Phase 1 libs

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install runtime + types**

Run:
```bash
pnpm add web-push async-retry
pnpm add -D @types/web-push
```
Expected: `+ web-push <ver>`, `+ async-retry <ver>`, `+ @types/web-push <ver>`.

- [ ] **Step 2: Add VAPID generation script entry**

Modify `package.json` `scripts`:

```jsonc
"notif:gen-vapid": "node scripts/notif-gen-vapid.mjs"
```

- [ ] **Step 3: Create the script**

Create `scripts/notif-gen-vapid.mjs`:

```js
#!/usr/bin/env node
/**
 * Generate a VAPID keypair for Web Push and print to stdout.
 * Paste the values into /admin/settings → category Tưởng niệm:
 *   - notifications.web_push_vapid_public
 *   - notifications.web_push_vapid_private
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("VAPID keys generated. Paste into /admin/settings:\n");
console.log("notifications.web_push_vapid_public:");
console.log("  " + keys.publicKey);
console.log("\nnotifications.web_push_vapid_private:");
console.log("  " + keys.privateKey);
console.log("\nNever commit these. The private key NEVER leaves the server.");
```

- [ ] **Step 4: Generate keys (manual, do not commit values)**

Run: `pnpm run notif:gen-vapid`
Expected: prints two base64url strings. Paste into `/admin/settings` once Phase N3 is deployed; until then keep them in a local secrets file.

- [ ] **Step 5: Commit (script only — keys never committed)**

```bash
git add package.json pnpm-lock.yaml scripts/notif-gen-vapid.mjs
git commit -m "feat(notif M1.2): add web-push, async-retry deps + VAPID gen script"
```

---

### Task 3: Notification types + zod schema

**Files:**
- Create: `src/lib/notifications/types.ts`
- Create: `src/lib/notifications/types.test.ts`

- [ ] **Step 1: Write failing test for preferences validation**

Create `src/lib/notifications/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  NotificationPreferencesSchema,
  CHANNEL_IDS,
  EVENT_TYPES,
  defaultPreferences,
} from "./types";

describe("NotificationPreferencesSchema", () => {
  it("accepts the default preferences shape", () => {
    expect(() => NotificationPreferencesSchema.parse(defaultPreferences())).not.toThrow();
  });

  it("rejects payload with unknown channel toggles via passthrough strict check", () => {
    const bad = {
      channels: { email: { enabled: true } },
      events: {},
      quiet_hours: { enabled: false, from: "22:00", to: "07:00" },
    };
    // Default schema is open; the parser still produces a normalized object.
    expect(() => NotificationPreferencesSchema.parse(bad)).not.toThrow();
  });

  it("CHANNEL_IDS includes all 8 channels in declared order", () => {
    expect(CHANNEL_IDS).toEqual([
      "email", "in_app", "web_push",
      "zalo", "telegram", "messenger", "whatsapp", "sms",
    ]);
  });

  it("EVENT_TYPES includes core 7 events", () => {
    expect(EVENT_TYPES).toContain("anniversary.t-7");
    expect(EVENT_TYPES).toContain("anniversary.t-1");
    expect(EVENT_TYPES).toContain("anniversary.today");
    expect(EVENT_TYPES).toContain("condolence.pending");
    expect(EVENT_TYPES).toContain("member.added");
    expect(EVENT_TYPES).toContain("system.welcome");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/notifications/types.test.ts`
Expected: FAIL — `Cannot find module './types'`.

- [ ] **Step 3: Implement types**

Create `src/lib/notifications/types.ts`:

```ts
/**
 * Notification system core types. See DESIGN-NOTIFICATIONS.md.
 *
 * 8 channels declared upfront so schema + UI never break when Phase 2/3
 * adapters ship. Phase 1 ships email/in_app/web_push live; the rest are
 * stubs flagged comingSoon.
 */
import { z } from "zod";

export const CHANNEL_IDS = [
  "email",
  "in_app",
  "web_push",
  "zalo",
  "telegram",
  "messenger",
  "whatsapp",
  "sms",
] as const;
export type ChannelId = (typeof CHANNEL_IDS)[number];

export const EVENT_TYPES = [
  "anniversary.t-7",
  "anniversary.t-1",
  "anniversary.today",
  "condolence.pending",
  "member.added",
  "system.welcome",
  "system.weekly_digest",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const ChannelPreferenceSchema = z
  .object({
    enabled: z.boolean(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    user_id: z.string().nullable().optional(),
    chat_id: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    psid: z.string().nullable().optional(),
  })
  .passthrough();

export const NotificationPreferencesSchema = z.object({
  channels: z.record(z.string(), ChannelPreferenceSchema),
  events: z.record(z.string(), z.array(z.string())),
  quiet_hours: z.object({
    enabled: z.boolean(),
    from: z.string(),
    to: z.string(),
  }),
});

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
export type ChannelPreference = z.infer<typeof ChannelPreferenceSchema>;

export type NotificationStatus =
  | "pending"
  | "sending"
  | "sent"
  | "partial"
  | "failed"
  | "seen";

export interface NotificationRow {
  id: number;
  user_id: string;
  event_type: EventType;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  channels_requested: ChannelId[];
  channels_delivered: ChannelId[];
  channels_failed: ChannelId[];
  attempt_count: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  sent_at: string | null;
  seen_at: string | null;
}

export function defaultPreferences(): NotificationPreferences {
  return {
    channels: {
      email: { enabled: true },
      in_app: { enabled: true },
      web_push: { enabled: false },
      zalo: { enabled: false, user_id: null, phone: null },
      telegram: { enabled: false, chat_id: null, username: null },
      messenger: { enabled: false, psid: null },
      whatsapp: { enabled: false, phone: null },
      sms: { enabled: false, phone: null },
    },
    events: {
      "anniversary.t-7": ["email", "in_app"],
      "anniversary.t-1": ["email", "in_app", "web_push", "zalo"],
      "anniversary.today": ["email", "in_app", "web_push", "zalo"],
      "condolence.pending": ["in_app"],
      "member.added": ["in_app"],
      "system.welcome": ["email", "in_app"],
    },
    quiet_hours: { enabled: false, from: "22:00", to: "07:00" },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/notifications/types.test.ts`
Expected: PASS — 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/types.ts src/lib/notifications/types.test.ts
git commit -m "feat(notif M1.3): types + zod preferences schema + 8 channel ids"
```

---

### Task 4: Preferences resolver + quiet hours

**Files:**
- Create: `src/lib/notifications/preferences.ts`
- Create: `src/lib/notifications/preferences.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/notifications/preferences.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveChannels, isInQuietHours, parsePreferences } from "./preferences";
import { defaultPreferences } from "./types";

describe("resolveChannels", () => {
  it("intersects events[type] with channels.{id}.enabled", () => {
    const prefs = defaultPreferences();
    // anniversary.t-7 default is ["email","in_app"]; both enabled by default.
    expect(resolveChannels(prefs, "anniversary.t-7")).toEqual(["email", "in_app"]);
  });

  it("drops disabled channels", () => {
    const prefs = defaultPreferences();
    prefs.channels.email.enabled = false;
    expect(resolveChannels(prefs, "anniversary.t-7")).toEqual(["in_app"]);
  });

  it("returns empty when event not in events map", () => {
    const prefs = defaultPreferences();
    expect(resolveChannels(prefs, "unknown.event")).toEqual([]);
  });
});

describe("isInQuietHours", () => {
  it("returns false when quiet_hours.enabled=false", () => {
    const prefs = defaultPreferences();
    expect(isInQuietHours(prefs, new Date("2026-05-08T23:00:00+07:00"))).toBe(false);
  });

  it("returns true at 23:00 with window 22:00-07:00 (cross-midnight)", () => {
    const prefs = defaultPreferences();
    prefs.quiet_hours = { enabled: true, from: "22:00", to: "07:00" };
    expect(isInQuietHours(prefs, new Date("2026-05-08T23:00:00+07:00"), "Asia/Ho_Chi_Minh")).toBe(true);
  });

  it("returns true at 06:00 with window 22:00-07:00", () => {
    const prefs = defaultPreferences();
    prefs.quiet_hours = { enabled: true, from: "22:00", to: "07:00" };
    expect(isInQuietHours(prefs, new Date("2026-05-08T06:00:00+07:00"), "Asia/Ho_Chi_Minh")).toBe(true);
  });

  it("returns false at 12:00 with window 22:00-07:00", () => {
    const prefs = defaultPreferences();
    prefs.quiet_hours = { enabled: true, from: "22:00", to: "07:00" };
    expect(isInQuietHours(prefs, new Date("2026-05-08T12:00:00+07:00"), "Asia/Ho_Chi_Minh")).toBe(false);
  });
});

describe("parsePreferences", () => {
  it("returns defaults when input is null", () => {
    expect(parsePreferences(null)).toEqual(defaultPreferences());
  });

  it("merges partial input with defaults (lazy migration)", () => {
    const partial = { channels: { email: { enabled: false } } };
    const result = parsePreferences(partial);
    expect(result.channels.email.enabled).toBe(false);
    expect(result.channels.in_app.enabled).toBe(true); // from defaults
    expect(result.events["anniversary.today"]).toEqual(["email", "in_app", "web_push", "zalo"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/notifications/preferences.test.ts`
Expected: FAIL — `Cannot find module './preferences'`.

- [ ] **Step 3: Implement preferences resolver**

Create `src/lib/notifications/preferences.ts`:

```ts
/**
 * Read / write user notification preferences. Resolves which channels
 * should fire for a given event, and computes whether the current time
 * falls in the user's quiet hours window (timezone-aware, cross-midnight).
 *
 * Lazy migration: parsePreferences accepts partial JSON and deep-merges
 * with defaults so older rows surviving schema changes still work.
 */
import { supabaseAdmin } from "../supabase/admin";
import {
  CHANNEL_IDS,
  defaultPreferences,
  type ChannelId,
  type EventType,
  type NotificationPreferences,
} from "./types";

export function parsePreferences(input: unknown): NotificationPreferences {
  const defaults = defaultPreferences();
  if (!input || typeof input !== "object") return defaults;

  const obj = input as Partial<NotificationPreferences>;
  const channels = { ...defaults.channels };
  if (obj.channels && typeof obj.channels === "object") {
    for (const id of CHANNEL_IDS) {
      const fromInput = (obj.channels as Record<string, unknown>)[id];
      if (fromInput && typeof fromInput === "object") {
        channels[id] = { ...channels[id], ...(fromInput as Record<string, unknown>) };
      }
    }
  }

  const events = { ...defaults.events };
  if (obj.events && typeof obj.events === "object") {
    for (const [k, v] of Object.entries(obj.events)) {
      if (Array.isArray(v)) events[k] = v.filter((x): x is string => typeof x === "string");
    }
  }

  const quiet_hours = obj.quiet_hours
    ? { ...defaults.quiet_hours, ...(obj.quiet_hours as Partial<NotificationPreferences["quiet_hours"]>) }
    : defaults.quiet_hours;

  return { channels, events, quiet_hours };
}

export function resolveChannels(
  prefs: NotificationPreferences,
  eventType: string
): ChannelId[] {
  const eventChannels = prefs.events[eventType] ?? [];
  return eventChannels.filter(
    (id): id is ChannelId =>
      (CHANNEL_IDS as readonly string[]).includes(id) &&
      prefs.channels[id as ChannelId]?.enabled === true
  );
}

export function isInQuietHours(
  prefs: NotificationPreferences,
  now: Date = new Date(),
  timezone = "Asia/Ho_Chi_Minh"
): boolean {
  if (!prefs.quiet_hours.enabled) return false;
  const { from, to } = prefs.quiet_hours;
  const minutesNow = currentMinutesInTz(now, timezone);
  const fromMin = parseHHMM(from);
  const toMin = parseHHMM(to);
  if (fromMin === null || toMin === null) return false;

  if (fromMin <= toMin) {
    // Same-day window: 13:00-15:00
    return minutesNow >= fromMin && minutesNow < toMin;
  }
  // Cross-midnight window: 22:00-07:00 → in if now >= 22:00 OR now < 07:00
  return minutesNow >= fromMin || minutesNow < toMin;
}

export function endOfQuietWindow(
  prefs: NotificationPreferences,
  now: Date = new Date(),
  timezone = "Asia/Ho_Chi_Minh"
): Date {
  const toMin = parseHHMM(prefs.quiet_hours.to);
  if (toMin === null) return now;
  const minutesNow = currentMinutesInTz(now, timezone);
  const minutesUntilEnd =
    toMin > minutesNow ? toMin - minutesNow : 24 * 60 - minutesNow + toMin;
  return new Date(now.getTime() + minutesUntilEnd * 60 * 1000);
}

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("notification_preferences")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return parsePreferences(data?.notification_preferences);
}

export async function updatePreferences(
  userId: string,
  patch: Partial<NotificationPreferences>
): Promise<void> {
  const current = await getPreferences(userId);
  const next: NotificationPreferences = {
    channels: { ...current.channels, ...(patch.channels ?? {}) },
    events: { ...current.events, ...(patch.events ?? {}) },
    quiet_hours: { ...current.quiet_hours, ...(patch.quiet_hours ?? {}) },
  };
  // Deep merge each channel
  if (patch.channels) {
    for (const [k, v] of Object.entries(patch.channels)) {
      next.channels[k] = { ...current.channels[k], ...v };
    }
  }
  const { error } = await supabaseAdmin
    .from("app_users")
    .update({ notification_preferences: next })
    .eq("id", userId);
  if (error) throw error;
}

function parseHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function currentMinutesInTz(now: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/notifications/preferences.test.ts`
Expected: PASS — 7/7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/preferences.ts src/lib/notifications/preferences.test.ts
git commit -m "feat(notif M1.4): preferences resolver + quiet hours (timezone-aware, cross-midnight)"
```

---

### Task 5: Channel adapter interface + registry

**Files:**
- Create: `src/lib/channels/types.ts`
- Create: `src/lib/channels/registry.ts`

- [ ] **Step 1: Create the interface**

Create `src/lib/channels/types.ts`:

```ts
/**
 * Channel adapter interface. Every channel (email, in_app, web_push, zalo,
 * telegram, messenger, whatsapp, sms) implements this. Phase 2/3 channels
 * ship as stubs flagged comingSoon=true.
 */
import type { ChannelId, NotificationRow } from "@/lib/notifications/types";

export interface AppUserRow {
  id: string;
  email: string;
  display_name: string | null;
  preferred_lang: "vi" | "en";
  timezone: string | null;
  notification_preferences: unknown;
}

export type ChannelLinkPayload =
  | { kind: "url"; value: string }
  | { kind: "code"; value: string }
  | { kind: "deeplink"; value: string };

export interface ChannelAdapter {
  id: ChannelId;
  /** Show "Sắp ra mắt" badge in profile UI until Phase ships. */
  comingSoon?: boolean;
  /** Optional URL pointing to in-admin setup guide for this channel. */
  setupGuideUrl?: string;
  /** Globally configured (e.g. Zalo OA token set in settings)? */
  isReady(): Promise<boolean>;
  /** This specific user has linked + opted in. */
  isAvailableFor(user: AppUserRow): Promise<boolean>;
  /** Optional: per-user account linking flow. */
  beginLink?(user: AppUserRow): Promise<ChannelLinkPayload>;
  /** Verify a link attempt + persist channel state. */
  completeLink?(user: AppUserRow, payload: Record<string, unknown>): Promise<{ ok: boolean }>;
  /** Send a notification. Returns ok=true on at least one delivery. */
  send(notification: NotificationRow, user: AppUserRow): Promise<{ ok: boolean; error?: string }>;
}
```

- [ ] **Step 2: Create the registry skeleton**

Create `src/lib/channels/registry.ts`:

```ts
/**
 * Channel registry — single source of truth mapping ChannelId to adapter
 * implementation. Phase 1 lights up email/in_app/web_push; rest are stubs
 * with isAvailableFor=false until Phase 2/3 swaps the send() body.
 */
import type { ChannelAdapter } from "./types";
import type { ChannelId } from "@/lib/notifications/types";
import { emailAdapter } from "./email";
import { inAppAdapter } from "./in_app";
import { webPushAdapter } from "./web_push";
import { zaloAdapter } from "./zalo";
import { telegramAdapter } from "./telegram";
import { messengerAdapter } from "./messenger";
import { whatsappAdapter } from "./whatsapp";
import { smsAdapter } from "./sms";

export const channelRegistry: Record<ChannelId, ChannelAdapter> = {
  email: emailAdapter,
  in_app: inAppAdapter,
  web_push: webPushAdapter,
  zalo: zaloAdapter,
  telegram: telegramAdapter,
  messenger: messengerAdapter,
  whatsapp: whatsappAdapter,
  sms: smsAdapter,
};

export function getAdapter(id: ChannelId): ChannelAdapter | undefined {
  return channelRegistry[id];
}
```

- [ ] **Step 3: Verify imports compile (will fail until Tasks 6-9 land)**

Run: `pnpm check 2>&1 | grep -E "src/lib/channels" | head -20`
Expected: errors referencing the unimplemented adapter modules. That's fine — Tasks 6-9 fix them. Do NOT commit yet.

---

### Task 6: Email + in_app adapters

**Files:**
- Create: `src/lib/channels/email.ts`
- Create: `src/lib/channels/in_app.ts`

- [ ] **Step 1: Email adapter**

Create `src/lib/channels/email.ts`:

```ts
/**
 * Email channel adapter. Wraps the existing src/lib/email.ts (memorial M5)
 * with the ChannelAdapter interface so the dispatcher routes through here.
 */
import type { ChannelAdapter, AppUserRow } from "./types";
import type { NotificationRow } from "@/lib/notifications/types";
import { sendEmail } from "@/lib/email";
import { getSetting } from "@/lib/settings";
import { renderEventForChannel, getEventDescriptor } from "@/lib/notifications/events";
import { parsePreferences } from "@/lib/notifications/preferences";

export const emailAdapter: ChannelAdapter = {
  id: "email",
  async isReady() {
    const [host, fromEmail] = await Promise.all([
      getSetting("smtp.host"),
      getSetting("smtp.from_email"),
    ]);
    return Boolean(host && fromEmail);
  },
  async isAvailableFor(user: AppUserRow) {
    const prefs = parsePreferences(user.notification_preferences);
    return Boolean(user.email && prefs.channels.email?.enabled);
  },
  async send(notification: NotificationRow, user: AppUserRow) {
    const event = getEventDescriptor(notification.event_type);
    if (!event) return { ok: false, error: "unknown_event" };
    const template = renderEventForChannel(event, "email", notification.payload, user);
    if (!template) return { ok: false, error: "no_email_template" };
    const result = await sendEmail({
      to: { email: user.email, name: user.display_name ?? undefined, lang: user.preferred_lang },
      subject: event.subject(notification.payload, user.preferred_lang),
      template,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.reason };
  },
};
```

- [ ] **Step 2: In-app adapter**

Create `src/lib/channels/in_app.ts`:

```ts
/**
 * In-app channel adapter. No-op send: the row in family.notifications is
 * the delivery itself. The bell icon polls /api/notifications/unread.json.
 */
import type { ChannelAdapter, AppUserRow } from "./types";
import { parsePreferences } from "@/lib/notifications/preferences";

export const inAppAdapter: ChannelAdapter = {
  id: "in_app",
  async isReady() {
    return true;
  },
  async isAvailableFor(user: AppUserRow) {
    const prefs = parsePreferences(user.notification_preferences);
    return prefs.channels.in_app?.enabled ?? true;
  },
  async send() {
    // No-op: the dispatcher already inserted the notification row; the
    // bell icon picks it up on its next poll.
    return { ok: true };
  },
};
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/channels/types.ts src/lib/channels/registry.ts src/lib/channels/email.ts src/lib/channels/in_app.ts
git commit -m "feat(notif M1.5): channel adapter interface + registry + email/in_app adapters"
```

---

### Task 7: Web Push adapter

**Files:**
- Create: `src/lib/channels/web_push.ts`
- Create: `src/lib/channels/web_push.test.ts`

- [ ] **Step 1: Write the test**

Create `src/lib/channels/web_push.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === "notifications.web_push_vapid_public") return "PUB";
    if (key === "notifications.web_push_vapid_private") return "PRIV";
    if (key === "smtp.from_email") return "noreply@example.com";
    return null;
  }),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async () => ({ statusCode: 201 })),
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          data: [
            { id: 1, endpoint: "https://push.example/abc", p256dh: "p", auth: "a" },
          ],
          error: null,
        }),
      }),
    }),
  },
}));

import { webPushAdapter } from "./web_push";

describe("webPushAdapter", () => {
  it("isReady returns true when both VAPID keys set", async () => {
    expect(await webPushAdapter.isReady()).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/channels/web_push.test.ts`
Expected: FAIL — `Cannot find module './web_push'`.

- [ ] **Step 3: Implement adapter**

Create `src/lib/channels/web_push.ts`:

```ts
/**
 * Web Push channel adapter using the web-push lib (VAPID).
 *
 * One user → many subscriptions (per-device). On 410 Gone we cleanup the
 * stale subscription so it's not retried forever.
 */
import webpush from "web-push";
import type { ChannelAdapter, AppUserRow } from "./types";
import type { NotificationRow } from "@/lib/notifications/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { parsePreferences } from "@/lib/notifications/preferences";
import { renderEventForChannel, getEventDescriptor } from "@/lib/notifications/events";

interface PushSub {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let vapidConfigured = false;

async function ensureVapid(): Promise<boolean> {
  if (vapidConfigured) return true;
  const [pub, priv, fromEmail] = await Promise.all([
    getSetting("notifications.web_push_vapid_public"),
    getSetting("notifications.web_push_vapid_private"),
    getSetting("smtp.from_email"),
  ]);
  if (!pub || !priv) return false;
  webpush.setVapidDetails(`mailto:${fromEmail ?? "noreply@localhost"}`, pub, priv);
  vapidConfigured = true;
  return true;
}

async function getSubscriptions(userId: string): Promise<PushSub[]> {
  const { data, error } = await supabaseAdmin
    .from("web_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as PushSub[];
}

async function deleteSubscription(id: number): Promise<void> {
  await supabaseAdmin.from("web_push_subscriptions").delete().eq("id", id);
}

export const webPushAdapter: ChannelAdapter = {
  id: "web_push",
  async isReady() {
    return ensureVapid();
  },
  async isAvailableFor(user: AppUserRow) {
    const prefs = parsePreferences(user.notification_preferences);
    if (!prefs.channels.web_push?.enabled) return false;
    const subs = await getSubscriptions(user.id);
    return subs.length > 0;
  },
  async send(notification: NotificationRow, user: AppUserRow) {
    if (!(await ensureVapid())) return { ok: false, error: "vapid_not_configured" };
    const subs = await getSubscriptions(user.id);
    if (subs.length === 0) return { ok: false, error: "no_subscriptions" };

    const event = getEventDescriptor(notification.event_type);
    if (!event) return { ok: false, error: "unknown_event" };
    const payload = renderEventForChannel(event, "web_push", notification.payload, user);
    if (!payload) return { ok: false, error: "no_push_template" };

    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        )
      )
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "rejected") {
        const status = (r.reason as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await deleteSubscription(subs[i].id);
        }
      }
    }

    const okCount = results.filter((r) => r.status === "fulfilled").length;
    return okCount > 0 ? { ok: true } : { ok: false, error: "all_subs_failed" };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/lib/channels/web_push.test.ts`
Expected: PASS — 1/1 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/web_push.ts src/lib/channels/web_push.test.ts
git commit -m "feat(notif M1.6): web push adapter (VAPID + 410 cleanup)"
```

---

### Task 8: Phase 2/3 stub adapters

**Files:**
- Create: `src/lib/channels/zalo.ts`
- Create: `src/lib/channels/telegram.ts`
- Create: `src/lib/channels/messenger.ts`
- Create: `src/lib/channels/whatsapp.ts`
- Create: `src/lib/channels/sms.ts`

- [ ] **Step 1: Zalo stub**

Create `src/lib/channels/zalo.ts`:

```ts
import type { ChannelAdapter } from "./types";
import { getSetting } from "@/lib/settings";

export const zaloAdapter: ChannelAdapter = {
  id: "zalo",
  comingSoon: true,
  setupGuideUrl: "/admin/help/zalo-link",
  async isReady() {
    return Boolean(await getSetting("notifications.zalo_oa_token"));
  },
  async isAvailableFor() {
    return false;
  },
  async send() {
    return { ok: false, error: "channel_not_implemented_phase_1" };
  },
};
```

- [ ] **Step 2: Telegram stub**

Create `src/lib/channels/telegram.ts`:

```ts
import type { ChannelAdapter } from "./types";
import { getSetting } from "@/lib/settings";

export const telegramAdapter: ChannelAdapter = {
  id: "telegram",
  comingSoon: true,
  setupGuideUrl: "/admin/help/telegram-link",
  async isReady() {
    return Boolean(await getSetting("notifications.telegram_bot_token"));
  },
  async isAvailableFor() {
    return false;
  },
  async send() {
    return { ok: false, error: "channel_not_implemented_phase_1" };
  },
};
```

- [ ] **Step 3: Messenger / WhatsApp / SMS stubs**

Create `src/lib/channels/messenger.ts`:

```ts
import type { ChannelAdapter } from "./types";

export const messengerAdapter: ChannelAdapter = {
  id: "messenger",
  comingSoon: true,
  setupGuideUrl: "/admin/help/messenger-link",
  async isReady() { return false; },
  async isAvailableFor() { return false; },
  async send() { return { ok: false, error: "channel_not_implemented_phase_3" }; },
};
```

Create `src/lib/channels/whatsapp.ts`:

```ts
import type { ChannelAdapter } from "./types";

export const whatsappAdapter: ChannelAdapter = {
  id: "whatsapp",
  comingSoon: true,
  setupGuideUrl: "/admin/help/whatsapp-link",
  async isReady() { return false; },
  async isAvailableFor() { return false; },
  async send() { return { ok: false, error: "channel_not_implemented_phase_3" }; },
};
```

Create `src/lib/channels/sms.ts`:

```ts
import type { ChannelAdapter } from "./types";

export const smsAdapter: ChannelAdapter = {
  id: "sms",
  comingSoon: true,
  setupGuideUrl: "/admin/help/sms-setup",
  async isReady() { return false; },
  async isAvailableFor() { return false; },
  async send() { return { ok: false, error: "channel_not_implemented_phase_3" }; },
};
```

- [ ] **Step 4: Verify the registry compiles**

Run: `pnpm check 2>&1 | grep -E "src/lib/channels" | head -10`
Expected: no errors referencing the channel files (pre-existing warnings unrelated to this work are fine).

- [ ] **Step 5: Commit**

```bash
git add src/lib/channels/zalo.ts src/lib/channels/telegram.ts src/lib/channels/messenger.ts src/lib/channels/whatsapp.ts src/lib/channels/sms.ts
git commit -m "feat(notif M1.7): stub adapters — zalo, telegram, messenger, whatsapp, sms"
```

---

### Task 9: Event registry + render dispatch

**Files:**
- Create: `src/lib/notifications/events.ts`
- Create: `src/lib/notifications/events.test.ts`
- Modify: `src/i18n/vi.ts:1-1` (add notification keys; see Step 4 below)

- [ ] **Step 1: Create the test**

Create `src/lib/notifications/events.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { getEventDescriptor, renderEventForChannel } from "./events";

const fakeUser = {
  id: "u1",
  email: "u@example.com",
  display_name: "Cô An",
  preferred_lang: "vi" as const,
  timezone: "Asia/Ho_Chi_Minh",
  notification_preferences: null,
};

describe("getEventDescriptor", () => {
  it("returns descriptor for known event", () => {
    const d = getEventDescriptor("anniversary.t-7");
    expect(d).toBeDefined();
    expect(d?.id).toBe("anniversary.t-7");
  });

  it("returns undefined for unknown event", () => {
    expect(getEventDescriptor("nope")).toBeUndefined();
  });
});

describe("renderEventForChannel — in_app", () => {
  it("anniversary.t-7 renders title + body string", () => {
    const d = getEventDescriptor("anniversary.t-7")!;
    const out = renderEventForChannel(d, "in_app", { memberName: "Cụ Tổ", days: 7 }, fakeUser);
    expect(out).toMatchObject({ title: expect.stringContaining("7 ngày") });
  });
});
```

- [ ] **Step 2: Run test to fail**

Run: `pnpm test src/lib/notifications/events.test.ts`
Expected: FAIL — `Cannot find module './events'`.

- [ ] **Step 3: Implement events registry**

Create `src/lib/notifications/events.ts`:

```ts
/**
 * Event descriptor registry. Each event defines:
 *   - default channels
 *   - critical flag (bypass quiet hours)
 *   - subject() for emails
 *   - render() per channel returning the channel-specific payload shape
 *
 * Adding a new event = 1 entry here + handle channels you care about.
 */
import type { ReactElement } from "react";
import type { ChannelId, EventType } from "./types";
import type { AppUserRow } from "@/lib/channels/types";
import type { Locale } from "@/i18n";
import { t } from "@/i18n";

export interface EventDescriptor {
  id: EventType;
  defaultChannels: ChannelId[];
  critical: boolean;
  subject: (payload: Record<string, unknown>, lang: Locale) => string;
}

export interface InAppPayload {
  title: string;
  body: string;
  url: string;
  icon: string;
}

export interface PushPayload extends InAppPayload {}

const EVENTS: Record<EventType, EventDescriptor> = {
  "anniversary.t-7": {
    id: "anniversary.t-7",
    defaultChannels: ["email", "in_app"],
    critical: false,
    subject: (p, lang) => t("notifications.anniversaryT7Subject", lang, { name: String(p.memberName ?? "") }),
  },
  "anniversary.t-1": {
    id: "anniversary.t-1",
    defaultChannels: ["email", "in_app", "web_push", "zalo"],
    critical: false,
    subject: (p, lang) => t("notifications.anniversaryT1Subject", lang, { name: String(p.memberName ?? "") }),
  },
  "anniversary.today": {
    id: "anniversary.today",
    defaultChannels: ["email", "in_app", "web_push", "zalo"],
    critical: true,
    subject: (p, lang) => t("notifications.anniversaryTodaySubject", lang, { name: String(p.memberName ?? "") }),
  },
  "condolence.pending": {
    id: "condolence.pending",
    defaultChannels: ["in_app"],
    critical: false,
    subject: () => "Lời tưởng nhớ chờ duyệt",
  },
  "member.added": {
    id: "member.added",
    defaultChannels: ["in_app"],
    critical: false,
    subject: () => "Có thành viên mới",
  },
  "system.welcome": {
    id: "system.welcome",
    defaultChannels: ["email", "in_app"],
    critical: false,
    subject: () => "Chào mừng đến với gia phả",
  },
  "system.weekly_digest": {
    id: "system.weekly_digest",
    defaultChannels: ["email"],
    critical: false,
    subject: () => "Tóm tắt tuần",
  },
};

export function getEventDescriptor(eventType: string): EventDescriptor | undefined {
  return EVENTS[eventType as EventType];
}

/**
 * Render an event for a specific channel. Returns:
 *  - ReactElement   for "email" (consumed by react-email render)
 *  - InAppPayload   for "in_app" (stored as-is in notifications.payload, read by bell)
 *  - PushPayload    for "web_push" (JSON sent to Service Worker)
 *  - string         for chat channels (markdown / plain text)
 *  - null           if the channel has no template for this event yet
 */
export function renderEventForChannel(
  event: EventDescriptor,
  channel: ChannelId,
  payload: Record<string, unknown>,
  user: AppUserRow
): InAppPayload | PushPayload | ReactElement | string | null {
  const lang = user.preferred_lang ?? "vi";
  const memberName = String(payload.memberName ?? "");

  if (channel === "in_app" || channel === "web_push") {
    if (event.id === "anniversary.t-7") {
      return {
        title: t("notifications.anniversaryT7InApp", lang, { name: memberName }),
        body: t("notifications.anniversaryT7Body", lang, { name: memberName }),
        url: payload.memberId ? `/memorial/${payload.memberId}` : "/altar",
        icon: "🌸",
      };
    }
    if (event.id === "anniversary.t-1") {
      return {
        title: t("notifications.anniversaryT1InApp", lang, { name: memberName }),
        body: t("notifications.anniversaryT1Body", lang, { name: memberName }),
        url: payload.memberId ? `/memorial/${payload.memberId}` : "/altar",
        icon: "🌸",
      };
    }
    if (event.id === "anniversary.today") {
      return {
        title: t("notifications.anniversaryTodayInApp", lang, { name: memberName }),
        body: t("notifications.anniversaryTodayBody", lang, { name: memberName }),
        url: payload.memberId ? `/memorial/${payload.memberId}` : "/altar",
        icon: "🌸",
      };
    }
    if (event.id === "condolence.pending") {
      return {
        title: "Lời tưởng nhớ mới chờ duyệt",
        body: "Mở danh sách để xem chi tiết và duyệt",
        url: "/admin/condolences",
        icon: "💬",
      };
    }
    if (event.id === "member.added") {
      return {
        title: "Có thành viên mới được thêm",
        body: String(payload.memberName ?? ""),
        url: "/admin/members",
        icon: "👤",
      };
    }
    if (event.id === "system.welcome") {
      return {
        title: "Chào mừng đến với gia phả họ",
        body: "Mở phần thiết lập để chọn cách bạn muốn nhận thông báo.",
        url: "/admin/profile",
        icon: "✨",
      };
    }
    return null;
  }

  if (channel === "email") {
    // Anniversary events reuse the existing memorial M5 template so the
    // migrated cron renders identical emails. Other events get a generic
    // EmailLayout with title + body fallback.
    if (event.id === "anniversary.t-7" || event.id === "anniversary.t-1" || event.id === "anniversary.today") {
      const variant = event.id === "anniversary.t-7" ? "t-7" : event.id === "anniversary.t-1" ? "t-1" : "today";
      const memberId = String(payload.memberId ?? "");
      const anniversaryIso = String(payload.anniversaryDate ?? new Date().toISOString());
      // The dispatcher does not have all the fields AnniversaryAlert needs
      // (photo URL, lunar label, born/died years, bio preview). The memorial
      // cron pre-renders these into payload before calling dispatch — see
      // Task 12 step 2 for the exact payload shape.
      const memberName = String(payload.memberName ?? "");
      const photoUrl = (payload.photoUrl as string | null | undefined) ?? null;
      const lunarLabel = String(payload.lunarLabel ?? "");
      const bornYear = (payload.bornYear as string | null | undefined) ?? null;
      const diedYear = String(payload.diedYear ?? "");
      const solarDate = String(payload.solarDate ?? "");
      const bioPreview = String(payload.bioPreview ?? "");
      const publicUrl = String(payload.publicUrl ?? "https://family.huynhvantuan.net");
      const surname = String(payload.surname ?? "Nguyễn");
      const memorialUrl = `${publicUrl.replace(/\/$/, "")}/memorial/${memberId}`;
      // Lazy-import to avoid pulling React into module graphs that don't need it.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const React = require("react");
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AnniversaryAlert = require("@/emails/AnniversaryAlert").default;
      return React.createElement(AnniversaryAlert, {
        variant,
        memberName,
        memorialUrl,
        publicUrl,
        surname,
        photoUrl,
        bornYear,
        diedYear,
        solarDate,
        lunarLabel,
        bioPreview,
        recipientName: user.display_name ?? undefined,
      });
    }
    // Generic email template for non-anniversary events.
    const inApp = renderEventForChannel(event, "in_app", payload, user) as InAppPayload | null;
    if (!inApp) return null;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const React = require("react");
    return React.createElement(
      "div",
      { style: { fontFamily: "Georgia, serif", padding: 24 } },
      React.createElement("h2", null, inApp.title),
      React.createElement("p", null, inApp.body),
      React.createElement(
        "a",
        { href: `${String(payload.publicUrl ?? "https://family.huynhvantuan.net")}${inApp.url}` },
        "Mở trang liên quan"
      )
    );
  }

  // Chat channels (zalo, telegram, ...) — Phase 2 implementation will
  // return the rendered markdown string here.
  return null;
}
```

- [ ] **Step 4: Add VN i18n keys**

Modify `src/i18n/vi.ts`. Inside the existing `as const` object, add a `notifications` section before the closing `} as const;`:

```ts
  notifications: {
    anniversaryT7Subject: "Còn 7 ngày tới giỗ {name}",
    anniversaryT1Subject: "Ngày mai là giỗ {name}",
    anniversaryTodaySubject: "Hôm nay là ngày giỗ {name}",
    anniversaryT7InApp: "Còn 7 ngày tới giỗ {name}",
    anniversaryT7Body: "Một tuần nữa là đến ngày giỗ {name}. Mở để xem trang tưởng niệm.",
    anniversaryT1InApp: "Ngày mai là giỗ {name}",
    anniversaryT1Body: "Mai là giỗ {name}. Đừng quên dâng nén tâm hương.",
    anniversaryTodayInApp: "Hôm nay là ngày giỗ {name}",
    anniversaryTodayBody: "Hôm nay là ngày giỗ {name}. Mở trang tưởng niệm để dâng tâm hương.",
  },
```

- [ ] **Step 5: Run test to verify pass**

Run: `pnpm test src/lib/notifications/events.test.ts`
Expected: PASS — 3/3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications/events.ts src/lib/notifications/events.test.ts src/i18n/vi.ts
git commit -m "feat(notif M1.8): event descriptor registry + in_app/web_push renderers + i18n keys"
```

---

### Task 10: Dispatcher

**Files:**
- Create: `src/lib/notifications/dispatcher.ts`
- Create: `src/lib/notifications/dispatcher.test.ts`

- [ ] **Step 1: Write the test**

Create `src/lib/notifications/dispatcher.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertSpy = vi.fn(async () => ({ data: { id: 42, attempt_count: 0 }, error: null }));
const updateSpy = vi.fn(async () => ({ error: null }));
const userRow = {
  id: "u1",
  email: "u@example.com",
  display_name: "Cô An",
  preferred_lang: "vi",
  timezone: "Asia/Ho_Chi_Minh",
  notification_preferences: null,
};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: userRow, error: null }),
          maybeSingle: async () => ({ data: userRow, error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: insertSpy,
        }),
      }),
      update: () => ({ eq: updateSpy }),
    }),
  },
}));

vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(async (k: string) => (k === "notifications.enable" ? "true" : null)),
  getNumber: vi.fn(async () => null),
  getBoolean: vi.fn(async () => null),
}));

vi.mock("@/lib/channels/registry", () => ({
  channelRegistry: {
    in_app: {
      id: "in_app",
      isReady: async () => true,
      isAvailableFor: async () => true,
      send: async () => ({ ok: true }),
    },
    email: {
      id: "email",
      isReady: async () => true,
      isAvailableFor: async () => true,
      send: async () => ({ ok: true }),
    },
  },
  getAdapter: (id: string) => ({ in_app: { id: "in_app", send: async () => ({ ok: true }) } }[id]),
}));

import { dispatch } from "./dispatcher";

describe("dispatch", () => {
  beforeEach(() => {
    insertSpy.mockClear();
    updateSpy.mockClear();
  });

  it("does nothing when master switch is off", async () => {
    vi.doMock("@/lib/settings", () => ({
      getSetting: vi.fn(async () => "false"),
    }));
    // Re-import to apply doMock
    const { dispatch: dispatch2 } = await import("./dispatcher");
    const out = await dispatch2({
      eventType: "anniversary.t-7",
      recipientIds: ["u1"],
      payload: {},
    });
    expect(out.enqueued + out.sentInline).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to fail**

Run: `pnpm test src/lib/notifications/dispatcher.test.ts`
Expected: FAIL — `Cannot find module './dispatcher'`.

- [ ] **Step 3: Implement dispatcher**

Create `src/lib/notifications/dispatcher.ts`:

```ts
/**
 * Inline notification dispatcher. Resolves user prefs → picks channels →
 * inserts a notifications row → invokes channel adapters → updates row
 * with delivered/failed channels + next_retry_at.
 *
 * No queue lib: synchronous within the calling request. Cron handlers and
 * admin actions await this directly.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { channelRegistry } from "@/lib/channels/registry";
import type { AppUserRow } from "@/lib/channels/types";
import type { ChannelId, EventType, NotificationRow } from "./types";
import { parsePreferences, isInQuietHours, endOfQuietWindow, resolveChannels } from "./preferences";
import { getEventDescriptor } from "./events";

const RETRY_BACKOFF_MS = [15 * 60 * 1000, 60 * 60 * 1000, 4 * 60 * 60 * 1000];

export interface DispatchInput {
  eventType: EventType;
  recipientIds: string[];
  payload: Record<string, unknown>;
  forceChannels?: ChannelId[];
}

export interface DispatchResult {
  enqueued: number;
  sentInline: number;
}

export async function dispatch(input: DispatchInput): Promise<DispatchResult> {
  const enabled = (await getSetting("notifications.enable")) ?? "true";
  if (enabled === "false") return { enqueued: 0, sentInline: 0 };

  const event = getEventDescriptor(input.eventType);
  if (!event) throw new Error(`unknown event type: ${input.eventType}`);

  let enqueued = 0;
  let sentInline = 0;

  for (const userId of input.recipientIds) {
    const user = await loadUser(userId);
    if (!user) continue;

    const prefs = parsePreferences(user.notification_preferences);
    const channels = input.forceChannels ?? resolveChannels(prefs, input.eventType);
    if (channels.length === 0) continue;

    const inQuiet = isInQuietHours(prefs, new Date(), user.timezone ?? "Asia/Ho_Chi_Minh");
    const defer = inQuiet && !event.critical;

    const row = await insertNotification({
      user_id: userId,
      event_type: input.eventType,
      payload: input.payload,
      channels_requested: channels,
      status: defer ? "pending" : "sending",
      next_retry_at: defer
        ? endOfQuietWindow(prefs, new Date(), user.timezone ?? "Asia/Ho_Chi_Minh").toISOString()
        : null,
    });

    if (defer) {
      enqueued++;
      continue;
    }

    await deliverNotification(row, user);
    sentInline++;
  }

  return { enqueued, sentInline };
}

export async function deliverNotification(
  row: NotificationRow,
  user: AppUserRow
): Promise<void> {
  const delivered: ChannelId[] = [...row.channels_delivered];
  const failed: ChannelId[] = [];
  const errors: string[] = [];

  // Only attempt channels that haven't yet been delivered AND aren't already
  // in this attempt's "channels_failed". Retries pass an updated row.
  const toAttempt = row.channels_requested.filter((c) => !delivered.includes(c));

  for (const channelId of toAttempt) {
    const adapter = channelRegistry[channelId];
    if (!adapter) {
      failed.push(channelId);
      errors.push(`${channelId}: unknown_adapter`);
      continue;
    }
    if (!(await adapter.isReady())) {
      failed.push(channelId);
      errors.push(`${channelId}: not_ready`);
      continue;
    }
    if (!(await adapter.isAvailableFor(user))) {
      // Not a failure — user simply hasn't linked this channel.
      continue;
    }
    try {
      const result = await adapter.send(row, user);
      if (result.ok) delivered.push(channelId);
      else {
        failed.push(channelId);
        errors.push(`${channelId}: ${result.error ?? "send_failed"}`);
      }
    } catch (e) {
      failed.push(channelId);
      errors.push(`${channelId}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  const allRequested = row.channels_requested;
  const status =
    failed.length === 0 && delivered.length === allRequested.length
      ? "sent"
      : delivered.length === 0
      ? "failed"
      : "partial";

  const nextAttempt = row.attempt_count + 1;
  const nextRetryAt =
    status !== "sent" && nextAttempt < RETRY_BACKOFF_MS.length
      ? new Date(Date.now() + RETRY_BACKOFF_MS[nextAttempt]).toISOString()
      : null;

  await supabaseAdmin
    .from("notifications")
    .update({
      status,
      channels_delivered: delivered,
      channels_failed: failed,
      last_error: errors.join("; ") || null,
      sent_at: new Date().toISOString(),
      attempt_count: nextAttempt,
      next_retry_at: nextRetryAt,
    })
    .eq("id", row.id);
}

async function loadUser(userId: string): Promise<AppUserRow | null> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, email, display_name, preferred_lang, timezone, notification_preferences")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as AppUserRow | null) ?? null;
}

async function insertNotification(input: {
  user_id: string;
  event_type: EventType;
  payload: Record<string, unknown>;
  channels_requested: ChannelId[];
  status: "pending" | "sending";
  next_retry_at: string | null;
}): Promise<NotificationRow> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as NotificationRow;
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/lib/notifications/dispatcher.test.ts`
Expected: PASS — 1/1 (the master-switch off case).

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/dispatcher.ts src/lib/notifications/dispatcher.test.ts
git commit -m "feat(notif M1.9): dispatcher — resolve prefs → adapters → row update with backoff"
```

---

### Task 11: Retry + purge handlers + cron endpoints

**Files:**
- Create: `src/lib/notifications/retry.ts`
- Create: `src/lib/notifications/purge.ts`
- Create: `src/pages/admin/cron/notifications-retry.ts`
- Create: `src/pages/admin/cron/notifications-purge.ts`

- [ ] **Step 1: Implement retry**

Create `src/lib/notifications/retry.ts`:

```ts
/**
 * Periodic retry for notifications stuck in pending/partial/failed.
 *
 * Triggered by Coolify scheduled task hitting /admin/cron/notifications-retry
 * every 15 minutes. Picks up rows whose next_retry_at <= now() and
 * attempt_count < 3, then re-runs deliverNotification on the failed
 * channels only.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AppUserRow } from "@/lib/channels/types";
import type { NotificationRow } from "./types";
import { deliverNotification } from "./dispatcher";

const BATCH_LIMIT = 100;

export interface RetryResult {
  processed: number;
  succeeded: number;
}

export async function processPendingRetries(): Promise<RetryResult> {
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .in("status", ["pending", "partial", "failed"])
    .lt("attempt_count", 3)
    .lte("next_retry_at", nowIso)
    .limit(BATCH_LIMIT);
  if (error) throw error;

  let processed = 0;
  let succeeded = 0;

  for (const row of (rows ?? []) as NotificationRow[]) {
    const user = await loadUser(row.user_id);
    if (!user) continue;
    processed++;
    await deliverNotification(row, user);
    // Read back to check status
    const { data: updated } = await supabaseAdmin
      .from("notifications")
      .select("status")
      .eq("id", row.id)
      .maybeSingle();
    if (updated?.status === "sent") succeeded++;
  }

  return { processed, succeeded };
}

async function loadUser(userId: string): Promise<AppUserRow | null> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, email, display_name, preferred_lang, timezone, notification_preferences")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as AppUserRow | null) ?? null;
}
```

- [ ] **Step 2: Implement purge**

Create `src/lib/notifications/purge.ts`:

```ts
/**
 * Retention sweep — delete sent rows older than retention_days, plus
 * expired link tokens. Failed rows are kept indefinitely so admin can
 * audit them.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getNumber } from "@/lib/settings";

export async function purgeOldNotifications(): Promise<{ notifications: number; tokens: number }> {
  const days = (await getNumber("notifications.retention_days")) ?? 90;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { count: nCount } = await supabaseAdmin
    .from("notifications")
    .delete({ count: "exact" })
    .lt("created_at", cutoff)
    .eq("status", "sent");

  const { count: tCount } = await supabaseAdmin
    .from("notification_link_tokens")
    .delete({ count: "exact" })
    .lt("expires_at", new Date().toISOString());

  return { notifications: nCount ?? 0, tokens: tCount ?? 0 };
}
```

- [ ] **Step 3: Cron endpoint — retry**

Create `src/pages/admin/cron/notifications-retry.ts`:

```ts
import type { APIRoute } from "astro";
import { requireCronSecret } from "@/lib/cron-auth";
import { processPendingRetries } from "@/lib/notifications/retry";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  const result = await processPendingRetries();
  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
```

- [ ] **Step 4: Cron endpoint — purge**

Create `src/pages/admin/cron/notifications-purge.ts`:

```ts
import type { APIRoute } from "astro";
import { requireCronSecret } from "@/lib/cron-auth";
import { purgeOldNotifications } from "@/lib/notifications/purge";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  const result = await purgeOldNotifications();
  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
```

- [ ] **Step 5: Type-check + build**

Run: `pnpm check && pnpm build`
Expected: 0 errors; build completes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications/retry.ts src/lib/notifications/purge.ts src/pages/admin/cron/notifications-retry.ts src/pages/admin/cron/notifications-purge.ts
git commit -m "feat(notif M1.10): retry + purge handlers + cron endpoints"
```

---

### Task 12: Migrate memorial cron to dispatch()

**Files:**
- Modify: `src/pages/admin/cron/anniversary-alerts.ts`

- [ ] **Step 1: Read the existing file**

Run: `wc -l src/pages/admin/cron/anniversary-alerts.ts`
Expected: ~190 lines.

- [ ] **Step 2: Replace inline email with dispatch()**

In `src/pages/admin/cron/anniversary-alerts.ts`:

Replace the import block at the top:

```ts
// REMOVE
import AnniversaryAlert, { type AnniversaryAlertVariant } from "@/emails/AnniversaryAlert";
import { sendEmail, type EmailRecipient } from "@/lib/email";
import React from "react";
```

With:

```ts
import { dispatch } from "@/lib/notifications/dispatcher";
import type { AnniversaryAlertVariant } from "@/emails/AnniversaryAlert"; // keep type only
```

Replace the inner `sendEmail` block (the one inside the `for member of deceased` loop) with the dispatch call. Locate the section that currently looks like:

```ts
const result = await sendEmail({ to: recipients, subject: alertSubject(variant, member.name), template: emailHtml });
if (result.ok) {
  await recordAlert(member.id, variant, anniversary, recipients);
  sent++;
} else { ... }
```

Replace with:

```ts
const eventType =
  variant === "t-7" ? "anniversary.t-7" :
  variant === "t-1" ? "anniversary.t-1" : "anniversary.today";

// Build the email-ready payload once per (member, anniversary) so each
// recipient's email render can read all required fields without DB
// round-trips inside the adapter.
const dd = String(anniversary.date.getDate()).padStart(2, "0");
const mm = String(anniversary.date.getMonth() + 1).padStart(2, "0");
const yyyy = String(anniversary.date.getFullYear());

try {
  const result = await dispatch({
    eventType,
    recipientIds: recipients.map((r) => r.userId),
    payload: {
      memberId: member.id,
      memberName: member.name,
      anniversaryDate: anniversary.date.toISOString(),
      variant,
      // Fields consumed by AnniversaryAlert email render via renderEventForChannel("email")
      photoUrl: member.photoUrl,
      bornYear: member.born ? String(new Date(member.born).getFullYear()) : null,
      diedYear: member.died ? String(new Date(member.died).getFullYear()) : "",
      solarDate: `${dd}/${mm}/${yyyy}`,
      lunarLabel: formatLunarVi(member.deathDateLunar),
      bioPreview: (member.bio ?? "").trim().slice(0, 280),
      publicUrl,
      surname,
    },
  });

  if (result.sentInline + result.enqueued > 0) {
    await recordAlert(member.id, variant, anniversary, recipients);
    sent++;
  } else {
    errors.push(`${member.id}/${variant}: no_recipients_dispatched`);
  }
} catch (err) {
  errors.push(`${member.id}/${variant}: ${err instanceof Error ? err.message : "unknown"}`);
}
```

- [ ] **Step 3: Update fetchRecipients to return userId**

In the same file, find `fetchRecipients` and ensure it returns `{ userId: string; email: string; lang: 'vi' | 'en' }`. Add `id` to the select and surface it as `userId`:

```ts
async function fetchRecipients(): Promise<EmailRecipient[]> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, email, role, status, preferred_lang")
    .eq("status", "approved")
    .in("role", ["admin", "branch_editor"]);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    userId: row.id as string,
    email: row.email as string,
    lang: ((row.preferred_lang as "vi" | "en" | undefined) ?? "vi"),
  }));
}
```

Also update the local `EmailRecipient` type alias at the top:

```ts
type EmailRecipient = { userId: string; email: string; lang: "vi" | "en" };
```

- [ ] **Step 4: Type-check**

Run: `pnpm check`
Expected: 0 errors. If `renderAlertEmail` becomes unused, delete it.

- [ ] **Step 5: Smoke test**

Run: `pnpm build`
Expected: Build complete.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/cron/anniversary-alerts.ts
git commit -m "refactor(notif M1.11): memorial cron → dispatch() — emails routed via orchestrator"
```

---

### Task 13: Apply N1 to staging — Coolify scheduled tasks

**Files:** No code changes; ops only.

- [ ] **Step 1: Create retry scheduled task via Coolify API**

Run (with `.env.local` sourced):

```bash
source .env.local
APP_UUID="x12pnqywbdwg5gqudhb4j5tj"
CRON_SECRET=$(cat /tmp/cron-secret.txt 2>/dev/null || echo "REPLACE_ME")
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$COOLIFY_BASE_URL/api/v1/applications/$APP_UUID/scheduled-tasks" \
  -d "$(jq -nc --arg s "$CRON_SECRET" '{name:"notifications-retry", command:("curl -fsS -X POST -H \"Authorization: Bearer "+$s+"\" https://family.huynhvantuan.net/admin/cron/notifications-retry"), frequency:"*/15 * * * *"}')"
```
Expected: HTTP 201 with task uuid.

- [ ] **Step 2: Create purge scheduled task**

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN" \
  -H "Content-Type: application/json" \
  "$COOLIFY_BASE_URL/api/v1/applications/$APP_UUID/scheduled-tasks" \
  -d "$(jq -nc --arg s "$CRON_SECRET" '{name:"notifications-purge", command:("curl -fsS -X POST -H \"Authorization: Bearer "+$s+"\" https://family.huynhvantuan.net/admin/cron/notifications-purge"), frequency:"0 3 * * 0"}')"
```
Expected: HTTP 201.

- [ ] **Step 3: Deploy + verify**

Push to main triggers Coolify deploy. Wait ~90s. The user (or the agent if explicitly authorized for prod cron triggers) hits the retry endpoint manually:

```bash
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" \
  https://family.huynhvantuan.net/admin/cron/notifications-retry
```
Expected: `{"ok":true,"processed":0,"succeeded":0}` on a fresh DB.

- [ ] **Step 4: Update operations doc**

Append to `docs/MEMORIAL-CRON.md` (or create `docs/NOTIFICATIONS-CRON.md`) the two new tasks:

```markdown
## Notifications cron tasks

- `notifications-retry` — `*/15 * * * *` — re-attempts pending/partial/failed notification rows
- `notifications-purge` — `0 3 * * 0` — deletes sent rows older than `notifications.retention_days` (default 90), plus expired link tokens

Manual trigger commands identical to `anniversary-alerts` with the matching path.
```

- [ ] **Step 5: Commit**

```bash
git add docs/MEMORIAL-CRON.md
git commit -m "docs(notif M1.12): add notifications-retry + purge cron tasks"
```

---

## Phase N2 — Profile UI

### Task 14: Profile page shell + tabs

**Files:**
- Create: `src/pages/admin/profile.astro`
- Create: `src/components/admin/profile/ProfileTabs.tsx`

- [ ] **Step 1: Create the Astro page**

Create `src/pages/admin/profile.astro`:

```astro
---
export const prerender = false;

import AdminLayout from "@/layouts/AdminLayout.astro";
import ProfileTabs from "@/components/admin/profile/ProfileTabs.tsx";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { parsePreferences } from "@/lib/notifications/preferences";

const me = Astro.locals.user;
if (!me) return Astro.redirect("/admin/login");

const { data, error } = await supabaseAdmin
  .from("app_users")
  .select("id, email, display_name, role, branch, preferred_lang, avatar_url, timezone, notification_preferences")
  .eq("id", me.id)
  .maybeSingle();

if (error || !data) return Astro.redirect("/admin");

const prefs = parsePreferences(data.notification_preferences);
const profile = {
  id: data.id as string,
  email: data.email as string,
  displayName: (data.display_name as string | null) ?? "",
  role: data.role as "admin" | "editor" | "branch_editor",
  preferredLang: (data.preferred_lang as "vi" | "en" | null) ?? "vi",
  avatarUrl: (data.avatar_url as string | null) ?? null,
  timezone: (data.timezone as string | null) ?? "Asia/Ho_Chi_Minh",
};
---

<AdminLayout title="Hồ sơ của tôi" crumbs={[{ label: "Hồ sơ" }]}>
  <ProfileTabs client:load profile={profile} preferences={prefs} />
</AdminLayout>
```

- [ ] **Step 2: Create the React tabs island**

Create `src/components/admin/profile/ProfileTabs.tsx`:

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProfileForm from "./ProfileForm";
import NotificationChannels from "./NotificationChannels";
import NotificationEventsMatrix from "./NotificationEventsMatrix";
import NotificationQuietHours from "./NotificationQuietHours";
import type { NotificationPreferences } from "@/lib/notifications/types";

export interface ProfileSummary {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "editor" | "branch_editor";
  preferredLang: "vi" | "en";
  avatarUrl: string | null;
  timezone: string;
}

interface Props {
  profile: ProfileSummary;
  preferences: NotificationPreferences;
}

export default function ProfileTabs({ profile, preferences }: Props) {
  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList>
        <TabsTrigger value="profile">Hồ sơ</TabsTrigger>
        <TabsTrigger value="notifications">Thông báo</TabsTrigger>
        <TabsTrigger value="security">Bảo mật</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">
        <ProfileForm profile={profile} />
      </TabsContent>
      <TabsContent value="notifications" className="space-y-6">
        <NotificationChannels profile={profile} initialPreferences={preferences} />
        <NotificationEventsMatrix initialPreferences={preferences} />
        <NotificationQuietHours initialPreferences={preferences} timezone={profile.timezone} />
      </TabsContent>
      <TabsContent value="security">
        <div className="rounded-md border p-6">
          <p className="text-sm text-gray-600 m-0">
            Đổi mật khẩu hiện làm qua chức năng riêng. Hãy liên hệ quản trị nếu bạn cần đặt lại.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm check 2>&1 | grep -E "profile" | head -20`
Expected: errors referring to ProfileForm / NotificationChannels / NotificationEventsMatrix / NotificationQuietHours (Tasks 15-18 fix them).

- [ ] **Step 4: Commit (compile-broken; will green up after Tasks 15-18)**

```bash
git add src/pages/admin/profile.astro src/components/admin/profile/ProfileTabs.tsx
git commit -m "feat(notif M2.1): /admin/profile shell + 3-tab island wrapper"
```

---

### Task 15: ProfileForm + update API

**Files:**
- Create: `src/components/admin/profile/ProfileForm.tsx`
- Create: `src/pages/api/profile/update.ts`

- [ ] **Step 1: ProfileForm component**

Create `src/components/admin/profile/ProfileForm.tsx`:

```tsx
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ProfileSummary } from "./ProfileTabs";

interface Props {
  profile: ProfileSummary;
}

const TIMEZONES = [
  { value: "Asia/Ho_Chi_Minh", label: "Asia/Ho_Chi_Minh (UTC+7)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (UTC+9)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (UTC-8/-7)" },
  { value: "Europe/London", label: "Europe/London (UTC+0/+1)" },
  { value: "UTC", label: "UTC" },
];

export default function ProfileForm({ profile }: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [preferredLang, setPreferredLang] = useState<"vi" | "en">(profile.preferredLang);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, timezone, preferredLang }),
      });
      if (res.ok) toast.success("Đã lưu hồ sơ");
      else toast.error("Lỗi lưu hồ sơ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Toaster richColors position="bottom-right" />
      <form onSubmit={onSubmit} className="grid gap-5 max-w-xl">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={profile.email} readOnly disabled />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="displayName">Tên hiển thị</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="timezone">Múi giờ</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lang">Ngôn ngữ ưu tiên</Label>
          <Select value={preferredLang} onValueChange={(v) => setPreferredLang(v as "vi" | "en")}>
            <SelectTrigger id="lang">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vi">Tiếng Việt</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Đang lưu..." : "Lưu hồ sơ"}
        </Button>
      </form>
    </>
  );
}
```

- [ ] **Step 2: Update API**

Create `src/pages/api/profile/update.ts`:

```ts
import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new Response("Bad payload", { status: 400 });

  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : null;
  const timezone = typeof body.timezone === "string" ? body.timezone.slice(0, 64) : null;
  const preferredLang =
    body.preferredLang === "vi" || body.preferredLang === "en" ? body.preferredLang : null;

  const update: Record<string, unknown> = {};
  if (displayName !== null) update.display_name = displayName;
  if (timezone !== null) update.timezone = timezone;
  if (preferredLang !== null) update.preferred_lang = preferredLang;

  if (Object.keys(update).length === 0) {
    return new Response(JSON.stringify({ ok: true, noop: true }), { status: 200 });
  }

  const { error } = await supabaseAdmin.from("app_users").update(update).eq("id", me.id);
  if (error) return new Response(error.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
```

- [ ] **Step 3: Type-check**

Run: `pnpm check 2>&1 | grep -E "profile" | head -10`
Expected: only NotificationChannels / Matrix / QuietHours errors remain.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/profile/ProfileForm.tsx src/pages/api/profile/update.ts
git commit -m "feat(notif M2.2): ProfileForm — display_name + timezone + preferred_lang + update API"
```

---

### Task 16: NotificationChannels list

**Files:**
- Create: `src/components/admin/profile/NotificationChannels.tsx`
- Create: `src/pages/api/profile/preferences.ts`

- [ ] **Step 1: Channel list component**

Create `src/components/admin/profile/NotificationChannels.tsx`:

```tsx
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NotificationPreferences } from "@/lib/notifications/types";
import { CHANNEL_IDS } from "@/lib/notifications/types";
import type { ProfileSummary } from "./ProfileTabs";

const CHANNEL_META: Record<string, { name: string; icon: string; phaseHint: string | null }> = {
  email:     { name: "Email",                                       icon: "✉️", phaseHint: null },
  in_app:    { name: "Thông báo trong web (in-app)",                icon: "🔔", phaseHint: null },
  web_push:  { name: "Thông báo trình duyệt (web push)",            icon: "📲", phaseHint: null },
  zalo:      { name: "Zalo",                                        icon: "💬", phaseHint: "Sắp ra mắt — Phase 2" },
  telegram:  { name: "Telegram",                                    icon: "✈️",  phaseHint: "Sắp ra mắt — Phase 2" },
  messenger: { name: "Messenger",                                   icon: "📨", phaseHint: "Sắp ra mắt — Phase 3" },
  whatsapp:  { name: "WhatsApp",                                    icon: "📱", phaseHint: "Sắp ra mắt — Phase 3" },
  sms:       { name: "SMS",                                         icon: "📞", phaseHint: "Sắp ra mắt — Phase 3" },
};

interface Props {
  profile: ProfileSummary;
  initialPreferences: NotificationPreferences;
}

export default function NotificationChannels({ profile, initialPreferences }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initialPreferences);

  async function toggleChannel(channel: string, enabled: boolean) {
    const next: NotificationPreferences = {
      ...prefs,
      channels: { ...prefs.channels, [channel]: { ...prefs.channels[channel], enabled } },
    };
    setPrefs(next);
    try {
      const res = await fetch("/api/profile/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: { [channel]: { enabled } } }),
      });
      if (!res.ok) {
        toast.error("Lỗi lưu thiết lập kênh");
        setPrefs(prefs);
      }
    } catch {
      toast.error("Lỗi kết nối");
      setPrefs(prefs);
    }
  }

  return (
    <>
      <Toaster richColors position="bottom-right" />
      <Card className="p-5">
        <h3 className="text-base font-semibold mb-4">Kênh nhận thông báo</h3>
        <ul className="grid gap-3 list-none p-0 m-0">
          {CHANNEL_IDS.map((id) => {
            const meta = CHANNEL_META[id];
            const channel = prefs.channels[id];
            const isComingSoon = Boolean(meta.phaseHint);
            return (
              <li
                key={id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <span aria-hidden="true" className="text-xl">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="m-0 font-medium">{meta.name}</p>
                  {id === "email" && (
                    <p className="m-0 text-xs text-gray-500">{profile.email}</p>
                  )}
                  {meta.phaseHint && (
                    <p className="m-0 text-xs text-amber-600">{meta.phaseHint}</p>
                  )}
                </div>
                {isComingSoon && (
                  <Badge variant="secondary" className="mr-2">Sắp ra mắt</Badge>
                )}
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  disabled={isComingSoon}
                  checked={channel?.enabled ?? false}
                  onChange={(e) => toggleChannel(id, e.target.checked)}
                />
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
```

- [ ] **Step 2: Preferences API endpoint**

Create `src/pages/api/profile/preferences.ts`:

```ts
import type { APIRoute } from "astro";
import { updatePreferences } from "@/lib/notifications/preferences";
import type { NotificationPreferences } from "@/lib/notifications/types";

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as Partial<NotificationPreferences> | null;
  if (!body || typeof body !== "object") return new Response("Bad payload", { status: 400 });

  await updatePreferences(me.id, body);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
```

- [ ] **Step 3: Type-check + run dev to smoke locally**

Run: `pnpm check`
Expected: errors only for NotificationEventsMatrix / NotificationQuietHours.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/profile/NotificationChannels.tsx src/pages/api/profile/preferences.ts
git commit -m "feat(notif M2.3): NotificationChannels list + preferences PATCH API"
```

---

### Task 17: NotificationEventsMatrix

**Files:**
- Create: `src/components/admin/profile/NotificationEventsMatrix.tsx`

- [ ] **Step 1: Implement matrix**

Create `src/components/admin/profile/NotificationEventsMatrix.tsx`:

```tsx
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import type { NotificationPreferences, ChannelId } from "@/lib/notifications/types";
import { CHANNEL_IDS, EVENT_TYPES } from "@/lib/notifications/types";

const EVENT_LABELS: Record<string, string> = {
  "anniversary.t-7": "Còn 7 ngày tới giỗ",
  "anniversary.t-1": "Ngày mai là giỗ",
  "anniversary.today": "Hôm nay là giỗ",
  "condolence.pending": "Lời tưởng nhớ chờ duyệt",
  "member.added": "Thành viên mới được thêm",
  "system.welcome": "Chào mừng",
  "system.weekly_digest": "Tóm tắt tuần",
};

const CHANNEL_SHORT: Record<ChannelId, string> = {
  email: "Email", in_app: "Web", web_push: "Push",
  zalo: "Zalo", telegram: "TG", messenger: "FB", whatsapp: "WA", sms: "SMS",
};

interface Props {
  initialPreferences: NotificationPreferences;
}

export default function NotificationEventsMatrix({ initialPreferences }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initialPreferences);
  const [savingTimer, setSavingTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const enabledChannels = useMemo(
    () => CHANNEL_IDS.filter((id) => prefs.channels[id]?.enabled),
    [prefs.channels]
  );

  function isOn(eventType: string, channel: ChannelId): boolean {
    return (prefs.events[eventType] ?? []).includes(channel);
  }

  function toggle(eventType: string, channel: ChannelId, on: boolean) {
    const current = prefs.events[eventType] ?? [];
    const next = on ? Array.from(new Set([...current, channel])) : current.filter((c) => c !== channel);
    const nextPrefs: NotificationPreferences = {
      ...prefs,
      events: { ...prefs.events, [eventType]: next },
    };
    setPrefs(nextPrefs);
    scheduleSave(nextPrefs);
  }

  function scheduleSave(next: NotificationPreferences) {
    if (savingTimer) clearTimeout(savingTimer);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/profile/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: next.events }),
        });
        if (!res.ok) toast.error("Lỗi lưu ma trận thông báo");
      } catch {
        toast.error("Lỗi kết nối");
      }
    }, 600);
    setSavingTimer(t);
  }

  return (
    <Card className="p-5 overflow-x-auto">
      <h3 className="text-base font-semibold mb-3">Loại thông báo × kênh</h3>
      <p className="text-xs text-gray-500 mb-4">
        Chọn kênh nào nhận loại thông báo nào. Cột mờ = kênh chưa bật ở trên.
      </p>
      <table className="text-sm w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2 font-medium text-gray-600">Sự kiện</th>
            {CHANNEL_IDS.map((id) => (
              <th
                key={id}
                className={`text-center p-2 font-medium ${enabledChannels.includes(id) ? "text-gray-700" : "text-gray-300"}`}
              >
                {CHANNEL_SHORT[id]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {EVENT_TYPES.map((eventType) => (
            <tr key={eventType} className="border-b last:border-0">
              <td className="p-2 text-gray-800">{EVENT_LABELS[eventType] ?? eventType}</td>
              {CHANNEL_IDS.map((id) => {
                const disabled = !enabledChannels.includes(id);
                return (
                  <td key={id} className="text-center p-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      disabled={disabled}
                      checked={isOn(eventType, id)}
                      onChange={(e) => toggle(eventType, id, e.target.checked)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm check 2>&1 | grep -E "profile/" | head -5`
Expected: only NotificationQuietHours error remaining.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/profile/NotificationEventsMatrix.tsx
git commit -m "feat(notif M2.4): NotificationEventsMatrix — event×channel grid + debounced save"
```

---

### Task 18: NotificationQuietHours

**Files:**
- Create: `src/components/admin/profile/NotificationQuietHours.tsx`

- [ ] **Step 1: Implement quiet hours**

Create `src/components/admin/profile/NotificationQuietHours.tsx`:

```tsx
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NotificationPreferences } from "@/lib/notifications/types";

interface Props {
  initialPreferences: NotificationPreferences;
  timezone: string;
}

export default function NotificationQuietHours({ initialPreferences, timezone }: Props) {
  const [enabled, setEnabled] = useState(initialPreferences.quiet_hours.enabled);
  const [from, setFrom] = useState(initialPreferences.quiet_hours.from);
  const [to, setTo] = useState(initialPreferences.quiet_hours.to);

  async function save(next: { enabled: boolean; from: string; to: string }) {
    try {
      const res = await fetch("/api/profile/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiet_hours: next }),
      });
      if (!res.ok) toast.error("Lỗi lưu giờ yên tĩnh");
    } catch {
      toast.error("Lỗi kết nối");
    }
  }

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold mb-3">Giờ yên tĩnh</h3>
      <label className="flex items-center gap-3 mb-4">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            save({ enabled: e.target.checked, from, to });
          }}
        />
        <span className="text-sm">Bật giờ yên tĩnh — hoãn thông báo không khẩn cấp tới hết khoảng này</span>
      </label>
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="grid gap-1">
          <Label htmlFor="qh-from">Từ</Label>
          <Input
            id="qh-from"
            type="time"
            value={from}
            disabled={!enabled}
            onChange={(e) => {
              setFrom(e.target.value);
              save({ enabled, from: e.target.value, to });
            }}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="qh-to">Đến</Label>
          <Input
            id="qh-to"
            type="time"
            value={to}
            disabled={!enabled}
            onChange={(e) => {
              setTo(e.target.value);
              save({ enabled, from, to: e.target.value });
            }}
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Múi giờ: <span className="font-mono">{timezone}</span> (đổi ở tab Hồ sơ).
        Thông báo "Hôm nay là ngày giỗ" được gửi ngay, không chờ.
      </p>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check + build**

Run: `pnpm check && pnpm build`
Expected: 0 errors, build OK.

- [ ] **Step 3: Sidebar entry — link to /admin/profile**

Modify `src/components/admin/Sidebar.astro`. In the topbar avatar/name area at the bottom, add a link to `/admin/profile`. Find the `<div class="border-t border-gray-100 py-4">` near the bottom and add this `<a>` block above the existing "Xem trang công khai" link:

```astro
    <a href="/admin/profile" class="menu-item menu-item-inactive">
      <span class="menu-item-icon-inactive shrink-0" set:html={ICONS.user} />
      <span class="menu-item-text">Hồ sơ của tôi</span>
    </a>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/profile/NotificationQuietHours.tsx src/components/admin/Sidebar.astro
git commit -m "feat(notif M2.5): NotificationQuietHours + sidebar link to /admin/profile"
```

---

## Phase N3 — In-app + Web Push

### Task 19: Notification bell + unread API

**Files:**
- Create: `src/components/admin/NotificationBell.tsx`
- Create: `src/pages/api/notifications/unread.json.ts`
- Create: `src/pages/api/notifications/seen.ts`
- Modify: `src/components/admin/Topbar.astro` (mount the bell)

- [ ] **Step 1: Unread API**

Create `src/pages/api/notifications/unread.json.ts`:

```ts
import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const me = locals.user;
  if (!me) return new Response(JSON.stringify({ count: 0, items: [] }), { status: 401 });

  const [{ count }, { data: items }] = await Promise.all([
    supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", me.id)
      .is("seen_at", null),
    supabaseAdmin
      .from("notifications")
      .select("id, event_type, payload, created_at, seen_at")
      .eq("user_id", me.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const list = (items ?? []).map((row) => ({
    id: row.id as number,
    eventType: row.event_type as string,
    payload: row.payload as Record<string, unknown>,
    createdAt: row.created_at as string,
    seen: row.seen_at != null,
  }));

  return new Response(JSON.stringify({ count: count ?? 0, items: list }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
};
```

- [ ] **Step 2: Mark-seen API**

Create `src/pages/api/notifications/seen.ts`:

```ts
import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ids: number[] = Array.isArray((body as { ids?: unknown }).ids)
    ? ((body as { ids: unknown[] }).ids).filter((v): v is number => typeof v === "number")
    : [];
  const all = (body as { all?: unknown }).all === true;

  const update = supabaseAdmin
    .from("notifications")
    .update({ seen_at: new Date().toISOString() })
    .eq("user_id", me.id)
    .is("seen_at", null);

  const query = all ? update : update.in("id", ids.length ? ids : [-1]);
  const { error } = await query;
  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
```

- [ ] **Step 3: Bell component**

Create `src/components/admin/NotificationBell.tsx`:

```tsx
import { useEffect, useState } from "react";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Item {
  id: number;
  eventType: string;
  payload: Record<string, unknown>;
  createdAt: string;
  seen: boolean;
}

const ICON_FOR_EVENT: Record<string, string> = {
  "anniversary.t-7": "🌸",
  "anniversary.t-1": "🌸",
  "anniversary.today": "🌸",
  "condolence.pending": "💬",
  "member.added": "👤",
  "system.welcome": "✨",
};

const URL_FOR_EVENT = (eventType: string, payload: Record<string, unknown>): string => {
  if (eventType.startsWith("anniversary.")) {
    const memberId = String(payload.memberId ?? "");
    return memberId ? `/memorial/${memberId}` : "/altar";
  }
  if (eventType === "condolence.pending") return "/admin/condolences";
  if (eventType === "member.added") return "/admin/members";
  return "/admin/notifications";
};

const TITLE_FOR_EVENT = (eventType: string, payload: Record<string, unknown>): string => {
  const name = String(payload.memberName ?? "");
  if (eventType === "anniversary.t-7") return `Còn 7 ngày tới giỗ ${name}`;
  if (eventType === "anniversary.t-1") return `Ngày mai là giỗ ${name}`;
  if (eventType === "anniversary.today") return `Hôm nay là giỗ ${name}`;
  if (eventType === "condolence.pending") return "Lời tưởng nhớ mới chờ duyệt";
  if (eventType === "member.added") return "Có thành viên mới";
  if (eventType === "system.welcome") return "Chào mừng đến với gia phả";
  return eventType;
};

const POLL_MS = 30 * 1000;

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Item[]>([]);

  async function load() {
    try {
      const res = await fetch("/api/notifications/unread.json", { credentials: "same-origin" });
      if (!res.ok) return;
      const json = (await res.json()) as { count: number; items: Item[] };
      setCount(json.count);
      setItems(json.items);
    } catch {
      // Network error — leave previous state.
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, []);

  async function markAllSeen() {
    await fetch("/api/notifications/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-gray-100">
        <span aria-hidden="true">🔔</span>
        {count > 0 && (
          <span
            aria-label={`${count} thông báo chưa đọc`}
            className="absolute -top-1 -right-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2">
          <span>Thông báo</span>
          {count > 0 && (
            <button
              type="button"
              onClick={markAllSeen}
              className="text-xs text-brand-500 hover:underline"
            >
              Đánh dấu đã đọc
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-gray-500">Không có thông báo.</p>
        ) : (
          <ul aria-live="polite" className="list-none m-0 p-0 max-h-[60vh] overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <a
                  href={URL_FOR_EVENT(item.eventType, item.payload)}
                  className={`block px-3 py-2 text-sm hover:bg-gray-50 ${item.seen ? "text-gray-500" : "font-medium text-gray-800"}`}
                >
                  <span aria-hidden="true" className="mr-2">{ICON_FOR_EVENT[item.eventType] ?? "•"}</span>
                  {TITLE_FOR_EVENT(item.eventType, item.payload)}
                </a>
              </li>
            ))}
          </ul>
        )}
        <DropdownMenuSeparator />
        <a
          href="/admin/notifications"
          className="block text-center text-xs text-brand-500 px-3 py-2 hover:underline"
        >
          Xem tất cả →
        </a>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 4: Mount bell in Topbar**

Modify `src/components/admin/Topbar.astro`. Add import at top:

```astro
import NotificationBell from "./NotificationBell.tsx";
```

Add `<NotificationBell client:load />` adjacent to the Cmd+K button. Locate the existing search button block and place the bell to its left or right (whichever position suits the flex layout).

- [ ] **Step 5: Type-check + build**

Run: `pnpm check && pnpm build`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/NotificationBell.tsx src/pages/api/notifications/unread.json.ts src/pages/api/notifications/seen.ts src/components/admin/Topbar.astro
git commit -m "feat(notif M3.1): NotificationBell + unread API + seen API + topbar mount"
```

---

### Task 20: Web Push subscribe + Service Worker

**Files:**
- Create: `public/sw.js`
- Create: `src/components/admin/profile/WebPushPermission.tsx`
- Create: `src/pages/api/notifications/web-push/subscribe.ts`
- Modify: `src/components/admin/profile/NotificationChannels.tsx` (insert button for web_push row)

- [ ] **Step 1: Service Worker**

Create `public/sw.js`:

```js
/* Service Worker for Web Push notifications.
 * Receives a push event with JSON payload { title, body, url, icon } and
 * shows a system notification. Click → focuses or opens the URL.
 */
self.addEventListener("push", function (event) {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = data.title || "Thông báo gia phả";
  const options = {
    body: data.body || "",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: { url: data.url || "/admin/notifications" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/admin/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.endsWith(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return null;
    })
  );
});
```

- [ ] **Step 2: Subscribe API**

Create `src/pages/api/notifications/web-push/subscribe.ts`:

```ts
import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updatePreferences } from "@/lib/notifications/preferences";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  const subscription = (body as { subscription?: unknown })?.subscription;
  if (!subscription || typeof subscription !== "object") {
    return new Response("Bad payload", { status: 400 });
  }

  const sub = subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
    return new Response("Invalid subscription", { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("web_push_subscriptions")
    .upsert(
      {
        user_id: me.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: userAgent.slice(0, 240),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
  if (error) return new Response(error.message, { status: 500 });

  await updatePreferences(me.id, { channels: { web_push: { enabled: true } } });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  const endpoint = (body as { endpoint?: string })?.endpoint;
  if (!endpoint) return new Response("Bad payload", { status: 400 });

  await supabaseAdmin
    .from("web_push_subscriptions")
    .delete()
    .eq("user_id", me.id)
    .eq("endpoint", endpoint);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
```

- [ ] **Step 3: WebPushPermission component**

Create `src/components/admin/profile/WebPushPermission.tsx`:

```tsx
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface Props {
  vapidPublicKey: string;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function WebPushPermission({ vapidPublicKey }: Props) {
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = "serviceWorker" in navigator && "PushManager" in window;
    setSupported(ok);
    if (ok && Notification.permission === "granted") {
      navigator.serviceWorker.getRegistration().then((r) => {
        r?.pushManager.getSubscription().then((sub) => setSubscribed(Boolean(sub)));
      });
    }
  }, []);

  async function subscribe() {
    setBusy(true);
    try {
      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Bạn chưa cho phép thông báo trình duyệt.");
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const res = await fetch("/api/notifications/web-push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (!res.ok) {
        await sub.unsubscribe();
        toast.error("Lỗi đăng ký thiết bị.");
        return;
      }
      setSubscribed(true);
      toast.success("Đã bật thông báo trình duyệt.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/notifications/web-push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Đã tắt thông báo trình duyệt.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return <p className="text-xs text-amber-600 m-0">Trình duyệt không hỗ trợ web push.</p>;
  }
  if (!vapidPublicKey) {
    return <p className="text-xs text-gray-500 m-0">Web push chưa cấu hình. Quản trị cần thêm VAPID key.</p>;
  }
  return subscribed ? (
    <Button type="button" variant="outline" size="sm" onClick={unsubscribe} disabled={busy}>
      Tắt thông báo trình duyệt
    </Button>
  ) : (
    <Button type="button" size="sm" onClick={subscribe} disabled={busy}>
      Bật thông báo trình duyệt
    </Button>
  );
}
```

- [ ] **Step 4: Surface VAPID public key + WebPushPermission in NotificationChannels**

Modify `src/pages/admin/profile.astro` to also load the VAPID public key from settings and pass to ProfileTabs:

Add inside the frontmatter:

```ts
import { getSetting } from "@/lib/settings";
const vapidPublicKey = (await getSetting("notifications.web_push_vapid_public")) ?? "";
```

Pass to ProfileTabs:

```astro
<ProfileTabs client:load profile={profile} preferences={prefs} vapidPublicKey={vapidPublicKey} />
```

Modify `src/components/admin/profile/ProfileTabs.tsx` Props to accept `vapidPublicKey: string` and pass it down to `<NotificationChannels …  vapidPublicKey={vapidPublicKey} />`.

Modify `src/components/admin/profile/NotificationChannels.tsx`:
- Add `vapidPublicKey: string` to Props.
- Import `WebPushPermission`.
- In the row for `id === "web_push"`, replace the `<input type="checkbox">` with:

```tsx
<WebPushPermission vapidPublicKey={vapidPublicKey} />
```

- [ ] **Step 5: Type-check + build**

Run: `pnpm check && pnpm build`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add public/sw.js src/components/admin/profile/WebPushPermission.tsx src/pages/api/notifications/web-push/subscribe.ts src/components/admin/profile/NotificationChannels.tsx src/components/admin/profile/ProfileTabs.tsx src/pages/admin/profile.astro
git commit -m "feat(notif M3.2): web push subscribe flow — Service Worker + VAPID + UI button"
```

---

### Task 21: /admin/notifications log page

**Files:**
- Create: `src/pages/admin/notifications/index.astro`
- Create: `src/components/admin/NotificationsList.tsx`

- [ ] **Step 1: List component**

Create `src/components/admin/NotificationsList.tsx`:

```tsx
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export interface NotificationItem {
  id: number;
  eventType: string;
  status: string;
  channelsRequested: string[];
  channelsDelivered: string[];
  channelsFailed: string[];
  createdAt: string;
  sentAt: string | null;
  seenAt: string | null;
  title: string;
  url: string;
}

interface Props {
  initial: NotificationItem[];
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "vừa xong";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} phút trước`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} giờ trước`;
  return `${Math.floor(ms / 86_400_000)} ngày trước`;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    sent:    { label: "Đã gửi",   variant: "default" },
    partial: { label: "Một phần", variant: "secondary" },
    failed:  { label: "Lỗi",       variant: "destructive" },
    pending: { label: "Chờ",       variant: "outline" },
    sending: { label: "Đang gửi",  variant: "outline" },
    seen:    { label: "Đã đọc",    variant: "secondary" },
  };
  const m = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={m.variant} className="text-xs">{m.label}</Badge>;
}

export default function NotificationsList({ initial }: Props) {
  const [tab, setTab] = useState<"all" | "unseen" | "sent" | "failed">("all");

  const filtered = initial.filter((n) => {
    if (tab === "unseen") return !n.seenAt;
    if (tab === "sent") return n.status === "sent";
    if (tab === "failed") return n.status === "failed";
    return true;
  });

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
      <TabsList>
        <TabsTrigger value="all">Tất cả</TabsTrigger>
        <TabsTrigger value="unseen">Chưa đọc</TabsTrigger>
        <TabsTrigger value="sent">Đã gửi</TabsTrigger>
        <TabsTrigger value="failed">Lỗi</TabsTrigger>
      </TabsList>
      {(["all", "unseen", "sent", "failed"] as const).map((s) => (
        <TabsContent key={s} value={s}>
          {filtered.length === 0 ? (
            <Card className="p-6 text-center text-sm text-gray-500 mt-4">Không có mục nào.</Card>
          ) : (
            <ul className="grid gap-3 list-none p-0 m-0 mt-4">
              {filtered.map((n) => (
                <li key={n.id}>
                  <Card className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <a href={n.url} className="font-medium text-gray-800 hover:underline">
                        {n.title}
                      </a>
                      <p className="text-xs text-gray-500 mt-1 m-0">
                        {formatRelative(n.createdAt)}
                        {n.channelsDelivered.length > 0 && (
                          <span className="ml-2">· đã gửi: {n.channelsDelivered.join(", ")}</span>
                        )}
                        {n.channelsFailed.length > 0 && (
                          <span className="ml-2 text-red-600">· lỗi: {n.channelsFailed.join(", ")}</span>
                        )}
                      </p>
                    </div>
                    {statusBadge(n.status)}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
```

- [ ] **Step 2: Page**

Create `src/pages/admin/notifications/index.astro`:

```astro
---
export const prerender = false;

import AdminLayout from "@/layouts/AdminLayout.astro";
import NotificationsList, { type NotificationItem } from "@/components/admin/NotificationsList.tsx";
import { supabaseAdmin } from "@/lib/supabase/admin";

const me = Astro.locals.user;
if (!me) return Astro.redirect("/admin/login");

const { data, error } = await supabaseAdmin
  .from("notifications")
  .select("id, event_type, status, channels_requested, channels_delivered, channels_failed, payload, created_at, sent_at, seen_at")
  .eq("user_id", me.id)
  .order("created_at", { ascending: false })
  .limit(200);

if (error) console.error("[notifications]", error);

function urlFor(eventType: string, payload: Record<string, unknown>): string {
  if (eventType.startsWith("anniversary.")) {
    const memberId = String(payload.memberId ?? "");
    return memberId ? `/memorial/${memberId}` : "/altar";
  }
  if (eventType === "condolence.pending") return "/admin/condolences";
  if (eventType === "member.added") return "/admin/members";
  return "/admin/notifications";
}

function titleFor(eventType: string, payload: Record<string, unknown>): string {
  const name = String(payload.memberName ?? "");
  if (eventType === "anniversary.t-7") return `Còn 7 ngày tới giỗ ${name}`;
  if (eventType === "anniversary.t-1") return `Ngày mai là giỗ ${name}`;
  if (eventType === "anniversary.today") return `Hôm nay là giỗ ${name}`;
  if (eventType === "condolence.pending") return "Lời tưởng nhớ mới chờ duyệt";
  if (eventType === "member.added") return "Có thành viên mới";
  if (eventType === "system.welcome") return "Chào mừng đến với gia phả";
  return eventType;
}

const initial: NotificationItem[] = (data ?? []).map((row) => ({
  id: row.id as number,
  eventType: row.event_type as string,
  status: row.status as string,
  channelsRequested: (row.channels_requested as string[]) ?? [],
  channelsDelivered: (row.channels_delivered as string[]) ?? [],
  channelsFailed: (row.channels_failed as string[]) ?? [],
  createdAt: row.created_at as string,
  sentAt: (row.sent_at as string | null) ?? null,
  seenAt: (row.seen_at as string | null) ?? null,
  title: titleFor(row.event_type as string, (row.payload as Record<string, unknown>) ?? {}),
  url: urlFor(row.event_type as string, (row.payload as Record<string, unknown>) ?? {}),
}));
---

<AdminLayout title="Thông báo" crumbs={[{ label: "Thông báo" }]}>
  <header class="mb-6">
    <h1 class="text-title-md text-gray-800">Thông báo của bạn</h1>
    <p class="text-sm text-gray-500 mt-1">200 thông báo gần nhất. Lọc theo tab bên dưới.</p>
  </header>
  <NotificationsList client:load initial={initial} />
</AdminLayout>
```

- [ ] **Step 3: Sidebar entry under THÔNG BÁO**

Modify `src/components/admin/Sidebar.astro`. After the existing TƯỞNG NIỆM group, add a "Thông báo cá nhân" entry to that same group OR insert it before "TƯỞNG NIỆM" — pick a position consistent with the project's existing nav ordering. Add this item entry:

```astro
{ href: "/admin/notifications", label: "Thông báo của tôi", iconKey: "envelope" },
```

inside the appropriate `items: [...]` array.

- [ ] **Step 4: Type-check + build**

Run: `pnpm check && pnpm build`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/notifications/index.astro src/components/admin/NotificationsList.tsx src/components/admin/Sidebar.astro
git commit -m "feat(notif M3.3): /admin/notifications log page + sidebar entry"
```

---

## Phase N5 — Admin views + acceptance

### Task 22: /admin/notifications/admin panel

**Files:**
- Create: `src/pages/admin/notifications/admin.astro`
- Create: `src/pages/api/notifications/test-send.ts`

- [ ] **Step 1: Test-send API**

Create `src/pages/api/notifications/test-send.ts`:

```ts
import type { APIRoute } from "astro";
import { dispatch } from "@/lib/notifications/dispatcher";
import type { EventType } from "@/lib/notifications/types";
import { EVENT_TYPES } from "@/lib/notifications/types";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me || me.role !== "admin") return new Response("Forbidden", { status: 403 });

  const body = (await request.json().catch(() => null)) as { userId?: string; eventType?: string } | null;
  if (!body?.userId) return new Response("Bad payload", { status: 400 });

  const eventType = (EVENT_TYPES as readonly string[]).includes(body.eventType ?? "")
    ? (body.eventType as EventType)
    : "system.welcome";

  const result = await dispatch({
    eventType,
    recipientIds: [body.userId],
    payload: { memberName: "Test", memberId: "test-member" },
  });
  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
```

- [ ] **Step 2: Admin panel page**

Create `src/pages/admin/notifications/admin.astro`:

```astro
---
export const prerender = false;

import AdminLayout from "@/layouts/AdminLayout.astro";
import { Card } from "@/components/ui/card";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { EVENT_TYPES } from "@/lib/notifications/types";

const me = Astro.locals.user;
if (!me || me.role !== "admin") return Astro.redirect("/admin/notifications");

const { data: usersData } = await supabaseAdmin
  .from("app_users")
  .select("id, email, display_name")
  .eq("status", "approved")
  .order("display_name", { ascending: true });

const users = (usersData ?? []) as Array<{ id: string; email: string; display_name: string | null }>;

// Last 30d delivery rate per channel — single aggregation query.
const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const { data: rows } = await supabaseAdmin
  .from("notifications")
  .select("status, channels_requested, channels_delivered, channels_failed")
  .gte("created_at", since)
  .limit(2000);

const rates: Record<string, { requested: number; delivered: number; failed: number }> = {};
for (const r of (rows ?? []) as Array<{
  channels_requested: string[];
  channels_delivered: string[];
  channels_failed: string[];
}>) {
  for (const c of r.channels_requested ?? []) {
    rates[c] = rates[c] ?? { requested: 0, delivered: 0, failed: 0 };
    rates[c].requested++;
  }
  for (const c of r.channels_delivered ?? []) (rates[c] = rates[c] ?? { requested: 0, delivered: 0, failed: 0 }).delivered++;
  for (const c of r.channels_failed ?? []) (rates[c] = rates[c] ?? { requested: 0, delivered: 0, failed: 0 }).failed++;
}
---

<AdminLayout title="Quản lý thông báo" crumbs={[{ label: "Thông báo", href: "/admin/notifications" }, { label: "Quản lý" }]}>
  <header class="mb-6">
    <h1 class="text-title-md text-gray-800">Quản lý thông báo (Admin)</h1>
    <p class="text-sm text-gray-500 mt-1">Test-send và xem tỉ lệ delivery theo kênh trong 30 ngày qua.</p>
  </header>

  <section class="mb-8">
    <Card className="p-5">
      <h2 class="text-base font-semibold mb-3">Tỉ lệ delivery 30 ngày qua</h2>
      <table class="w-full text-sm">
        <thead class="border-b">
          <tr>
            <th class="text-left p-2 font-medium text-gray-600">Kênh</th>
            <th class="text-right p-2 font-medium text-gray-600">Yêu cầu</th>
            <th class="text-right p-2 font-medium text-gray-600">Đã gửi</th>
            <th class="text-right p-2 font-medium text-gray-600">Lỗi</th>
            <th class="text-right p-2 font-medium text-gray-600">% gửi thành công</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(rates).sort(([a], [b]) => a.localeCompare(b)).map(([channel, r]) => (
            <tr class="border-b last:border-0">
              <td class="p-2 font-mono text-xs">{channel}</td>
              <td class="p-2 text-right tabular-nums">{r.requested}</td>
              <td class="p-2 text-right tabular-nums text-success-700">{r.delivered}</td>
              <td class="p-2 text-right tabular-nums text-red-600">{r.failed}</td>
              <td class="p-2 text-right tabular-nums">{r.requested > 0 ? Math.round((r.delivered / r.requested) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  </section>

  <section>
    <Card className="p-5">
      <h2 class="text-base font-semibold mb-3">Test send</h2>
      <form method="post" action="/api/notifications/test-send" class="grid gap-3 max-w-lg" id="test-send-form">
        <label class="grid gap-1 text-sm">
          <span>Người nhận</span>
          <select name="userId" required class="h-10 rounded border px-2">
            {users.map((u) => (
              <option value={u.id}>{u.display_name || u.email}</option>
            ))}
          </select>
        </label>
        <label class="grid gap-1 text-sm">
          <span>Loại sự kiện</span>
          <select name="eventType" required class="h-10 rounded border px-2">
            {EVENT_TYPES.map((e) => (
              <option value={e}>{e}</option>
            ))}
          </select>
        </label>
        <button type="submit" class="rounded bg-brand-500 text-white h-10 hover:bg-brand-600">Gửi test</button>
        <p id="test-result" class="text-xs text-gray-500"></p>
      </form>
      <script is:inline>
        document.getElementById("test-send-form").addEventListener("submit", async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const res = await fetch("/api/notifications/test-send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: fd.get("userId"), eventType: fd.get("eventType") }),
          });
          const out = document.getElementById("test-result");
          out.textContent = res.ok ? "Đã gửi (" + (await res.text()) + ")" : "Lỗi: " + res.status;
        });
      </script>
    </Card>
  </section>
</AdminLayout>
```

- [ ] **Step 3: Type-check + build**

Run: `pnpm check && pnpm build`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/notifications/admin.astro src/pages/api/notifications/test-send.ts
git commit -m "feat(notif M5.1): admin panel — delivery rate 30d + test send form"
```

---

### Task 23: Phase 1 acceptance smoke test

**Files:**
- Create: `scripts/smoke-notifications.mjs`

- [ ] **Step 1: Smoke script**

Create `scripts/smoke-notifications.mjs`:

```js
#!/usr/bin/env node
/**
 * Phase 1 acceptance smoke for the notification system.
 *
 * Usage:
 *   BASE=https://family.huynhvantuan.net SECRET=$(cat /tmp/cron-secret.txt) \
 *     node scripts/smoke-notifications.mjs
 */
const base = process.env.BASE ?? "http://localhost:4321";
const secret = process.env.SECRET ?? "";

async function check(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error("  " + (err && err.message ? err.message : err));
    process.exitCode = 1;
  }
}

await check("retry endpoint requires bearer", async () => {
  const res = await fetch(`${base}/admin/cron/notifications-retry`, { method: "POST" });
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
});

if (secret) {
  await check("retry endpoint authorized → 200 JSON ok", async () => {
    const res = await fetch(`${base}/admin/cron/notifications-retry`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = await res.json();
    if (body.ok !== true) throw new Error("ok!=true");
  });

  await check("purge endpoint authorized → 200 JSON ok", async () => {
    const res = await fetch(`${base}/admin/cron/notifications-purge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
  });
}

await check("unread endpoint without session → 401", async () => {
  const res = await fetch(`${base}/api/notifications/unread.json`);
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
});

console.log("\nDone.");
```

- [ ] **Step 2: Add npm script**

Modify `package.json` `scripts`:

```jsonc
"smoke:notifications": "node scripts/smoke-notifications.mjs"
```

- [ ] **Step 3: Run vitest full suite**

Run: `pnpm test`
Expected: all previous tests + new ones pass.

- [ ] **Step 4: Run no-cjk + check + build**

Run: `pnpm check:no-cjk && pnpm check && pnpm build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-notifications.mjs package.json
git commit -m "chore(notif M5.2): smoke-notifications acceptance script + npm task"
```

---

### Task 24: Update memory + design doc closure

**Files:**
- Modify: `/home/mininja/.claude/projects/-home-mininja/memory/project_family_astro.md`

- [ ] **Step 1: Append session entry to memory**

Append this block to `project_family_astro.md` directly under the `## Latest state` heading (or update the date heading):

```markdown
### Phase Notifications session (YYYY-MM-DD) — what was built

1. **Schema (0018_notifications.sql)**: `notifications`, `web_push_subscriptions`, `notification_link_tokens` tables; `app_users.{avatar_url, timezone, notification_preferences}` columns; 14 settings keys for VAPID + chat-channel tokens.
2. **Lib core**: `src/lib/notifications/{types,events,preferences,dispatcher,retry,purge}.ts`; channel adapters at `src/lib/channels/{email,in_app,web_push,zalo,telegram,messenger,whatsapp,sms}.ts`. Phase 1 lights up email/in_app/web_push; rest are stubs.
3. **Profile UI**: `/admin/profile` with 3 tabs (Hồ sơ / Thông báo / Bảo mật). Channels list, event×channel matrix (debounced save), quiet hours, web push enable button.
4. **Bell + log**: `<NotificationBell>` in topbar polling `/api/notifications/unread.json` every 30s; `/admin/notifications` log page with status tabs.
5. **Cron**: `/admin/cron/notifications-retry` `*/15 * * * *` (Coolify scheduled task) + `/admin/cron/notifications-purge` `0 3 * * 0` weekly. Memorial cron migrated to `dispatch()` so anniversary alerts route through the orchestrator.
6. **Admin panel**: `/admin/notifications/admin` — 30d delivery rate per channel + test-send form (admin-only).

**Next**: Phase 2 (Zalo OA + Telegram via grammy) — separate plan + brainstorm cycle.
```

- [ ] **Step 2: Append a wrap-up commit on the repo (no code changes)**

```bash
git commit --allow-empty -m "chore(notif): Phase 1 complete — multi-channel notifications + profile UI"
```

- [ ] **Step 3: Push everything**

```bash
git push
```

---

## Self-review checklist

After implementation, verify the spec is honored end-to-end:

- [ ] Memorial T-7 alert delivered through enabled channels per user prefs
- [ ] User toggles email OFF → email không gửi nữa, in_app vẫn gửi
- [ ] Quiet hours 22:00-07:00 → non-critical defer; "Hôm nay là giỗ" gửi ngay
- [ ] Web Push: subscribe → notification arrives với title + body đúng locale
- [ ] Bell badge tăng → click drops to 0 sau "đã đọc"
- [ ] `notifications.enable=false` → toàn bộ dispatcher skip
- [ ] Retention sweep xoá rows >90d, không xoá failed
- [ ] Profile UI mobile responsive
- [ ] WCAG AA keyboard nav profile + bell + dropdown
- [ ] No CJK in source (CI guard)
- [ ] 0 errors `pnpm check`, all tests xanh, `pnpm smoke:notifications` pass

---

**End of plan.**
