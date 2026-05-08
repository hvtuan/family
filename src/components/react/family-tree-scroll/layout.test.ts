import { describe, it, expect } from "vitest";
import { computeLayout } from "./layout";
import type { ClientMember } from "@/lib/members-client";

const m = (overrides: Partial<ClientMember>): ClientMember => ({
  id: "x", name: "X", gen: 1, role: "Tổ", roleEn: "Founder",
  isFamilyHead: false, born: "1900", died: null,
  bio: "", bioEn: "", hobbies: [], children: [],
  achievements: [], anecdotes: [], tags: [],
  ...overrides,
} as ClientMember);

describe("computeLayout", () => {
  it("returns empty rows for empty input", () => {
    expect(computeLayout([])).toEqual([]);
  });

  it("groups by gen ascending", () => {
    const rows = computeLayout([
      m({ id: "a", gen: 2 }),
      m({ id: "b", gen: 1 }),
      m({ id: "c", gen: 3 }),
    ]);
    expect(rows.map((r) => r.gen)).toEqual([1, 2, 3]);
  });

  it("pairs spouse couples into single units", () => {
    const rows = computeLayout([
      m({ id: "a", gen: 2, spouse: "b" }),
      m({ id: "b", gen: 2, spouse: "a" }),
    ]);
    expect(rows[0].units).toHaveLength(1);
    expect(rows[0].units[0].anchor.id).toBe("a");
    expect(rows[0].units[0].spouse?.id).toBe("b");
  });

  it("orders units by anchor birth_order", () => {
    const rows = computeLayout([
      m({ id: "a", gen: 1, birthOrder: 3 }),
      m({ id: "b", gen: 1, birthOrder: 1 }),
      m({ id: "c", gen: 1, birthOrder: 2 }),
    ]);
    expect(rows[0].units.map((u) => u.anchor.id)).toEqual(["b", "c", "a"]);
  });

  it("links parent unit to child unit via father/mother", () => {
    const rows = computeLayout([
      m({ id: "p", gen: 1 }),
      m({ id: "c", gen: 2, father: "p" }),
    ]);
    expect(rows[0].units[0].childIds).toEqual(["c"]);
  });
});
