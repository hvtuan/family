#!/usr/bin/env node
/**
 * Generate a VAPID keypair for Web Push and print to stdout.
 * Paste the values into /admin/settings → category Thông báo:
 *   - notifications.web_push_vapid_public
 *   - notifications.web_push_vapid_private
 */
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();
console.log("VAPID keys generated. Paste into /admin/settings:\n");
console.log("notifications.web_push_vapid_public:");
console.log("  " + keys.publicKey);
console.log("\nnotifications.web_push_vapid_private:");
console.log("  " + keys.privateKey);
console.log("\nNever commit these. The private key NEVER leaves the server.");
