import type { Context } from "@netlify/functions";
import type { z } from "zod";
import { createChatSender } from "../../src/lib/chat/chat.js";
import { getAppEnvironment } from "../../src/lib/common/env.js";
import { processRedemption } from "../../src/lib/redemption/process.js";
import { INTERNAL_SECRET_HEADER_NAME, redemptionJobSchema } from "../../src/lib/redemption/redemption-job.js";
import { safeEqualStrings } from "../../src/lib/common/security.js";
import { createYouTubeClient } from "../../src/lib/youtube/youtube.js";
import type { AppEnvironment } from "../../src/types/common/env.js";
import type { RedemptionJob, RedemptionOutcome } from "../../src/types/redemption/redemption.js";

// Background Function (sufijo -background): Netlify responde 202 al instante y esto corre hasta 15 min.
export default async (request: Request, _context: Context): Promise<void> => {
  const environment: AppEnvironment = getAppEnvironment();

  const providedSecret: string = request.headers.get(INTERNAL_SECRET_HEADER_NAME) ?? "";
  if (!safeEqualStrings(providedSecret, environment.INTERNAL_SECRET)) {
    console.warn("[process] Rejected call with an invalid internal secret");
    return;
  }

  const requestBody: unknown = await request.json().catch((): null => null);
  const jobParseResult: z.ZodSafeParseResult<RedemptionJob> = redemptionJobSchema.safeParse(requestBody);
  if (!jobParseResult.success) {
    console.error("[process] Invalid redemption job", jobParseResult.error.issues);
    return;
  }
  const redemptionJob: RedemptionJob = jobParseResult.data;

  const redemptionOutcome: RedemptionOutcome = await processRedemption(redemptionJob, {
    playlistId: environment.YOUTUBE_PLAYLIST_ID,
    youTubeClient: createYouTubeClient({
      clientId: environment.GOOGLE_CLIENT_ID,
      clientSecret: environment.GOOGLE_CLIENT_SECRET,
      refreshToken: environment.GOOGLE_REFRESH_TOKEN,
    }),
    chatSender: createChatSender({
      streamElementsChannelId: environment.SE_CHANNEL_ID,
      streamElementsJwt: environment.SE_JWT,
      twitchClientId: environment.TWITCH_CLIENT_ID,
      twitchBroadcasterId: environment.TWITCH_BROADCASTER_ID,
      twitchChatUserToken: environment.TWITCH_CHAT_USER_TOKEN,
    }),
  });

  console.log(
    JSON.stringify({
      redemptionId: redemptionJob.redemptionId,
      userLogin: redemptionJob.userLogin,
      outcome: redemptionOutcome,
    }),
  );
};
