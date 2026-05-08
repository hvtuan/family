/**
 * Channel registry — single source of truth mapping ChannelId to adapter
 * implementation. Phase 1 lights up email/in_app/web_push; rest are stubs
 * with isAvailableFor=false until Phase 2/3 swaps the send() body.
 */
import type { ChannelAdapter } from "./types";
import type { ChannelId } from "@/lib/notifications/types";
import { emailAdapter } from "./email";
import { inAppAdapter } from "./in_app";
import { webPushAdapter } from "./web_push";
import { zaloAdapter } from "./zalo";
import { telegramAdapter } from "./telegram";
import { messengerAdapter } from "./messenger";
import { whatsappAdapter } from "./whatsapp";
import { smsAdapter } from "./sms";

export const channelRegistry: Record<ChannelId, ChannelAdapter> = {
  email: emailAdapter,
  in_app: inAppAdapter,
  web_push: webPushAdapter,
  zalo: zaloAdapter,
  telegram: telegramAdapter,
  messenger: messengerAdapter,
  whatsapp: whatsappAdapter,
  sms: smsAdapter,
};

export function getAdapter(id: ChannelId): ChannelAdapter | undefined {
  return channelRegistry[id];
}
