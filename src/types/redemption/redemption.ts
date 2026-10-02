import type { z } from "zod";
import type { redemptionJobSchema } from "../../lib/redemption/redemption-job.js";
import type { ChatSender } from "../chat/chat.js";
import type { YouTubeClient } from "../youtube/youtube.js";

/** Body sent from `twitch-webhook` to `process-redemption-background`. */
export type RedemptionJob = z.infer<typeof redemptionJobSchema>;

export type RedemptionRejectionReason =
  | "invalid_link"
  | "not_found"
  | "private"
  | "not_embeddable"
  | "live"
  | "duplicate";

export type RedemptionOutcome =
  | { status: "added"; videoId: string; videoTitle: string }
  | { status: "rejected"; reason: RedemptionRejectionReason; videoId?: string; videoTitle?: string }
  | { status: "service_unavailable" }
  | { status: "unexpected_error" };

export interface RedemptionDependencies {
  youTubeClient: YouTubeClient;
  chatSender: ChatSender;
  playlistId: string;
}
