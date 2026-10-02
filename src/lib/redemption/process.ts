import type { RedemptionDependencies, RedemptionJob, RedemptionOutcome } from "../../types/redemption/redemption.js";
import type { YouTubeVideoDetails } from "../../types/youtube/youtube.js";
import { ServiceUnavailableError } from "../common/errors.js";
import { buildChatMessage } from "./messages.js";
import { extractVideoId } from "../youtube/youtube-url.js";

async function resolveRedemptionOutcome(
  redemptionJob: RedemptionJob,
  dependencies: RedemptionDependencies,
): Promise<RedemptionOutcome> {
  const videoId: string | null = extractVideoId(redemptionJob.userInput);
  if (videoId === null) {
    return { status: "rejected", reason: "invalid_link" };
  }

  try {
    const videoDetails: YouTubeVideoDetails | null = await dependencies.youTubeClient.getVideoDetails(videoId);
    if (videoDetails === null) {
      return { status: "rejected", reason: "not_found", videoId };
    }

    const videoTitle: string = videoDetails.title;
    if (videoDetails.privacyStatus === "private") {
      return { status: "rejected", reason: "private", videoId, videoTitle };
    }
    if (!videoDetails.isEmbeddable) {
      return { status: "rejected", reason: "not_embeddable", videoId, videoTitle };
    }
    if (videoDetails.liveBroadcastContent !== "none") {
      return { status: "rejected", reason: "live", videoId, videoTitle };
    }

    const isAlreadyInPlaylist: boolean = await dependencies.youTubeClient.isVideoInPlaylist(
      dependencies.playlistId,
      videoId,
    );
    if (isAlreadyInPlaylist) {
      return { status: "rejected", reason: "duplicate", videoId, videoTitle };
    }

    await dependencies.youTubeClient.addVideoToPlaylist(dependencies.playlistId, videoId);
    return { status: "added", videoId, videoTitle };
  } catch (error: unknown) {
    if (error instanceof ServiceUnavailableError) {
      console.error(`[process] YouTube unavailable for redemption ${redemptionJob.redemptionId}`, error);
      return { status: "service_unavailable" };
    }
    console.error(`[process] Unexpected error for redemption ${redemptionJob.redemptionId}`, error);
    return { status: "unexpected_error" };
  }
}

/**
 * Validates the YouTube link from a redemption, adds it to the playlist when it passes
 * every check, and announces the result in chat.
 */
export async function processRedemption(
  redemptionJob: RedemptionJob,
  dependencies: RedemptionDependencies,
): Promise<RedemptionOutcome> {
  const redemptionOutcome: RedemptionOutcome = await resolveRedemptionOutcome(redemptionJob, dependencies);
  const chatMessage: string = buildChatMessage(redemptionJob.userName, redemptionOutcome);
  await dependencies.chatSender.sendMessage(chatMessage);
  return redemptionOutcome;
}
