export interface YouTubeVideoDetails {
  videoId: string;
  title: string;
  /** `public`, `unlisted` or `private`. */
  privacyStatus: string;
  isEmbeddable: boolean;
  /** `none`, `live` or `upcoming` (premieres and scheduled streams). */
  liveBroadcastContent: string;
}

export interface YouTubeCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface GoogleApiErrorDetail {
  code?: number;
  message?: string;
  errors?: Array<{ reason?: string }>;
}

/** Token endpoint returns a string (`invalid_grant`); the Data API returns an object. */
export type GoogleApiErrorField = string | GoogleApiErrorDetail;

/** Relevant parts of a Gaxios error thrown by `@googleapis/youtube` (API call or token refresh). */
export interface GoogleApiErrorShape {
  message?: string;
  status?: number;
  response?: {
    status?: number;
    data?: {
      error?: GoogleApiErrorField;
    };
  };
}

/**
 * Operations the redemption pipeline needs from YouTube. Implementations must throw
 * `ServiceUnavailableError` when the quota is exhausted or the OAuth token is no longer valid.
 */
export interface YouTubeClient {
  /** Returns `null` when the video does not exist or is not visible to the account. */
  getVideoDetails(videoId: string): Promise<YouTubeVideoDetails | null>;
  isVideoInPlaylist(playlistId: string, videoId: string): Promise<boolean>;
  addVideoToPlaylist(playlistId: string, videoId: string): Promise<void>;
}
