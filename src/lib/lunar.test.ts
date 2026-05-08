/**
 * Golden tests for lunar / solar conversion.
 *
 * The expected values are cross-verified with multiple references:
 *   - amlich.com (popular VN lunar calendar)
 *   - lunar-typescript's own published examples
 *   - The Vietnamese Tết (lunar New Year) dates which are public knowledge
 */
import { describe, it, expect } from "vitest";
import {
  solarToLunar,
  lunarToSolar,
  nextSolarOfLunar,
  ganZhiOfYearVi,
  formatLunarVi,
  formatLunarShortVi,
} from "./lunar";

describe("solarToLunar", () => {
  it("Vietnamese Tết 2024 (Giáp Thìn) — 10 Feb 2024 dương = mồng 1 tháng Giêng năm Giáp Thìn", () => {
    const lunar = solarToLunar(new Date(2024, 1, 10));
    expect(lunar.year).toBe(2024);
    expect(lunar.month).toBe(1);
    expect(lunar.day).toBe(1);
    expect(lunar.isLeap).toBe(false);
  });

  it("Vietnamese Tết 2025 (Ất Tỵ) — 29 Jan 2025 = mồng 1 tháng Giêng năm Ất Tỵ", () => {
    const lunar = solarToLunar(new Date(2025, 0, 29));
    expect(lunar.year).toBe(2025);
    expect(lunar.month).toBe(1);
    expect(lunar.day).toBe(1);
  });

  it("Trung Thu 2024 — 17 Sep 2024 = Rằm tháng 8", () => {
    const lunar = solarToLunar(new Date(2024, 8, 17));
    expect(lunar.month).toBe(8);
    expect(lunar.day).toBe(15);
  });
});

describe("lunarToSolar", () => {
  it("round-trip: solar → lunar → solar preserves the date", () => {
    const solar = new Date(2024, 5, 15);
    const lunar = solarToLunar(solar);
    const back = lunarToSolar(lunar);
    expect(back.getFullYear()).toBe(solar.getFullYear());
    expect(back.getMonth()).toBe(solar.getMonth());
    expect(back.getDate()).toBe(solar.getDate());
  });
});

describe("nextSolarOfLunar", () => {
  it("returns a date >= fromDate", () => {
    const from = new Date(2026, 0, 1);
    const next = nextSolarOfLunar(7, 15, from); // Rằm tháng 7
    expect(next.getTime()).toBeGreaterThanOrEqual(from.getTime());
  });

  it("rolls forward to next lunar year if the date already passed this year", () => {
    const from = new Date(2026, 11, 31); // 31 Dec 2026
    const next = nextSolarOfLunar(1, 1, from); // mồng 1 tháng Giêng
    expect(next.getFullYear()).toBeGreaterThanOrEqual(2027);
  });
});

describe("ganZhiOfYearVi", () => {
  // Reference values verified against amlich.com and Wikipedia.
  it.each([
    [2024, "Giáp Thìn"],
    [2025, "Ất Tỵ"],
    [2026, "Bính Ngọ"],
    [2027, "Đinh Mùi"],
    [1988, "Mậu Thìn"],
    [1864, "Giáp Tý"],
  ])("year %d → %s", (year, expected) => {
    expect(ganZhiOfYearVi(year)).toBe(expected);
  });
});

describe("formatLunarVi", () => {
  it("formats Rằm tháng 2 năm Mậu Thìn", () => {
    const out = formatLunarVi({ year: 1988, month: 2, day: 15, isLeap: false });
    expect(out).toBe("Rằm tháng Hai năm Mậu Thìn");
  });

  it("formats Mồng Một tháng Giêng năm Giáp Thìn", () => {
    const out = formatLunarVi({ year: 2024, month: 1, day: 1, isLeap: false });
    expect(out).toBe("Mồng Một tháng Giêng năm Giáp Thìn");
  });

  it("marks leap month", () => {
    const out = formatLunarVi({ year: 2025, month: 6, day: 10, isLeap: true });
    expect(out).toContain("(nhuận)");
  });
});

describe("formatLunarShortVi", () => {
  it("compact form 15/2 Âm", () => {
    expect(formatLunarShortVi({ year: 1988, month: 2, day: 15, isLeap: false })).toBe(
      "15/2 Âm"
    );
  });
});
