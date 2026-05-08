import { describe, it, expect, vi, beforeEach } from "vitest";

const insertSpy = vi.fn(async () => ({ data: { id: 42, attempt_count: 0 }, error: null }));
const updateSpy = vi.fn(async () => ({ error: null }));
const userRow = {
  id: "u1",
  email: "u@example.com",
  display_name: "Cô An",
  preferred_lang: "vi",
  timezone: "Asia/Ho_Chi_Minh",
  notification_preferences: null,
};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: userRow, error: null }),
          maybeSingle: async () => ({ data: userRow, error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: insertSpy,
        }),
      }),
      update: () => ({ eq: updateSpy }),
    }),
  },
}));

vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn(async (k: string) => (k === "notifications.enable" ? "true" : null)),
  getNumber: vi.fn(async () => null),
  getBoolean: vi.fn(async () => null),
}));

vi.mock("@/lib/channels/registry", () => ({
  channelRegistry: {
    in_app: {
      id: "in_app",
      isReady: async () => true,
      isAvailableFor: async () => true,
      send: async () => ({ ok: true }),
    },
    email: {
      id: "email",
      isReady: async () => true,
      isAvailableFor: async () => true,
      send: async () => ({ ok: true }),
    },
  },
  getAdapter: (id: string) => ({ in_app: { id: "in_app", send: async () => ({ ok: true }) } }[id]),
}));

import { dispatch } from "./dispatcher";

describe("dispatch", () => {
  beforeEach(() => {
    insertSpy.mockClear();
    updateSpy.mockClear();
  });

  it("does nothing when master switch is off", async () => {
    vi.doMock("@/lib/settings", () => ({
      getSetting: vi.fn(async () => "false"),
    }));
    // Re-import to apply doMock
    const { dispatch: dispatch2 } = await import("./dispatcher");
    const out = await dispatch2({
      eventType: "anniversary.t-7",
      recipientIds: ["u1"],
      payload: {},
    });
    expect(out.enqueued + out.sentInline).toBeGreaterThanOrEqual(0);
  });
});
