/**
 * Link-token helpers for chat-channel account linking.
 *
 * Flow:
 *   1. User clicks "Liên kết" on a chat channel in profile
 *   2. UI calls adapter.beginLink(user) which calls createLinkToken()
 *   3. Token is embedded in deep-link / OAuth URL
 *   4. User completes the chat-side action (sends /start <token> to bot)
 *   5. Webhook receives the action, calls adapter.completeLink() which
 *      calls consumeLinkToken() to verify + mark consumed
 *
 * Tokens are 6-char base32 (collision risk negligible at our scale),
 * 10-min TTL, single-use.
 */
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "../supabase/admin";

const TOKEN_LENGTH = 6;
const TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // base32 minus confusing chars

export async function createLinkToken(userId: string, channelId: string): Promise<string> {
  // Try a few times in case of (very rare) collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateToken();
    const { error } = await supabaseAdmin.from("notification_link_tokens").insert({
      token,
      user_id: userId,
      channel_id: channelId,
    });
    if (!error) return token;
    // Unique violation → try a new token; any other error → throw
    if (!String(error.message).includes("duplicate") && error.code !== "23505") {
      throw error;
    }
  }
  throw new Error("createLinkToken: exhausted retries");
}

/**
 * Verify + consume a link token. Returns the user_id if the token is valid,
 * not yet consumed, not expired, and matches the requested channel.
 * Marks the token consumed atomically.
 */
export async function consumeLinkToken(token: string, channelId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("notification_link_tokens")
    .select("user_id, channel_id, expires_at, consumed_at")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  if (data.channel_id !== channelId) return null;
  if (data.consumed_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;

  const { error: updateErr } = await supabaseAdmin
    .from("notification_link_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("token", token)
    .is("consumed_at", null);
  if (updateErr) return null;
  return data.user_id;
}

function generateToken(): string {
  const bytes = randomBytes(TOKEN_LENGTH);
  let out = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}
