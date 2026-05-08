/**
 * SMTP transport + react-email render pipeline.
 *
 * Reads SMTP creds from family.settings (admin-editable). Returns a
 * cached nodemailer transporter; falls back to a dry-run logger when
 * SMTP isn't configured so cron runs don't crash on a fresh install.
 */
import nodemailer, { type Transporter } from "nodemailer";
import { render } from "@react-email/render";
import type { ReactElement } from "react";
import { getSetting } from "./settings";

export type EmailRecipient = {
  email: string;
  name?: string;
  lang?: "vi" | "en";
};

export type SendEmailInput = {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  template: ReactElement;
  /** Optional plain-text fallback. Defaults to a stripped HTML version. */
  text?: string;
};

let cached: { transporter: Transporter; from: string } | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; reason?: string }> {
  const config = await getTransport();
  if (!config) {
    console.warn("[email] SMTP not configured; logging instead of sending", {
      to: input.to,
      subject: input.subject,
    });
    return { ok: false, reason: "smtp_not_configured" };
  }

  const html = await render(input.template);
  const text = input.text ?? (await render(input.template, { plainText: true }));
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const to = recipients.map((r) => (r.name ? `"${r.name}" <${r.email}>` : r.email)).join(", ");

  try {
    await config.transporter.sendMail({
      from: config.from,
      to,
      subject: input.subject,
      html,
      text,
    });
    return { ok: true };
  } catch (err) {
    console.error("[email] sendMail failed:", err);
    return { ok: false, reason: err instanceof Error ? err.message : "send_failed" };
  }
}

async function getTransport(): Promise<{ transporter: Transporter; from: string } | null> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;

  const [host, portRaw, user, password, fromEmail] = await Promise.all([
    getSetting("smtp.host"),
    getSetting("smtp.port"),
    getSetting("smtp.user"),
    getSetting("smtp.password"),
    getSetting("smtp.from_email"),
  ]);

  if (!host || !user || !password || !fromEmail) {
    cached = null;
    return null;
  }

  const port = portRaw ? Number(portRaw) : 587;
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass: password },
  });

  cached = { transporter, from: fromEmail };
  cachedAt = Date.now();
  return cached;
}

export function invalidateEmailCache(): void {
  cached = null;
  cachedAt = 0;
}
