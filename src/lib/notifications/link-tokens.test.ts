import { describe, it, expect, vi } from "vitest";

const insertSpy = vi.fn(async () => ({ error: null }));
const updateSpy = vi.fn(async () => ({ error: null }));
const selectSingleSpy = vi.fn();

vi.mock("../supabase/admin", () => ({
  supabaseAdmin: {
    from: () => ({
      insert: (payload: Record<string, unknown>) => {
        insertSpy(payload);
        return Promise.resolve({ error: null });
      },
      select: () => ({
        eq: () => ({
          maybeSingle: selectSingleSpy,
        }),
      }),
      update: () => ({
        eq: () => ({
          is: updateSpy,
        }),
      }),
    }),
  },
}));

import { createLinkToken, consumeLinkToken } from "./link-tokens";

describe("createLinkToken", () => {
  it("generates a 6-char token from base32 alphabet", async () => {
    const token = await createLinkToken("user-1", "telegram");
    expect(token).toHaveLength(6);
    expect(token).toMatch(/^[A-Z2-9]+$/);
  });
});

describe("consumeLinkToken", () => {
  it("returns null for unknown token", async () => {
    selectSingleSpy.mockResolvedValueOnce({ data: null, error: null });
    expect(await consumeLinkToken("ABC123", "telegram")).toBeNull();
  });

  it("returns null when channel mismatches", async () => {
    selectSingleSpy.mockResolvedValueOnce({
      data: { user_id: "u1", channel_id: "zalo", expires_at: new Date(Date.now() + 60_000).toISOString(), consumed_at: null },
      error: null,
    });
    expect(await consumeLinkToken("ABC123", "telegram")).toBeNull();
  });

  it("returns null when token is expired", async () => {
    selectSingleSpy.mockResolvedValueOnce({
      data: { user_id: "u1", channel_id: "telegram", expires_at: new Date(Date.now() - 1000).toISOString(), consumed_at: null },
      error: null,
    });
    expect(await consumeLinkToken("ABC123", "telegram")).toBeNull();
  });

  it("returns null when token already consumed", async () => {
    selectSingleSpy.mockResolvedValueOnce({
      data: { user_id: "u1", channel_id: "telegram", expires_at: new Date(Date.now() + 60_000).toISOString(), consumed_at: new Date().toISOString() },
      error: null,
    });
    expect(await consumeLinkToken("ABC123", "telegram")).toBeNull();
  });

  it("returns user_id and marks consumed for a valid token", async () => {
    selectSingleSpy.mockResolvedValueOnce({
      data: { user_id: "u1", channel_id: "telegram", expires_at: new Date(Date.now() + 60_000).toISOString(), consumed_at: null },
      error: null,
    });
    expect(await consumeLinkToken("ABC123", "telegram")).toBe("u1");
  });
});
