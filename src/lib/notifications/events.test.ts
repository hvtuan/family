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
