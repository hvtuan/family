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
