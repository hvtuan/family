import type { ChannelAdapter } from "./types";

export const smsAdapter: ChannelAdapter = {
  id: "sms",
  comingSoon: true,
  setupGuideUrl: "/admin/help/sms-setup",
  async isReady() { return false; },
  async isAvailableFor() { return false; },
  async send() { return { ok: false, error: "channel_not_implemented_phase_3" }; },
};
