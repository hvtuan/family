/**
 * POST /admin/cron/anniversary-alerts
 *
 * Daily cron triggered by Coolify scheduled task at 06:00 Asia/Ho_Chi_Minh.
 * Computes the upcoming-anniversaries list, dispatches T-7 / T-1 / today
 * emails to admin + branch_editor, and records each send in
 * family.anniversary_alerts (UNIQUE constraint = idempotent).
 *
 * Usage:
 *   curl -X POST -H "Authorization: Bearer ${CRON_SECRET}" \
 *        https://family.huynhvantuan.net/admin/cron/anniversary-alerts
 *
 * Returns a JSON summary so cron logs are useful.
 */
import type { APIRoute } from "astro";
import React from "react";
import { requireCronSecret } from "@/lib/cron-auth";
import { getDeceasedMembers } from "@/lib/memorial";
import { getAnniversariesForMember, type Anniversary } from "@/lib/anniversary";
import { formatLunarVi } from "@/lib/lunar";
import { getSetting } from "@/lib/settings";
import { sendEmail, type EmailRecipient } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import AnniversaryAlert, { type AnniversaryAlertVariant } from "@/emails/AnniversaryAlert";

export const prerender = false;

const DAY_MS = 24 * 60 * 60 * 1000;

export const POST: APIRoute = async ({ request }) => {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const enabled = (await getSetting("memorial.enable")) ?? "true";
  if (enabled === "false") {
    return json({ ok: true, skipped: "memorial_disabled", processed: 0, sent: 0 });
  }

  const triggers = parseAlertDays(await getSetting("memorial.alert_days_before"));
  const publicUrl = (await getSetting("site.public_url")) ?? "https://family.huynhvantuan.net";
  const surname = (await getSetting("site.surname")) ?? "Nguyễn";

  const today = startOfToday();
  const todayMs = today.getTime();

  const deceased = await getDeceasedMembers();
  let processed = 0;
  let sent = 0;
  const errors: string[] = [];

  // Fetch admin + branch_editor recipients once.
  const recipients = await fetchRecipients();
  if (recipients.length === 0) {
    return json({
      ok: true,
      processed: 0,
      sent: 0,
      skipped: "no_recipients",
    });
  }

  for (const member of deceased) {
    if (!member.memorialEnabled) continue;

    const anniversaries = await getAnniversariesForMember(member.id, 1);
    for (const anniversary of anniversaries) {
      const days = Math.round((anniversary.date.getTime() - todayMs) / DAY_MS);
      const trigger = triggers.find((t) => t === days);
      if (trigger === undefined) continue;

      const variant: AnniversaryAlertVariant =
        trigger === 7 ? "t-7" : trigger === 1 ? "t-1" : "today";

      // Idempotency check.
      const exists = await alertExists(member.id, variant, anniversary.year);
      if (exists) continue;

      processed++;

      try {
        const emailHtml = renderAlertEmail({
          variant,
          member,
          anniversary,
          surname,
          publicUrl,
        });

        const result = await sendEmail({
          to: recipients,
          subject: alertSubject(variant, member.name),
          template: emailHtml,
        });

        if (result.ok) {
          await recordAlert(member.id, variant, anniversary, recipients);
          sent++;
        } else {
          errors.push(`${member.id}/${variant}: ${result.reason}`);
        }
      } catch (err) {
        errors.push(`${member.id}/${variant}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
  }

  // Optional audit log entry summarizing the run.
  try {
    await logAudit({
      actorId: "00000000-0000-0000-0000-000000000000",
      action: "cron_run",
      entityType: "anniversary_alerts",
      diff: { processed, sent, errors: errors.slice(0, 5) },
    });
  } catch {
    // Non-fatal.
  }

  return json({ ok: true, processed, sent, errors: errors.length ? errors : undefined });
};

function parseAlertDays(raw: string | null): number[] {
  if (!raw) return [7, 1, 0];
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

function alertSubject(variant: AnniversaryAlertVariant, name: string): string {
  if (variant === "t-7") return `Còn 7 ngày tới giỗ ${name}`;
  if (variant === "t-1") return `Ngày mai là giỗ ${name}`;
  return `Hôm nay là ngày giỗ ${name}`;
}

function renderAlertEmail(opts: {
  variant: AnniversaryAlertVariant;
  member: Awaited<ReturnType<typeof getDeceasedMembers>>[number];
  anniversary: Anniversary;
  surname: string;
  publicUrl: string;
}) {
  const { variant, member, anniversary, surname, publicUrl } = opts;
  const memorialUrl = `${publicUrl.replace(/\/$/, "")}/memorial/${member.id}`;

  const dd = String(anniversary.date.getDate()).padStart(2, "0");
  const mm = String(anniversary.date.getMonth() + 1).padStart(2, "0");
  const solarDate = `${dd}/${mm}/${anniversary.date.getFullYear()}`;

  const lunarLabel = formatLunarVi(member.deathDateLunar);

  const bornYear = member.born ? new Date(member.born).getFullYear().toString() : null;
  const diedYear = member.died ? new Date(member.died).getFullYear().toString() : "";
  const bioPreview = (member.bio ?? "").trim().slice(0, 280);

  return React.createElement(AnniversaryAlert, {
    variant,
    memberName: member.name,
    memorialUrl,
    publicUrl,
    surname,
    photoUrl: member.photoUrl,
    bornYear,
    diedYear,
    solarDate,
    lunarLabel,
    bioPreview,
  });
}

async function fetchRecipients(): Promise<EmailRecipient[]> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("email, role, status, preferred_lang")
    .eq("status", "approved")
    .in("role", ["admin", "branch_editor"]);
  if (error) throw error;

  return (data ?? []).map((row) => ({
    email: row.email as string,
    lang: ((row.preferred_lang as "vi" | "en" | undefined) ?? "vi"),
  }));
}

async function alertExists(
  memberId: string,
  variant: AnniversaryAlertVariant,
  year: number
): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from("anniversary_alerts")
    .select("id", { count: "exact", head: true })
    .eq("member_id", memberId)
    .eq("alert_type", variant)
    .eq("anniversary_year", year);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function recordAlert(
  memberId: string,
  variant: AnniversaryAlertVariant,
  anniversary: Anniversary,
  recipients: EmailRecipient[]
): Promise<void> {
  const solar = anniversary.date;
  const dateStr = `${solar.getFullYear()}-${String(solar.getMonth() + 1).padStart(2, "0")}-${String(solar.getDate()).padStart(2, "0")}`;
  await supabaseAdmin.from("anniversary_alerts").insert({
    member_id: memberId,
    alert_type: variant,
    anniversary_year: anniversary.year,
    anniversary_solar: dateStr,
    recipients: recipients.map((r) => ({ email: r.email, lang: r.lang ?? "vi" })),
  });
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
