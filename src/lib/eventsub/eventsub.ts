import { createHmac } from "node:crypto";
import { z } from "zod";
import type { EventSubHeaders } from "../../types/eventsub/eventsub.js";
import { safeEqualStrings } from "../common/security.js";

export const EVENTSUB_HEADER_NAMES = {
  messageId: "twitch-eventsub-message-id",
  messageTimestamp: "twitch-eventsub-message-timestamp",
  messageSignature: "twitch-eventsub-message-signature",
  messageType: "twitch-eventsub-message-type",
} as const;

/** Twitch recommends rejecting messages older than 10 minutes to prevent replay attacks. */
export const MAX_MESSAGE_AGE_MILLISECONDS: number = 10 * 60 * 1000;

export const eventSubSubscriptionSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string(),
  condition: z.record(z.string(), z.unknown()),
});

export const redemptionEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  user_input: z.string(),
  reward: z.object({
    id: z.string(),
    title: z.string(),
  }),
});

export const verificationPayloadSchema = z.object({
  challenge: z.string(),
  subscription: eventSubSubscriptionSchema,
});

export const revocationPayloadSchema = z.object({
  subscription: eventSubSubscriptionSchema,
});

export const notificationPayloadSchema = z.object({
  subscription: eventSubSubscriptionSchema,
  event: redemptionEventSchema,
});

/** Returns `null` when any required EventSub header is missing. */
export function readEventSubHeaders(requestHeaders: Headers): EventSubHeaders | null {
  const messageId: string | null = requestHeaders.get(EVENTSUB_HEADER_NAMES.messageId);
  const messageTimestamp: string | null = requestHeaders.get(EVENTSUB_HEADER_NAMES.messageTimestamp);
  const messageSignature: string | null = requestHeaders.get(EVENTSUB_HEADER_NAMES.messageSignature);
  const messageType: string | null = requestHeaders.get(EVENTSUB_HEADER_NAMES.messageType);

  if (!messageId || !messageTimestamp || !messageSignature || !messageType) {
    return null;
  }
  return { messageId, messageTimestamp, messageSignature, messageType };
}

export function computeEventSubSignature(
  eventSubSecret: string,
  messageId: string,
  messageTimestamp: string,
  rawBody: string,
): string {
  const hexDigest: string = createHmac("sha256", eventSubSecret)
    .update(messageId + messageTimestamp + rawBody)
    .digest("hex");
  return `sha256=${hexDigest}`;
}

/**
 * Verifies the HMAC-SHA256 signature Twitch sends with every message and rejects
 * messages whose timestamp is too old (or too far in the future).
 */
export function verifyEventSubSignature(
  eventSubSecret: string,
  eventSubHeaders: EventSubHeaders,
  rawBody: string,
  currentTimeMilliseconds: number = Date.now(),
): boolean {
  const messageTimeMilliseconds: number = Date.parse(eventSubHeaders.messageTimestamp);
  if (Number.isNaN(messageTimeMilliseconds)) {
    return false;
  }
  const messageAgeMilliseconds: number = Math.abs(currentTimeMilliseconds - messageTimeMilliseconds);
  if (messageAgeMilliseconds > MAX_MESSAGE_AGE_MILLISECONDS) {
    return false;
  }

  const expectedSignature: string = computeEventSubSignature(
    eventSubSecret,
    eventSubHeaders.messageId,
    eventSubHeaders.messageTimestamp,
    rawBody,
  );
  return safeEqualStrings(eventSubHeaders.messageSignature, expectedSignature);
}
