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
