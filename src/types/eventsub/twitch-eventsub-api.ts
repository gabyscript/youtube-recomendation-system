export interface TwitchAppAccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface TwitchEventSubSubscriptionRecord {
  id: string;
  status: string;
  type: string;
  version: string;
  condition: Record<string, string>;
  transport: {
    method: string;
    callback?: string;
  };
  created_at: string;
}

export interface TwitchEventSubSubscriptionListResponse {
  data: TwitchEventSubSubscriptionRecord[];
  total: number;
  pagination: {
    cursor?: string;
  };
}
