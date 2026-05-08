/**
 * Event registry + render dispatch — stub placeholder.
 * Full implementation in Task 9.
 */
import type { AppUserRow } from "@/lib/channels/types";
import type { ChannelId } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EventDescriptor = Record<string, any>;

export function getEventDescriptor(_eventType: string): EventDescriptor | null {
  return null;
}

export function renderEventForChannel(
  _event: EventDescriptor,
  _channel: ChannelId,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _payload: Record<string, any>,
  _user: AppUserRow
): unknown {
  return null;
}
