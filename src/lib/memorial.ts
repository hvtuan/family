/**
 * Memorial query layer — read-only views over family.members combined
 * with incense + condolence counts. Used by /memorial/[id], /altar, and
 * the homepage banner.
 *
 * Two small in-memory caches mirror src/lib/settings.ts: TTL 60s,
 * invalidated by revalidate() on data change. Scale ≤100 deceased rows
 * so a full-table read is cheap.
 */
import { supabaseAdmin } from "./supabase/admin";
import { getMembers } from "./content";
import { toClientMember, type ClientMember } from "./members-client";
import { solarToLunar, type LunarDate } from "./lunar";
import { getNumber } from "./settings";
import type { Anniversary } from "./anniversary";

export type MemorialMember = ClientMember & {
  deathDate: Date;
  deathDateLunar: LunarDate;
  memorialEnabled: boolean;
  anniversaryCalendar: "lunar" | "solar" | "both";
  incenseCountThisYear: number;
  photoUrl: string | null;
};

const CACHE_TTL_MS = 60 * 1000;
let deceasedCache: { rows: MemorialMember[]; loadedAt: number } | null = null;
let bannerCache: { value: Anniversary | null; loadedAt: number } | null = null;

export function revalidateMemorialCache(): void {
  deceasedCache = null;
  bannerCache = null;
}

/**
 * All deceased members eligible for memorial pages, augmented with
 * incense count for the current anniversary year.
 */
export async function getDeceasedMembers(): Promise<MemorialMember[]> {
  if (deceasedCache && Date.now() - deceasedCache.loadedAt < CACHE_TTL_MS) {
    return deceasedCache.rows;
  }

  const entries = await getMembers((m) => Boolean(m.data.died));
  const memberIds = entries.map((e) => e.data.id);

  const [extras, counts] = await Promise.all([
    fetchMemorialExtras(memberIds),
    fetchIncenseCounts(memberIds, new Date().getFullYear()),
  ]);

  const rows: MemorialMember[] = [];
  for (const entry of entries) {
    const client = toClientMember(entry);
    const extra = extras.get(entry.data.id);
    if (!entry.data.died) continue;
    const deathDate = new Date(entry.data.died);
    if (Number.isNaN(deathDate.getTime())) continue;

    const lunarOverride = extra?.deathDateLunar ?? null;
    rows.push({
      ...client,
      deathDate,
      deathDateLunar: lunarOverride ?? solarToLunar(deathDate),
      memorialEnabled: extra?.memorialEnabled ?? true,
      anniversaryCalendar: extra?.anniversaryCalendar ?? "lunar",
      incenseCountThisYear: counts.get(entry.data.id) ?? 0,
      photoUrl: entry.data.photo ?? null,
    });
  }

  deceasedCache = { rows, loadedAt: Date.now() };
  return rows;
}

export async function getMemorialMember(id: string): Promise<MemorialMember | null> {
  const all = await getDeceasedMembers();
  return all.find((m) => m.id === id) ?? null;
}

/**
 * Active homepage banner — the soonest upcoming anniversary within
 * `memorial.banner_days_before` days. Returns null if none.
 */
export async function getActiveBanner(): Promise<Anniversary | null> {
  if (bannerCache && Date.now() - bannerCache.loadedAt < CACHE_TTL_MS) {
    return bannerCache.value;
  }
  const days = (await getNumber("memorial.banner_days_before")) ?? 7;
  const { getUpcomingAnniversaries } = await import("./anniversary");
  const upcoming = await getUpcomingAnniversaries({ withinDays: days });
  const value = upcoming[0] ?? null;
  bannerCache = { value, loadedAt: Date.now() };
  return value;
}

type MemorialExtra = {
  memorialEnabled: boolean;
  anniversaryCalendar: "lunar" | "solar" | "both";
  deathDateLunar: LunarDate | null;
};

async function fetchMemorialExtras(memberIds: string[]): Promise<Map<string, MemorialExtra>> {
  if (memberIds.length === 0) return new Map();
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id, memorial_enabled, anniversary_calendar, death_date_lunar")
    .in("id", memberIds);
  if (error) throw error;
  const out = new Map<string, MemorialExtra>();
  for (const row of data ?? []) {
    out.set(row.id as string, {
      memorialEnabled: row.memorial_enabled !== false,
      anniversaryCalendar: (row.anniversary_calendar ?? "lunar") as "lunar" | "solar" | "both",
      deathDateLunar: (row.death_date_lunar as LunarDate | null) ?? null,
    });
  }
  return out;
}

async function fetchIncenseCounts(memberIds: string[], year: number): Promise<Map<string, number>> {
  if (memberIds.length === 0) return new Map();
  const { data, error } = await supabaseAdmin
    .from("incense_events")
    .select("member_id")
    .in("member_id", memberIds)
    .eq("anniversary_year", year);
  if (error) throw error;

  const out = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.member_id as string;
    out.set(id, (out.get(id) ?? 0) + 1);
  }
  return out;
}
