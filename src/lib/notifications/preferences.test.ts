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
