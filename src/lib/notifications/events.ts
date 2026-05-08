/**
 * Event descriptor registry. Each event defines:
 *   - default channels
 *   - critical flag (bypass quiet hours)
 *   - subject() for emails
 *   - render() per channel returning the channel-specific payload shape
 *
 * Adding a new event = 1 entry here + handle channels you care about.
 */
import type { ReactElement } from "react";
import React from "react";
import AnniversaryAlert from "@/emails/AnniversaryAlert";
import type { ChannelId, EventType } from "./types";
import type { AppUserRow } from "@/lib/channels/types";
import type { Locale } from "@/i18n";
import { t } from "@/i18n";

export interface EventDescriptor {
  id: EventType;
  defaultChannels: ChannelId[];
  critical: boolean;
  subject: (payload: Record<string, unknown>, lang: Locale) => string;
}

export interface InAppPayload {
  title: string;
  body: string;
  url: string;
  icon: string;
}

export interface PushPayload extends InAppPayload {}

const EVENTS: Record<EventType, EventDescriptor> = {
  "anniversary.t-7": {
    id: "anniversary.t-7",
    defaultChannels: ["email", "in_app"],
    critical: false,
    subject: (p, lang) => t("notifications.anniversaryT7Subject", lang, { name: String(p.memberName ?? "") }),
  },
  "anniversary.t-1": {
    id: "anniversary.t-1",
    defaultChannels: ["email", "in_app", "web_push", "zalo"],
    critical: false,
    subject: (p, lang) => t("notifications.anniversaryT1Subject", lang, { name: String(p.memberName ?? "") }),
  },
  "anniversary.today": {
    id: "anniversary.today",
    defaultChannels: ["email", "in_app", "web_push", "zalo"],
    critical: true,
    subject: (p, lang) => t("notifications.anniversaryTodaySubject", lang, { name: String(p.memberName ?? "") }),
  },
  "condolence.pending": {
    id: "condolence.pending",
    defaultChannels: ["in_app"],
    critical: false,
    subject: () => "Lời tưởng nhớ chờ duyệt",
  },
  "member.added": {
    id: "member.added",
    defaultChannels: ["in_app"],
    critical: false,
    subject: () => "Có thành viên mới",
  },
  "system.welcome": {
    id: "system.welcome",
    defaultChannels: ["email", "in_app"],
    critical: false,
    subject: () => "Chào mừng đến với gia phả",
  },
  "system.weekly_digest": {
    id: "system.weekly_digest",
    defaultChannels: ["email"],
    critical: false,
    subject: () => "Tóm tắt tuần",
  },
};

export function getEventDescriptor(eventType: string): EventDescriptor | undefined {
  return EVENTS[eventType as EventType];
}

/**
 * Render an event for a specific channel. Returns:
 *  - ReactElement   for "email" (consumed by react-email render)
 *  - InAppPayload   for "in_app" (stored as-is in notifications.payload, read by bell)
 *  - PushPayload    for "web_push" (JSON sent to Service Worker)
 *  - string         for chat channels (markdown / plain text)
 *  - null           if the channel has no template for this event yet
 */
export function renderEventForChannel(
  event: EventDescriptor,
  channel: ChannelId,
  payload: Record<string, unknown>,
  user: AppUserRow
): InAppPayload | PushPayload | ReactElement | string | null {
  const lang = user.preferred_lang ?? "vi";
  const memberName = String(payload.memberName ?? "");

  if (channel === "in_app" || channel === "web_push") {
    if (event.id === "anniversary.t-7") {
      return {
        title: t("notifications.anniversaryT7InApp", lang, { name: memberName }),
        body: t("notifications.anniversaryT7Body", lang, { name: memberName }),
        url: payload.memberId ? `/memorial/${payload.memberId}` : "/altar",
        icon: "🌸",
      };
    }
    if (event.id === "anniversary.t-1") {
      return {
        title: t("notifications.anniversaryT1InApp", lang, { name: memberName }),
        body: t("notifications.anniversaryT1Body", lang, { name: memberName }),
        url: payload.memberId ? `/memorial/${payload.memberId}` : "/altar",
        icon: "🌸",
      };
    }
    if (event.id === "anniversary.today") {
      return {
        title: t("notifications.anniversaryTodayInApp", lang, { name: memberName }),
        body: t("notifications.anniversaryTodayBody", lang, { name: memberName }),
        url: payload.memberId ? `/memorial/${payload.memberId}` : "/altar",
        icon: "🌸",
      };
    }
    if (event.id === "condolence.pending") {
      return {
        title: "Lời tưởng nhớ mới chờ duyệt",
        body: "Mở danh sách để xem chi tiết và duyệt",
        url: "/admin/condolences",
        icon: "💬",
      };
    }
    if (event.id === "member.added") {
      return {
        title: "Có thành viên mới được thêm",
        body: String(payload.memberName ?? ""),
        url: "/admin/members",
        icon: "👤",
      };
    }
    if (event.id === "system.welcome") {
      return {
        title: "Chào mừng đến với gia phả họ",
        body: "Mở phần thiết lập để chọn cách bạn muốn nhận thông báo.",
        url: "/admin/profile",
        icon: "✨",
      };
    }
    return null;
  }

  if (channel === "email") {
    // Anniversary events reuse the existing memorial M5 template so the
    // migrated cron renders identical emails. Other events get a generic
    // fallback with title + body.
    if (event.id === "anniversary.t-7" || event.id === "anniversary.t-1" || event.id === "anniversary.today") {
      const variant = event.id === "anniversary.t-7" ? "t-7" : event.id === "anniversary.t-1" ? "t-1" : "today";
      const memberId = String(payload.memberId ?? "");
      const anniversaryIso = String(payload.anniversaryDate ?? new Date().toISOString());
      void anniversaryIso; // referenced in payload for downstream cron use
      // The dispatcher does not have all the fields AnniversaryAlert needs
      // (photo URL, lunar label, born/died years, bio preview). The memorial
      // cron pre-renders these into payload before calling dispatch — see
      // Task 12 step 2 for the exact payload shape.
      const photoUrl = (payload.photoUrl as string | null | undefined) ?? null;
      const lunarLabel = String(payload.lunarLabel ?? "");
      const bornYear = (payload.bornYear as string | null | undefined) ?? null;
      const diedYear = String(payload.diedYear ?? "");
      const solarDate = String(payload.solarDate ?? "");
      const bioPreview = String(payload.bioPreview ?? "");
      const publicUrl = String(payload.publicUrl ?? "https://family.huynhvantuan.net");
      const surname = String(payload.surname ?? "Nguyễn");
      const memorialUrl = `${publicUrl.replace(/\/$/, "")}/memorial/${memberId}`;
      return React.createElement(AnniversaryAlert, {
        variant,
        memberName,
        memorialUrl,
        publicUrl,
        surname,
        photoUrl,
        bornYear,
        diedYear,
        solarDate,
        lunarLabel,
        bioPreview,
        recipientName: user.display_name ?? undefined,
      });
    }
    // Generic email template for non-anniversary events.
    const inApp = renderEventForChannel(event, "in_app", payload, user) as InAppPayload | null;
    if (!inApp) return null;
    return React.createElement(
      "div",
      { style: { fontFamily: "Georgia, serif", padding: 24 } },
      React.createElement("h2", null, inApp.title),
      React.createElement("p", null, inApp.body),
      React.createElement(
        "a",
        { href: `${String(payload.publicUrl ?? "https://family.huynhvantuan.net")}${inApp.url}` },
        "Mở trang liên quan"
      )
    );
  }

  // Chat channels (zalo, telegram, ...) — Phase 2 implementation will
  // return the rendered markdown string here.
  return null;
}
