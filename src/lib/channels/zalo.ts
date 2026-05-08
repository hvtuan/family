import type { ChannelAdapter } from "./types";
import { getSetting } from "@/lib/settings";

export const zaloAdapter: ChannelAdapter = {
  id: "zalo",
  comingSoon: true,
  setupGuideUrl: "/admin/help/zalo-link",
  async isReady() {
    return Boolean(await getSetting("notifications.zalo_oa_token"));
  },
  async isAvailableFor() {
    return false;
  },
  async send() {
    return { ok: false, error: "channel_not_implemented_phase_1" };
  },
};
