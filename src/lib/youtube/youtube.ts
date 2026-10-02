import { auth, youtube, type youtube_v3 } from "@googleapis/youtube";
import type {
  GoogleApiErrorField,
  GoogleApiErrorShape,
  YouTubeClient,
  YouTubeCredentials,
  YouTubeVideoDetails,
} from "../../types/youtube/youtube.js";
import { ServiceUnavailableError } from "../common/errors.js";

const QUOTA_ERROR_REASONS: ReadonlySet<string> = new Set(["quotaExceeded", "dailyLimitExceeded"]);
const TOKEN_ERROR_CODES: ReadonlySet<string> = new Set(["invalid_grant", "invalid_client", "unauthorized_client"]);

/**
 * True when the error means YouTube is unusable until someone intervenes:
 * daily quota exhausted, or the OAuth refresh token / client was rejected.
 */
export function isYouTubeServiceUnavailableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const googleError: GoogleApiErrorShape = error as GoogleApiErrorShape;
  const responseError: GoogleApiErrorField | undefined = googleError.response?.data?.error;

  if (typeof responseError === "string") {
    return TOKEN_ERROR_CODES.has(responseError);
  }
  if (responseError?.errors?.some((errorDetail) => QUOTA_ERROR_REASONS.has(errorDetail.reason ?? ""))) {
    return true;
  }

  const httpStatus: number | undefined = googleError.response?.status ?? googleError.status;
  if (httpStatus === 401) {
    return true;
  }
  const errorMessage: string = googleError.message ?? "";
  return [...TOKEN_ERROR_CODES].some((tokenErrorCode: string) => errorMessage.includes(tokenErrorCode));
}

async function callYouTubeApi<Result>(operationName: string, operation: () => Promise<Result>): Promise<Result> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (isYouTubeServiceUnavailableError(error)) {
      throw new ServiceUnavailableError(`YouTube unavailable during ${operationName}`, { cause: error });
    }
    throw error;
  }
}

export function createYouTubeClient(credentials: YouTubeCredentials): YouTubeClient {
  const oauthClient = new auth.OAuth2(credentials.clientId, credentials.clientSecret);
  oauthClient.setCredentials({ refresh_token: credentials.refreshToken });
  const youTubeApi: youtube_v3.Youtube = youtube({ version: "v3", auth: oauthClient });

  return {
    async getVideoDetails(videoId: string): Promise<YouTubeVideoDetails | null> {
      const videoListResponse = await callYouTubeApi("videos.list", () =>
        youTubeApi.videos.list({ part: ["snippet", "status"], id: [videoId], maxResults: 1 }),
      );
      const video: youtube_v3.Schema$Video | undefined = videoListResponse.data.items?.[0];
      if (!video) {
        return null;
      }
      return {
        videoId,
        title: video.snippet?.title ?? "",
        privacyStatus: video.status?.privacyStatus ?? "private",
        isEmbeddable: video.status?.embeddable ?? false,
        liveBroadcastContent: video.snippet?.liveBroadcastContent ?? "none",
      };
    },

    async isVideoInPlaylist(playlistId: string, videoId: string): Promise<boolean> {
      const playlistItemsResponse = await callYouTubeApi("playlistItems.list", () =>
        youTubeApi.playlistItems.list({ part: ["id"], playlistId, videoId, maxResults: 1 }),
      );
      const matchingItemCount: number = playlistItemsResponse.data.items?.length ?? 0;
      return matchingItemCount > 0;
    },

    async addVideoToPlaylist(playlistId: string, videoId: string): Promise<void> {
      await callYouTubeApi("playlistItems.insert", () =>
        youTubeApi.playlistItems.insert({
          part: ["snippet"],
          requestBody: {
            snippet: {
              playlistId,
              resourceId: { kind: "youtube#video", videoId },
            },
          },
        }),
      );
    },
  };
}
