/**
 * Append a row to family.audit_log. Server-only, always uses the
 * service-role client so it bypasses RLS. Failures are logged but never
 * thrown — losing an audit row should not block the underlying mutation.
 */

import { supabaseAdmin } from "./supabase/admin";

export type AuditAction =
  | "create" | "update" | "delete"
  | "approve" | "revoke"
  | "login" | "logout";

export type AuditEntity =
  | "members" | "timeline" | "traditions" | "photos" | "quotes"
  | "dates" | "locations" | "app_users" | "allowed_emails";

export async function logAudit(args: {
  actorId: string;
  action: AuditAction;
  entityType: AuditEntity;
  entityId?: string;
  diff?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_log").insert({
    actor_id: args.actorId,
    action: args.action,
    entity_type: args.entityType,
    entity_id: args.entityId ?? null,
    diff: args.diff ?? null,
  });
  if (error) {
    console.error("[audit] insert failed:", error.message, args);
  }
}
