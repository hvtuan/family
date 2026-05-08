/**
 * Anniversary engine — computes upcoming giỗ dates for deceased members.
 *
 * Each member.anniversary_calendar drives whether we look at lunar
 * (default — VN tradition), solar, or both. For lunar mode, the next
 * solar date matching the member's lunar (month, day) of death is what
 * the cron + banner key off.
 */
import { getDeceasedMembers, type MemorialMember } from "./memorial";
import { nextSolarOfLunar } from "./lunar";

export type Anniversary = {
  member: MemorialMember;
  type: "lunar" | "solar";
  year: number;          // dương-lịch year of the next occurrence
  date: Date;            // dương-lịch date of the next occurrence
  daysUntil: number;     // negative → already passed (not returned in default queries)
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * All members' next anniversary occurrences, filtered by withinDays.
 * Returns sorted by daysUntil ascending. By default returns ≤30d.
 */
export async function getUpcomingAnniversaries(opts: { withinDays?: number } = {}): Promise<Anniversary[]> {
  const within = opts.withinDays ?? 30;
  const today = startOfToday();
  const todayMs = today.getTime();

  const deceased = await getDeceasedMembers();
  const occurrences: Anniversary[] = [];

  for (const member of deceased) {
    if (!member.memorialEnabled) continue;
    for (const occ of computeNextOccurrences(member, today)) {
      const daysUntil = Math.round((occ.date.getTime() - todayMs) / DAY_MS);
      if (daysUntil < 0) continue;
      if (daysUntil > within) continue;
      occurrences.push({ ...occ, daysUntil });
    }
  }

  return occurrences.sort((a, b) => a.daysUntil - b.daysUntil);
}

/**
 * Lookahead per member — next N years of occurrences (used on
 * /memorial/[id] footer + admin lịch giỗ). Always returns daysUntil >= 0.
 */
export async function getAnniversariesForMember(
  memberId: string,
  lookAheadYears = 5
): Promise<Anniversary[]> {
  const deceased = await getDeceasedMembers();
  const member = deceased.find((m) => m.id === memberId);
  if (!member) return [];

  const today = startOfToday();
  const todayMs = today.getTime();
  const out: Anniversary[] = [];

  let cursor = today;
  for (let i = 0; i < lookAheadYears; i++) {
    for (const occ of computeNextOccurrences(member, cursor)) {
      const daysUntil = Math.round((occ.date.getTime() - todayMs) / DAY_MS);
      if (daysUntil < 0) continue;
      out.push({ ...occ, daysUntil });
    }
    // Step cursor 366 days forward so the next call resolves the year
    // after the one we just emitted.
    cursor = new Date(cursor.getTime() + 366 * DAY_MS);
  }

  // De-duplicate (lunar + solar might collapse to the same dương date)
  const seen = new Set<string>();
  const dedup = out.filter((occ) => {
    const key = `${occ.type}:${occ.date.toISOString().slice(0, 10)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return dedup.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Compute the next-occurrence(s) for a single member. Returns one item
 * for lunar/solar mode, two for "both" mode.
 */
function computeNextOccurrences(
  member: MemorialMember,
  fromDate: Date
): Array<Omit<Anniversary, "daysUntil">> {
  const out: Array<Omit<Anniversary, "daysUntil">> = [];
  const calendar = member.anniversaryCalendar;

  if (calendar === "lunar" || calendar === "both") {
    const date = nextSolarOfLunar(
      member.deathDateLunar.month,
      member.deathDateLunar.day,
      fromDate
    );
    out.push({ member, type: "lunar", year: date.getFullYear(), date });
  }

  if (calendar === "solar" || calendar === "both") {
    const date = nextSolarYearlyOf(member.deathDate, fromDate);
    out.push({ member, type: "solar", year: date.getFullYear(), date });
  }

  return out;
}

function nextSolarYearlyOf(deathDate: Date, fromDate: Date): Date {
  const month = deathDate.getMonth();
  const day = deathDate.getDate();
  let year = fromDate.getFullYear();
  let candidate = new Date(year, month, day);
  candidate.setHours(0, 0, 0, 0);
  if (candidate.getTime() < startOfDay(fromDate).getTime()) {
    year += 1;
    candidate = new Date(year, month, day);
    candidate.setHours(0, 0, 0, 0);
  }
  return candidate;
}

function startOfToday(): Date {
  return startOfDay(new Date());
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
