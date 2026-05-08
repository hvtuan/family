import type { ChannelAdapter } from "./types";

export const whatsappAdapter: ChannelAdapter = {
  id: "whatsapp",
  comingSoon: true,
  setupGuideUrl: "/admin/help/whatsapp-link",
  async isReady() { return false; },
  async isAvailableFor() { return false; },
  async send() { return { ok: false, error: "channel_not_implemented_phase_3" }; },
};
