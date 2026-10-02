import { getStore, type Store } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
import type { z } from "zod";
import { getAppEnvironment } from "../../src/lib/common/env.js";
import {
  notificationPayloadSchema,
  readEventSubHeaders,
  revocationPayloadSchema,
  verificationPayloadSchema,
  verifyEventSubSignature,
} from "../../src/lib/eventsub/eventsub.js";
import { INTERNAL_SECRET_HEADER_NAME, PROCESS_REDEMPTION_FUNCTION_PATH } from "../../src/lib/redemption/redemption-job.js";
import type { AppEnvironment } from "../../src/types/common/env.js";
import type {
  EventSubHeaders,
  EventSubMessageType,
  NotificationPayload,
  RevocationPayload,
  VerificationPayload,
} from "../../src/types/eventsub/eventsub.js";
import type { RedemptionJob } from "../../src/types/redemption/redemption.js";

const PROCESSED_MESSAGES_STORE_NAME: string = "eventsub-messages";

function emptyResponse(httpStatus: number): Response {
  return new Response(null, { status: httpStatus });
}

function parseJson(rawBody: string): unknown {
  try {
    return JSON.parse(rawBody);
  } catch {
    return undefined;
  }
}

function handleVerification(parsedBody: unknown): Response {
  const verificationResult: z.ZodSafeParseResult<VerificationPayload> = verificationPayloadSchema.safeParse(parsedBody);
  if (!verificationResult.success) {
    return emptyResponse(400);
  }
  console.log(`[webhook] Subscription ${verificationResult.data.subscription.id} verified`);
  return new Response(verificationResult.data.challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

function handleRevocation(parsedBody: unknown): Response {
  const revocationResult: z.ZodSafeParseResult<RevocationPayload> = revocationPayloadSchema.safeParse(parsedBody);
  if (revocationResult.success) {
    const { id: subscriptionId, status: revocationStatus } = revocationResult.data.subscription;
    console.error(
      `[webhook] Subscription ${subscriptionId} revoked by Twitch (${revocationStatus}). Run "npm run setup:eventsub" again.`,
    );
  } else {
    console.error("[webhook] Received a malformed revocation message");
  }
  return emptyResponse(204);
}

async function dispatchRedemptionJob(
  requestOrigin: string,
  internalSecret: string,
  redemptionJob: RedemptionJob,
): Promise<void> {
  const backgroundResponse: Response = await fetch(`${requestOrigin}${PROCESS_REDEMPTION_FUNCTION_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [INTERNAL_SECRET_HEADER_NAME]: internalSecret,
    },
    body: JSON.stringify(redemptionJob),
  });
  if (!backgroundResponse.ok) {
    throw new Error(`Background function responded ${backgroundResponse.status}`);
  }
}

async function handleNotification(
  request: Request,
  parsedBody: unknown,
  eventSubHeaders: EventSubHeaders,
  environment: AppEnvironment,
): Promise<Response> {
  const notificationResult: z.ZodSafeParseResult<NotificationPayload> = notificationPayloadSchema.safeParse(parsedBody);
  if (!notificationResult.success) {
    console.warn("[webhook] Ignoring notification with unexpected shape", notificationResult.error.issues);
    return emptyResponse(204);
  }
  const notificationPayload: NotificationPayload = notificationResult.data;

  if (notificationPayload.event.reward.id !== environment.TWITCH_REWARD_ID) {
    return emptyResponse(204);
  }

  // Twitch retries deliveries it considers failed; only the first copy of a message id is processed.
  const processedMessagesStore: Store = getStore({ name: PROCESSED_MESSAGES_STORE_NAME, consistency: "strong" });
  const dedupeResult: { modified: boolean } = await processedMessagesStore.set(
    eventSubHeaders.messageId,
    eventSubHeaders.messageTimestamp,
    { onlyIfNew: true },
  );
  if (!dedupeResult.modified) {
    console.log(`[webhook] Duplicate message ${eventSubHeaders.messageId} ignored`);
    return emptyResponse(204);
  }

  const redemptionJob: RedemptionJob = {
    redemptionId: notificationPayload.event.id,
    userLogin: notificationPayload.event.user_login,
    userName: notificationPayload.event.user_name,
    userInput: notificationPayload.event.user_input,
  };

  try {
    const requestOrigin: string = new URL(request.url).origin;
    await dispatchRedemptionJob(requestOrigin, environment.INTERNAL_SECRET, redemptionJob);
  } catch (dispatchError: unknown) {
    // Release the message id so the Twitch retry gets processed.
    console.error(`[webhook] Could not dispatch redemption ${redemptionJob.redemptionId}`, dispatchError);
    await processedMessagesStore.delete(eventSubHeaders.messageId);
    return emptyResponse(500);
  }

  console.log(`[webhook] Redemption ${redemptionJob.redemptionId} from ${redemptionJob.userLogin} dispatched`);
  return emptyResponse(204);
}

export default async (request: Request, _context: Context): Promise<Response> => {
  if (request.method !== "POST") {
    return emptyResponse(405);
  }

  const environment: AppEnvironment = getAppEnvironment();
  const eventSubHeaders: EventSubHeaders | null = readEventSubHeaders(request.headers);
  if (eventSubHeaders === null) {
    return emptyResponse(400);
  }

  // The signature is computed over the exact raw bytes, so read the body before parsing it.
  const rawBody: string = await request.text();
  if (!verifyEventSubSignature(environment.TWITCH_EVENTSUB_SECRET, eventSubHeaders, rawBody)) {
    console.warn(`[webhook] Invalid signature for message ${eventSubHeaders.messageId}`);
    return emptyResponse(403);
  }

  const parsedBody: unknown = parseJson(rawBody);
  if (parsedBody === undefined) {
    return emptyResponse(400);
  }

  const messageType: EventSubMessageType = eventSubHeaders.messageType as EventSubMessageType;
  switch (messageType) {
    case "webhook_callback_verification":
      return handleVerification(parsedBody);
    case "revocation":
      return handleRevocation(parsedBody);
    case "notification":
      return handleNotification(request, parsedBody, eventSubHeaders, environment);
    default:
      console.warn(`[webhook] Unknown message type ${eventSubHeaders.messageType}`);
      return emptyResponse(204);
  }
};

export const config: Config = {
  path: "/twitch-webhook",
};
