import type { ChannelAdapter } from "./types";
import { getSetting } from "@/lib/settings";

export const telegramAdapter: ChannelAdapter = {
  id: "telegram",
  comingSoon: true,
  setupGuideUrl: "/admin/help/telegram-link",
  async isReady() {
    return Boolean(await getSetting("notifications.telegram_bot_token"));
  },
  async isAvailableFor() {
    return false;
  },
  async send() {
    return { ok: false, error: "channel_not_implemented_phase_1" };
  },
};
