/**
 * Replace the m2m rows for one parent with a fresh set of child ids.
 * Used by timeline_members, photo_members, location_members.
 *
 * Service-role only — relies on bypassing RLS.
 */

import { supabaseAdmin } from "./supabase/admin";

export async function replaceM2M(args: {
  table: "timeline_members" | "photo_members" | "location_members";
  parentCol: string;
  childCol: string;
  parentId: string | number;
  childIds: string[];
}): Promise<void> {
  const { table, parentCol, childCol, parentId, childIds } = args;

  // Wipe the existing rows for this parent.
  const { error: delErr } = await supabaseAdmin
    .from(table)
    .delete()
    .eq(parentCol, parentId);
  if (delErr) throw new Error(`replaceM2M delete ${table}: ${delErr.message}`);

  if (childIds.length === 0) return;

  const rows = childIds.map((cid) => ({
    [parentCol]: parentId,
    [childCol]: cid,
  }));
  const { error: insErr } = await supabaseAdmin.from(table).insert(rows);
  if (insErr) throw new Error(`replaceM2M insert ${table}: ${insErr.message}`);
}

/** Read child ids for one parent. */
export async function readM2M(args: {
  table: "timeline_members" | "photo_members" | "location_members";
  parentCol: string;
  childCol: string;
  parentId: string | number;
}): Promise<string[]> {
  const { table, parentCol, childCol, parentId } = args;
  const { data, error } = await supabaseAdmin
    .from(table)
    .select(childCol)
    .eq(parentCol, parentId);
  if (error) throw new Error(`readM2M ${table}: ${error.message}`);
  return ((data ?? []) as unknown as Record<string, string>[]).map((r) => r[childCol]);
}
