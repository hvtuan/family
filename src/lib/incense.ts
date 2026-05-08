/**
 * "Thắp một nén tâm hương" — incense events.
 *
 * Anonymous public visitors submit name + optional message. We hash the
 * IP for rate-limiting (no raw IP storage). Counter is per-anniversary
 * year so each yearly giỗ has its own tally.
 */
import { createHash } from "node:crypto";
import { supabaseAdmin } from "./supabase/admin";
import { getNumber, getBoolean } from "./settings";
import type { Localized } from "@/i18n";
import { revalidateMemorialCache } from "./memorial";

export type IncenseEntry = {
  id: number;
  visitorName: string;
  message: Localized<string> | null;
  createdAt: Date;
};

export type RecordIncenseInput = {
  memberId: string;
  visitorName: string;
  message?: Localized<string>;
  ipHash: string;
  anniversaryYear?: number;
};

export type RecordIncenseResult =
  | { ok: true; id: number }
  | { ok: false; reason: "rate_limit" | "memorial_disabled" | "invalid" };

export async function recordIncense(input: RecordIncenseInput): Promise<RecordIncenseResult> {
  const enabled = (await getBoolean("memorial.enable")) ?? true;
  if (!enabled) return { ok: false, reason: "memorial_disabled" };

  const visitorName = input.visitorName.trim();
  if (!visitorName || visitorName.length > 80) return { ok: false, reason: "invalid" };

  const limit = (await getNumber("memorial.incense_rate_limit_per_hour")) ?? 5;
  const recent = await countRecentByIp(input.ipHash, 60 * 60 * 1000);
  if (recent >= limit) return { ok: false, reason: "rate_limit" };

  const anniversaryYear = input.anniversaryYear ?? new Date().getFullYear();
  const message = sanitizeMessage(input.message);

  const { data, error } = await supabaseAdmin
    .from("incense_events")
    .insert({
      member_id: input.memberId,
      anniversary_year: anniversaryYear,
      visitor_name: visitorName,
      message,
      ip_hash: input.ipHash,
    })
    .select("id")
    .single();

  if (error) return { ok: false, reason: "invalid" };
  revalidateMemorialCache();
  return { ok: true, id: data.id as number };
}

export async function listIncenseForMember(
  memberId: string,
  anniversaryYear: number,
  opts: { limit?: number; offset?: number } = {}
): Promise<IncenseEntry[]> {
  const { data, error } = await supabaseAdmin
    .from("incense_events")
    .select("id, visitor_name, message, created_at")
    .eq("member_id", memberId)
    .eq("anniversary_year", anniversaryYear)
    .order("created_at", { ascending: false })
    .range(opts.offset ?? 0, (opts.offset ?? 0) + (opts.limit ?? 50) - 1);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as number,
    visitorName: row.visitor_name as string,
    message: (row.message as Localized<string> | null) ?? null,
    createdAt: new Date(row.created_at as string),
  }));
}

export async function countIncenseForMember(memberId: string, anniversaryYear: number): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("incense_events")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("anniversary_year", anniversaryYear);
  if (error) throw error;
  return count ?? 0;
}

/** Hash an IP into a stable opaque string. Pass through any IP-like input. */
export function hashIp(ip: string, salt = process.env.INCENSE_IP_SALT ?? "family-default-salt"): string {
  return createHash("sha256").update(`${ip}|${salt}`).digest("hex").slice(0, 32);
}

async function countRecentByIp(ipHash: string, windowMs: number): Promise<number> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabaseAdmin
    .from("incense_events")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if (error) throw error;
  return count ?? 0;
}

function sanitizeMessage(message: Localized<string> | undefined): Localized<string> | null {
  if (!message) return null;
  const cleaned: Localized<string> = {};
  for (const [k, v] of Object.entries(message) as Array<[keyof Localized<string>, string | undefined]>) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim().slice(0, 200);
    if (trimmed) cleaned[k] = trimmed;
  }
  return Object.keys(cleaned).length === 0 ? null : cleaned;
}
