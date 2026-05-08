/**
 * Server-side helpers for the /admin/members CRUD UI. Wraps the
 * service-role client so each handler stays focused on form parsing +
 * audit-log writes.
 */

import { supabaseAdmin } from "./supabase/admin";

export type MemberRow = {
  id: string;
  name: string;
  name_en: string | null;
  nickname: string | null;
  gen: number;
  role: string;
  role_en: string | null;
  is_family_head: boolean;
  branch: "noi" | "ngoai" | "both";
  born: string;
  died: string | null;
  birth_place: string | null;
  death_place: string | null;
  bio: string;
  bio_en: string;
  body_md: string | null;
  location: string | null;
  job: string | null;
  job_en: string | null;
  father_id: string | null;
  mother_id: string | null;
  spouse_id: string | null;
  photo: string | null;
  pattern: "hatch" | "dots" | "lines" | "bamboo" | "glow" | null;
  contact_public: boolean;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: "draft" | "published";
  tags: string[];
  hobbies: string[];
  // Memorial layer (0017_memorial.sql) — only meaningful when died is set.
  memorial_enabled?: boolean | null;
  anniversary_calendar?: "lunar" | "solar" | "both" | null;
  death_date_lunar?: { year: number; month: number; day: number; isLeap: boolean } | null;
  created_at: string;
  updated_at: string;
};

export type MemberInput = Omit<
  MemberRow,
  "created_at" | "updated_at"
>;

export type ListItem = Pick<
  MemberRow,
  "id" | "name" | "name_en" | "gen" | "role" | "branch" | "born" | "died"
  | "photo" | "status" | "is_family_head" | "phone" | "email"
>;

export async function listMembers(): Promise<ListItem[]> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select(
      "id, name, name_en, gen, role, branch, born, died, photo, status, is_family_head, phone, email",
    )
    .order("gen", { ascending: true })
    .order("born", { ascending: true });
  if (error) throw new Error(`listMembers: ${error.message}`);
  return (data ?? []) as ListItem[];
}

export async function getMember(id: string): Promise<MemberRow | null> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getMember: ${error.message}`);
  return (data ?? null) as MemberRow | null;
}

/** Compact list (id, name, gen) for the parent/spouse selectors. */
export async function listMemberRefs(): Promise<
  { id: string; name: string; gen: number }[]
> {
  const { data, error } = await supabaseAdmin
    .from("members")
    .select("id, name, gen")
    .order("gen", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw new Error(`listMemberRefs: ${error.message}`);
  return (data ?? []) as { id: string; name: string; gen: number }[];
}

export async function deleteMember(id: string): Promise<void> {
  // member_children rows fan out via FK ON DELETE CASCADE; father_id /
  // mother_id / spouse_id on other members ON DELETE SET NULL. Safe to
  // delete the row directly.
  const { error } = await supabaseAdmin.from("members").delete().eq("id", id);
  if (error) throw new Error(`deleteMember: ${error.message}`);
}

export async function upsertMember(
  input: MemberInput,
  mode: "create" | "update",
  actorId: string,
): Promise<void> {
  const row = {
    ...input,
    [mode === "create" ? "created_by" : "updated_by"]: actorId,
    updated_at: new Date().toISOString(),
  };

  if (mode === "create") {
    const { error } = await supabaseAdmin.from("members").insert(row);
    if (error) throw new Error(`createMember: ${error.message}`);
  } else {
    const { error } = await supabaseAdmin
      .from("members")
      .update(row)
      .eq("id", input.id);
    if (error) throw new Error(`updateMember: ${error.message}`);
  }
}

/** Refresh `member_children` so it matches `father_id` + `mother_id`
 *  across the whole table. Cheap (4 rows today) and avoids race-y
 *  per-row delta logic. */
export async function syncMemberChildren(): Promise<void> {
  const { data: rows, error: selErr } = await supabaseAdmin
    .from("members")
    .select("id, father_id, mother_id");
  if (selErr) throw new Error(`syncMemberChildren select: ${selErr.message}`);

  const desired: { parent_id: string; child_id: string }[] = [];
  for (const r of (rows ?? []) as {
    id: string;
    father_id: string | null;
    mother_id: string | null;
  }[]) {
    if (r.father_id) desired.push({ parent_id: r.father_id, child_id: r.id });
    if (r.mother_id) desired.push({ parent_id: r.mother_id, child_id: r.id });
  }

  // Upsert all desired pairs; ignore conflicts on the composite PK.
  if (desired.length > 0) {
    const { error: upErr } = await supabaseAdmin
      .from("member_children")
      .upsert(desired, { onConflict: "parent_id,child_id" });
    if (upErr) {
      throw new Error(`syncMemberChildren upsert: ${upErr.message}`);
    }
  }

  // Drop any stale pairs whose (parent, child) tuple is no longer derivable.
  const { data: existing, error: existErr } = await supabaseAdmin
    .from("member_children")
    .select("parent_id, child_id");
  if (existErr) {
    throw new Error(`syncMemberChildren existing: ${existErr.message}`);
  }
  const desiredKey = new Set(desired.map((d) => `${d.parent_id}|${d.child_id}`));
  const stale = ((existing ?? []) as { parent_id: string; child_id: string }[])
    .filter((e) => !desiredKey.has(`${e.parent_id}|${e.child_id}`));
  for (const s of stale) {
    await supabaseAdmin
      .from("member_children")
      .delete()
      .eq("parent_id", s.parent_id)
      .eq("child_id", s.child_id);
  }
}

/** Parse a comma-separated input into a trimmed string array. */
export function parseCsv(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Format a string array as a comma-separated input value. */
export function formatCsv(value: string[] | null | undefined): string {
  return (value ?? []).join(", ");
}
