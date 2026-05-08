/**
 * Parse FormData from MemberForm.astro into a typed MemberInput plus a list
 * of validation errors. The form has no client-side validation beyond HTML
 * required/pattern attributes — this is the single source of truth for
 * what's accepted on the server.
 */

import type { MemberInput } from "./members-admin";
import { parseCsv } from "./members-admin";

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,30}$/;

export function parseMemberForm(form: FormData): {
  input: MemberInput;
  errors: string[];
} {
  const errors: string[] = [];
  const get = (k: string) => {
    const v = form.get(k);
    return v == null ? "" : String(v).trim();
  };
  const getOpt = (k: string): string | null => {
    const v = get(k);
    return v === "" ? null : v;
  };
  const getBool = (k: string) => Boolean(form.get(k));

  const id = get("id").toLowerCase();
  if (!SLUG_RE.test(id)) {
    errors.push("ID phải là chữ thường + số + gạch ngang, độ dài 1–31.");
  }

  const genRaw = Number(get("gen"));
  const gen = Number.isInteger(genRaw) ? genRaw : 0;
  if (gen < 1 || gen > 8) errors.push("Đời (gen) phải từ 1 đến 8.");

  const branch = get("branch") as MemberInput["branch"];
  if (!["noi", "ngoai", "both"].includes(branch)) {
    errors.push("Nhánh không hợp lệ.");
  }

  const status = get("status") as MemberInput["status"];
  if (!["draft", "published"].includes(status)) {
    errors.push("Trạng thái không hợp lệ.");
  }

  const patternRaw = getOpt("pattern");
  const pattern =
    patternRaw && ["hatch", "dots", "lines", "bamboo", "glow"].includes(patternRaw)
      ? (patternRaw as MemberInput["pattern"])
      : null;

  const required = (key: string, label: string) => {
    if (!get(key)) errors.push(`${label} không được để trống.`);
  };
  required("name", "Họ tên");
  required("role", "Vai vế");
  required("born", "Năm sinh");
  required("bio", "Tiểu sử (vi)");
  required("bio_en", "Tiểu sử (en)");

  const input: MemberInput = {
    id,
    name: get("name"),
    name_en: getOpt("name_en"),
    nickname: getOpt("nickname"),
    gen,
    role: get("role"),
    role_en: getOpt("role_en"),
    is_family_head: getBool("is_family_head"),
    branch,
    born: get("born"),
    died: getOpt("died"),
    birth_place: getOpt("birth_place"),
    death_place: getOpt("death_place"),
    bio: get("bio"),
    bio_en: get("bio_en"),
    body_md: getOpt("body_md"),
    location: getOpt("location"),
    job: getOpt("job"),
    job_en: getOpt("job_en"),
    father_id: getOpt("father_id"),
    mother_id: getOpt("mother_id"),
    spouse_id: getOpt("spouse_id"),
    photo: getOpt("photo"),
    pattern,
    contact_public: getBool("contact_public"),
    phone: getOpt("phone"),
    email: getOpt("email"),
    address: getOpt("address"),
    status,
    tags: parseCsv(get("tags")),
    hobbies: parseCsv(get("hobbies")),
    // Memorial layer fields — only meaningful when died is set; the
    // MemberForm fieldset is hidden otherwise so all values come back null.
    memorial_enabled: getOpt("died") ? form.get("memorial_enabled") !== null : null,
    anniversary_calendar: (() => {
      const v = getOpt("anniversary_calendar");
      if (v === "lunar" || v === "solar" || v === "both") return v;
      return getOpt("died") ? "lunar" : null;
    })(),
    death_date_lunar: parseLunarOverride(
      getOpt("death_date_lunar_year"),
      getOpt("death_date_lunar_month"),
      getOpt("death_date_lunar_day"),
      form.get("death_date_lunar_leap") !== null
    ),
  };

  return { input, errors };
}

function parseLunarOverride(
  yRaw: string | null,
  mRaw: string | null,
  dRaw: string | null,
  isLeap: boolean
): { year: number; month: number; day: number; isLeap: boolean } | null {
  const y = yRaw ? Number(yRaw) : NaN;
  const m = mRaw ? Number(mRaw) : NaN;
  const d = dRaw ? Number(dRaw) : NaN;
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 30) return null;
  return { year: Math.floor(y), month: Math.floor(m), day: Math.floor(d), isLeap };
}
