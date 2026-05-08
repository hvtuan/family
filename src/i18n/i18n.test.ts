import { describe, it, expect } from "vitest";
import { t, pickLocale, type Localized } from "./index";

describe("t", () => {
  it("returns Vietnamese string for known key", () => {
    expect(t("memorial.incenseButton", "vi")).toBe("Thắp một nén tâm hương");
  });

  it("falls back to vi when en is missing", () => {
    // memorial.seal exists in vi only
    expect(t("memorial.seal" as never, "en", { surname: "Nguyễn" })).toBe("Họ Nguyễn");
  });

  it("interpolates {var} placeholders", () => {
    expect(t("memorial.bannerDays", "vi", { days: 5, name: "Cụ Tổ" })).toBe(
      "Còn 5 ngày đến giỗ Cụ Tổ"
    );
  });

  it("returns the key itself when missing in both locales", () => {
    expect(t("missing.key" as never, "vi")).toBe("missing.key");
  });
});

describe("pickLocale", () => {
  it("prefers requested locale", () => {
    const v: Localized<string> = { vi: "Xin chào", en: "Hello" };
    expect(pickLocale(v, "en")).toBe("Hello");
    expect(pickLocale(v, "vi")).toBe("Xin chào");
  });

  it("falls back to vi when locale missing", () => {
    const v: Localized<string> = { vi: "Xin chào" };
    expect(pickLocale(v, "en")).toBe("Xin chào");
  });

  it("falls back to first available value", () => {
    const v = { en: "Hello" } as Localized<string>;
    expect(pickLocale(v, "vi")).toBe("Hello");
  });

  it("returns fallback when value is null/undefined", () => {
    expect(pickLocale(undefined, "vi", "default")).toBe("default");
  });
});
