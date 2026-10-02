import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatSender } from "../../types/chat/chat.js";
import type { RedemptionDependencies, RedemptionJob, RedemptionOutcome } from "../../types/redemption/redemption.js";
import type { YouTubeClient, YouTubeVideoDetails } from "../../types/youtube/youtube.js";
import { ServiceUnavailableError } from "../common/errors.js";
import { processRedemption } from "./process.js";

const PLAYLIST_ID: string = "PL_test_playlist";
const VIDEO_ID: string = "dQw4w9WgXcQ";

const playableVideo: YouTubeVideoDetails = {
  videoId: VIDEO_ID,
  title: "Never Gonna Give You Up",
  privacyStatus: "public",
  isEmbeddable: true,
  liveBroadcastContent: "none",
};

function buildJob(userInput: string = `https://youtu.be/${VIDEO_ID}`): RedemptionJob {
  return { redemptionId: "redemption-1", userLogin: "viewer", userName: "Viewer", userInput };
}

describe("processRedemption", () => {
  let youTubeClient: YouTubeClient;
  let chatSender: ChatSender;
  let dependencies: RedemptionDependencies;

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation((): void => {});
    youTubeClient = {
      getVideoDetails: vi.fn(async (): Promise<YouTubeVideoDetails | null> => playableVideo),
      isVideoInPlaylist: vi.fn(async (): Promise<boolean> => false),
      addVideoToPlaylist: vi.fn(async (): Promise<void> => {}),
    };
    chatSender = { sendMessage: vi.fn(async (): Promise<void> => {}) };
    dependencies = { youTubeClient, chatSender, playlistId: PLAYLIST_ID };
  });

  it("adds a valid video and announces it", async () => {
    const redemptionOutcome: RedemptionOutcome = await processRedemption(buildJob(), dependencies);

    expect(redemptionOutcome).toEqual({ status: "added", videoId: VIDEO_ID, videoTitle: playableVideo.title });
    expect(youTubeClient.addVideoToPlaylist).toHaveBeenCalledWith(PLAYLIST_ID, VIDEO_ID);
    expect(chatSender.sendMessage).toHaveBeenCalledWith(expect.stringContaining("@Viewer ✅"));
  });

  it("rejects text without a YouTube link without calling the API", async () => {
    const redemptionOutcome: RedemptionOutcome = await processRedemption(buildJob("pon algo de música"), dependencies);

    expect(redemptionOutcome).toEqual({ status: "rejected", reason: "invalid_link" });
    expect(youTubeClient.getVideoDetails).not.toHaveBeenCalled();
    expect(chatSender.sendMessage).toHaveBeenCalledWith(expect.stringContaining("link de YouTube válido"));
  });

  it("rejects a video that does not exist", async () => {
    vi.mocked(youTubeClient.getVideoDetails).mockResolvedValue(null);
    const redemptionOutcome: RedemptionOutcome = await processRedemption(buildJob(), dependencies);
    expect(redemptionOutcome).toMatchObject({ status: "rejected", reason: "not_found" });
  });

  it.each<[Partial<YouTubeVideoDetails>, string]>([
    [{ privacyStatus: "private" }, "private"],
    [{ isEmbeddable: false }, "not_embeddable"],
    [{ liveBroadcastContent: "live" }, "live"],
    [{ liveBroadcastContent: "upcoming" }, "live"],
  ])("rejects %o as %s", async (videoOverrides: Partial<YouTubeVideoDetails>, expectedReason: string) => {
    vi.mocked(youTubeClient.getVideoDetails).mockResolvedValue({ ...playableVideo, ...videoOverrides });
    const redemptionOutcome: RedemptionOutcome = await processRedemption(buildJob(), dependencies);

    expect(redemptionOutcome).toMatchObject({ status: "rejected", reason: expectedReason });
    expect(youTubeClient.addVideoToPlaylist).not.toHaveBeenCalled();
  });

  it("accepts unlisted videos", async () => {
    vi.mocked(youTubeClient.getVideoDetails).mockResolvedValue({ ...playableVideo, privacyStatus: "unlisted" });
    const redemptionOutcome: RedemptionOutcome = await processRedemption(buildJob(), dependencies);
    expect(redemptionOutcome.status).toBe("added");
  });

  it("rejects a video already in the playlist", async () => {
    vi.mocked(youTubeClient.isVideoInPlaylist).mockResolvedValue(true);
    const redemptionOutcome: RedemptionOutcome = await processRedemption(buildJob(), dependencies);

    expect(redemptionOutcome).toMatchObject({ status: "rejected", reason: "duplicate" });
    expect(youTubeClient.addVideoToPlaylist).not.toHaveBeenCalled();
  });

  it("reports service unavailable when quota or token fails", async () => {
    vi.mocked(youTubeClient.addVideoToPlaylist).mockRejectedValue(new ServiceUnavailableError("quotaExceeded"));
    const redemptionOutcome: RedemptionOutcome = await processRedemption(buildJob(), dependencies);

    expect(redemptionOutcome).toEqual({ status: "service_unavailable" });
    expect(chatSender.sendMessage).toHaveBeenCalledWith(expect.stringContaining("no está disponible"));
  });

  it("reports an unexpected error without throwing", async () => {
    vi.mocked(youTubeClient.getVideoDetails).mockRejectedValue(new Error("network down"));
    const redemptionOutcome: RedemptionOutcome = await processRedemption(buildJob(), dependencies);

    expect(redemptionOutcome).toEqual({ status: "unexpected_error" });
    expect(chatSender.sendMessage).toHaveBeenCalledTimes(1);
  });
});
