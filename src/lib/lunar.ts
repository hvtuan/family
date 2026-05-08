/**
 * Lunar / solar calendar conversion for Vietnamese giỗ (death anniversary).
 *
 * Wraps lunar-typescript with a Vietnamese-friendly surface:
 *   - All output strings use Quốc ngữ Vietnamese (Mậu Thìn, Rằm tháng 2…).
 *     The underlying lib emits Chinese text we never expose to the UI.
 *   - Leap months are represented as { isLeap: true } rather than a
 *     negative month sign.
 *   - nextSolarOfLunar(month, day, from) computes the next dương-lịch
 *     date that matches a given lunar (month, day) — used by the
 *     anniversary engine.
 */
import { Lunar } from "lunar-typescript";

export type LunarDate = {
  year: number;
  month: number; // 1..12
  day: number; // 1..30
  isLeap: boolean;
};

/** Thiên can — 10 heavenly stems (Vietnamese). */
const CAN_VI = [
  "Giáp", "Ất", "Bính", "Đinh", "Mậu",
  "Kỷ",   "Canh", "Tân", "Nhâm", "Quý",
] as const;

/** Địa chi — 12 earthly branches (Vietnamese). */
const CHI_VI = [
  "Tý",   "Sửu", "Dần", "Mão", "Thìn", "Tỵ",
  "Ngọ",  "Mùi", "Thân", "Dậu", "Tuất", "Hợi",
] as const;

/** Lunar month names (Vietnamese: tháng Giêng / tháng Hai / … / tháng Chạp). */
const LUNAR_MONTH_VI = [
  "Giêng", "Hai", "Ba", "Bốn", "Năm", "Sáu",
  "Bảy",   "Tám", "Chín", "Mười", "Mười Một", "Chạp",
] as const;

/** Special lunar day names that traditionally replace the numeric day. */
const SPECIAL_DAY_VI: Record<number, string> = {
  1: "Mồng Một",
  15: "Rằm",
};

export function solarToLunar(date: Date): LunarDate {
  const lunar = Lunar.fromDate(date);
  const month = lunar.getMonth();
  return {
    year: lunar.getYear(),
    month: Math.abs(month),
    day: lunar.getDay(),
    isLeap: month < 0,
  };
}

export function lunarToSolar(l: LunarDate): Date {
  const lunarMonth = l.isLeap ? -l.month : l.month;
  const lunar = Lunar.fromYmd(l.year, lunarMonth, l.day);
  const solar = lunar.getSolar();
  return new Date(solar.getYear(), solar.getMonth() - 1, solar.getDay());
}

/**
 * Compute the next solar date matching a given lunar (month, day) — i.e.
 * the next ngày giỗ on the dương-lịch calendar.
 *
 * Searches up to 3 lunar years ahead, prefers non-leap matches when both
 * exist in a given year. Returns the earliest solar date >= fromDate.
 */
export function nextSolarOfLunar(
  lunarMonth: number,
  lunarDay: number,
  fromDate: Date = new Date()
): Date {
  const fromMs = startOfDay(fromDate).getTime();
  const startLunarYear = solarToLunar(fromDate).year;

  for (let yOffset = 0; yOffset < 4; yOffset++) {
    const lunarYear = startLunarYear + yOffset;
    for (const isLeap of [false, true]) {
      try {
        const candidate = lunarToSolar({
          year: lunarYear,
          month: lunarMonth,
          day: lunarDay,
          isLeap,
        });
        if (candidate.getTime() >= fromMs) {
          return candidate;
        }
      } catch {
        // Lunar month/day combination doesn't exist in this lunar year.
      }
    }
  }

  throw new Error(
    `Could not find next solar date for lunar ${lunarMonth}/${lunarDay} after ${fromDate.toISOString()}`
  );
}

/** Format the can-chi (e.g. "Mậu Thìn") for a given lunar year. */
export function ganZhiOfYearVi(lunarYear: number): string {
  // Reference epoch: lunar year 1864 = Giáp Tý (gan=0, zhi=0).
  const ganIndex = mod(lunarYear - 1864, 10);
  const zhiIndex = mod(lunarYear - 1864, 12);
  return `${CAN_VI[ganIndex]} ${CHI_VI[zhiIndex]}`;
}

/** "Rằm tháng Hai năm Mậu Thìn" — full Vietnamese lunar date phrase. */
export function formatLunarVi(l: LunarDate): string {
  const dayLabel = SPECIAL_DAY_VI[l.day] ?? `mồng ${l.day}`;
  const monthLabel = LUNAR_MONTH_VI[l.month - 1] ?? String(l.month);
  const leap = l.isLeap ? " (nhuận)" : "";
  return `${dayLabel} tháng ${monthLabel}${leap} năm ${ganZhiOfYearVi(l.year)}`;
}

/** Short form: "15/2 Âm" — for compact display next to solar dates. */
export function formatLunarShortVi(l: LunarDate): string {
  const leap = l.isLeap ? " nhuận" : "";
  return `${l.day}/${l.month}${leap} Âm`;
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
