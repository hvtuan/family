import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(async (key: string) => {
    if (key === "notifications.web_push_vapid_public") return "PUB";
    if (key === "notifications.web_push_vapid_private") return "PRIV";
    if (key === "smtp.from_email") return "noreply@example.com";
    return null;
  }),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn(async () => ({ statusCode: 201 })),
  },
}));

vi.mock("@/lib/notifications/events", () => ({
  getEventDescriptor: vi.fn(),
  renderEventForChannel: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          data: [
            { id: 1, endpoint: "https://push.example/abc", p256dh: "p", auth: "a" },
          ],
          error: null,
        }),
      }),
    }),
  },
}));

import { webPushAdapter } from "./web_push";

describe("webPushAdapter", () => {
  it("isReady returns true when both VAPID keys set", async () => {
    expect(await webPushAdapter.isReady()).toBe(true);
  });
});
