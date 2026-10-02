export interface TwitchSentChatMessage {
  message_id: string;
  is_sent: boolean;
  drop_reason?: {
    code: string;
    message: string;
  } | null;
}

export interface TwitchSendChatMessageResponse {
  data: TwitchSentChatMessage[];
}
