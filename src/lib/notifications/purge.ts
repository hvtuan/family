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
