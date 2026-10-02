import type { z } from "zod";
import type {
  eventSubSubscriptionSchema,
  notificationPayloadSchema,
  redemptionEventSchema,
  revocationPayloadSchema,
  verificationPayloadSchema,
} from "../../lib/eventsub/eventsub.js";

export type EventSubMessageType = "notification" | "webhook_callback_verification" | "revocation";

/** The `Twitch-Eventsub-Message-*` headers needed to authenticate and route a message. */
export interface EventSubHeaders {
  messageId: string;
  messageTimestamp: string;
  messageSignature: string;
  messageType: string;
}

export type EventSubSubscription = z.infer<typeof eventSubSubscriptionSchema>;
export type VerificationPayload = z.infer<typeof verificationPayloadSchema>;
export type RevocationPayload = z.infer<typeof revocationPayloadSchema>;
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;

/** `event` of `channel.channel_points_custom_reward_redemption.add`. */
export type RedemptionEvent = z.infer<typeof redemptionEventSchema>;
