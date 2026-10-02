/** Sends a message to the channel chat. Implementations log failures and never throw. */
export interface ChatSender {
  sendMessage(message: string): Promise<void>;
}

export interface ChatCredentials {
  streamElementsChannelId: string;
  streamElementsJwt: string;
  twitchClientId: string;
  twitchBroadcasterId: string;
  /** Broadcaster user token with `user:write:chat`; enables the Twitch fallback when present. */
  twitchChatUserToken?: string;
}
