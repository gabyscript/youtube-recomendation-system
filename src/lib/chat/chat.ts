import type { ChatCredentials, ChatSender } from "../../types/chat/chat.js";
import type { TwitchSendChatMessageResponse, TwitchSentChatMessage } from "../../types/chat/twitch-chat-api.js";

const STREAMELEMENTS_API_BASE_URL: string = "https://api.streamelements.com/kappa/v2";
const TWITCH_SEND_CHAT_MESSAGE_URL: string = "https://api.twitch.tv/helix/chat/messages";
const TWITCH_CHAT_MESSAGE_MAX_LENGTH: number = 500;

async function sendWithStreamElements(
  credentials: ChatCredentials,
  message: string,
  fetchImplementation: typeof fetch,
): Promise<void> {
  const streamElementsUrl: string = `${STREAMELEMENTS_API_BASE_URL}/bot/${encodeURIComponent(credentials.streamElementsChannelId)}/say`;
  const response: Response = await fetchImplementation(streamElementsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${credentials.streamElementsJwt}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) {
    const responseText: string = await response.text();
    throw new Error(`StreamElements responded ${response.status}: ${responseText}`);
  }
}

async function sendWithTwitch(
  credentials: ChatCredentials,
  twitchChatUserToken: string,
  message: string,
  fetchImplementation: typeof fetch,
): Promise<void> {
  const response: Response = await fetchImplementation(TWITCH_SEND_CHAT_MESSAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${twitchChatUserToken}`,
      "Client-Id": credentials.twitchClientId,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      broadcaster_id: credentials.twitchBroadcasterId,
      sender_id: credentials.twitchBroadcasterId,
      message,
    }),
  });
  if (!response.ok) {
    const responseText: string = await response.text();
    throw new Error(`Twitch chat responded ${response.status}: ${responseText}`);
  }
  const sendChatMessageResponse: TwitchSendChatMessageResponse = (await response.json()) as TwitchSendChatMessageResponse;
  const sentMessage: TwitchSentChatMessage | undefined = sendChatMessageResponse.data[0];
  if (!sentMessage?.is_sent) {
    throw new Error(`Twitch dropped the chat message: ${sentMessage?.drop_reason?.message ?? "unknown reason"}`);
  }
}

/**
 * Sends through the StreamElements bot and falls back to the broadcaster account
 * (Twitch Send Chat Message) when StreamElements fails and a user token is configured.
 */
export function createChatSender(
  credentials: ChatCredentials,
  fetchImplementation: typeof fetch = fetch,
): ChatSender {
  return {
    async sendMessage(message: string): Promise<void> {
      const truncatedMessage: string = message.slice(0, TWITCH_CHAT_MESSAGE_MAX_LENGTH);

      try {
        await sendWithStreamElements(credentials, truncatedMessage, fetchImplementation);
        return;
      } catch (streamElementsError: unknown) {
        console.warn("[chat] StreamElements failed, trying fallback", streamElementsError);
      }

      if (!credentials.twitchChatUserToken) {
        console.error("[chat] No fallback configured (TWITCH_CHAT_USER_TOKEN); message not sent:", truncatedMessage);
        return;
      }

      try {
        await sendWithTwitch(credentials, credentials.twitchChatUserToken, truncatedMessage, fetchImplementation);
      } catch (twitchError: unknown) {
        console.error("[chat] Twitch fallback failed; message not sent:", truncatedMessage, twitchError);
      }
    },
  };
}
