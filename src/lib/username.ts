/**
 * Username ↔ email mapping. Family admin runs on Supabase Auth, which keys
 * users by email. Cô chú don't have a real shared mailbox per branch, so we
 * synthesize an email under a non-routable subdomain and let users type just
 * the username portion at login.
 *
 *   "admin"             → admin@family.huynhvantuan.net
 *   "co_hai"            → co_hai@family.huynhvantuan.net
 *   "real@email.com"    → real@email.com (passes through unchanged so a real
 *                         email can be added if needed)
 */

const USERNAME_DOMAIN = "family.huynhvantuan.net";

export function usernameToEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed}@${USERNAME_DOMAIN}`;
}

export function emailToUsername(email: string): string {
  const lower = email.toLowerCase();
  const suffix = `@${USERNAME_DOMAIN}`;
  return lower.endsWith(suffix) ? lower.slice(0, -suffix.length) : lower;
}

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{1,30}$/;

/** Returns null if valid, otherwise a Vietnamese error message. */
export function validateUsername(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "Tên đăng nhập không được để trống.";
  if (trimmed.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "Email không hợp lệ.";
    }
    return null;
  }
  if (!USERNAME_RE.test(trimmed)) {
    return "Tên đăng nhập 2–31 ký tự, chỉ chứa a-z, 0-9, dấu chấm/gạch dưới/gạch ngang.";
  }
  return null;
}
