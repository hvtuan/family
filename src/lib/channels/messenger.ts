import type { ChannelAdapter } from "./types";

export const messengerAdapter: ChannelAdapter = {
  id: "messenger",
  comingSoon: true,
  setupGuideUrl: "/admin/help/messenger-link",
  async isReady() { return false; },
  async isAvailableFor() { return false; },
  async send() { return { ok: false, error: "channel_not_implemented_phase_3" }; },
};
