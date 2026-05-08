/**
 * "Lời tưởng nhớ" — public condolence submissions with admin moderation.
 *
 * Public flow: visitor submits anonymous (name + relation + body) →
 * status='pending' → admin reviews at /admin/condolences → status
 * becomes 'approved' (visible) or 'rejected' (hidden).
 *
 * If `memorial.condolences_require_approval=false` the new submission
 * goes straight to 'approved'.
 */
import { supabaseAdmin } from "./supabase/admin";
import { getBoolean } from "./settings";
import { logAudit } from "./audit";
import type { Localized } from "@/i18n";

export type CondolenceStatus = "pending" | "approved" | "rejected";

export type Condolence = {
  id: number;
  memberId: string;
  visitorName: string;
  visitorRelation: string | null;
  body: Localized<string>;
  status: CondolenceStatus;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

export type SubmitCondolenceInput = {
  memberId: string;
  visitorName: string;
  visitorRelation?: string | null;
  body: Localized<string>;
  ipHash: string;
};

export type SubmitCondolenceResult =
  | { ok: true; id: number; status: CondolenceStatus }
  | { ok: false; reason: "memorial_disabled" | "invalid" };

export async function submitCondolence(input: SubmitCondolenceInput): Promise<SubmitCondolenceResult> {
  const enabled = (await getBoolean("memorial.enable")) ?? true;
  if (!enabled) return { ok: false, reason: "memorial_disabled" };

  const visitorName = input.visitorName.trim();
  const body = sanitizeBody(input.body);
  if (!visitorName || visitorName.length > 80) return { ok: false, reason: "invalid" };
  if (!body) return { ok: false, reason: "invalid" };

  const requireApproval = (await getBoolean("memorial.condolences_require_approval")) ?? true;
  const status: CondolenceStatus = requireApproval ? "pending" : "approved";

  const { data, error } = await supabaseAdmin
    .from("condolences")
    .insert({
      member_id: input.memberId,
      visitor_name: visitorName,
      visitor_relation: input.visitorRelation?.trim() || null,
      body,
      status,
      ip_hash: input.ipHash,
    })
    .select("id, status")
    .single();

  if (error) return { ok: false, reason: "invalid" };
  return { ok: true, id: data.id as number, status: data.status as CondolenceStatus };
}

export async function listApprovedFor(
  memberId: string,
  opts: { limit?: number; offset?: number } = {}
): Promise<Condolence[]> {
  const limit = opts.limit ?? 20;
  const offset = opts.offset ?? 0;
  const { data, error } = await supabaseAdmin
    .from("condolences")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []).map(toCondolence);
}

export async function listByStatus(status: CondolenceStatus): Promise<Condolence[]> {
  const { data, error } = await supabaseAdmin
    .from("condolences")
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map(toCondolence);
}

export async function listPending(): Promise<Condolence[]> {
  return listByStatus("pending");
}

export async function moderate(
  id: number,
  action: "approve" | "reject",
  actorId: string
): Promise<void> {
  const newStatus: CondolenceStatus = action === "approve" ? "approved" : "rejected";
  const { error } = await supabaseAdmin
    .from("condolences")
    .update({
      status: newStatus,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  await logAudit({
    actorId,
    action: action === "approve" ? "approve" : "reject",
    entityType: "condolences",
    entityId: String(id),
  });
}

export async function countPending(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("condolences")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

function toCondolence(row: Record<string, unknown>): Condolence {
  return {
    id: row.id as number,
    memberId: row.member_id as string,
    visitorName: row.visitor_name as string,
    visitorRelation: (row.visitor_relation as string | null) ?? null,
    body: (row.body as Localized<string>) ?? {},
    status: row.status as CondolenceStatus,
    reviewedBy: (row.reviewed_by as string | null) ?? null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at as string) : null,
    createdAt: new Date(row.created_at as string),
  };
}

function sanitizeBody(body: Localized<string>): Localized<string> | null {
  const cleaned: Localized<string> = {};
  for (const [k, v] of Object.entries(body) as Array<[keyof Localized<string>, string | undefined]>) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim().slice(0, 1000);
    if (trimmed.length >= 5) cleaned[k] = trimmed;
  }
  return Object.keys(cleaned).length === 0 ? null : cleaned;
}
