/**
 * Hand-rolled DB row types for Phase 2 admin.
 * Will be replaced by `supabase gen types typescript` output once we wire the
 * Supabase CLI; until then keeping these typed by hand keeps editor + build
 * checks honest without an extra step in the migration loop.
 */

export type Role = "admin" | "editor" | "branch_editor";
export type Branch = "noi" | "ngoai" | "both";
export type UserStatus = "pending" | "approved" | "revoked";

export interface AppUser {
  id: string;
  email: string;
  display_name: string | null;
  role: Role;
  branch: Branch | null;
  status: UserStatus;
  approved_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

export interface AllowedEmail {
  email: string;
  role: Role;
  branch: Branch | null;
  added_by: string | null;
  added_at: string;
}

export interface AuditLogEntry {
  id: number;
  actor_id: string | null;
  action: "insert" | "update" | "delete" | "approve" | "revoke";
  entity_type: string;
  entity_id: string | null;
  diff: unknown;
  at: string;
}
