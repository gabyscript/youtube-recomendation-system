import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatCredentials, ChatSender } from "../../types/chat/chat.js";
import { createChatSender } from "./chat.js";

const baseCredentials: ChatCredentials = {
  streamElementsChannelId: "se-channel",
  streamElementsJwt: "se-jwt",
  twitchClientId: "twitch-client",
  twitchBroadcasterId: "12345",
};

function jsonResponse(responseBody: unknown, httpStatus: number = 200): Response {
  return new Response(JSON.stringify(responseBody), { status: httpStatus });
}

describe("createChatSender", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation((): void => {});
    vi.spyOn(console, "error").mockImplementation((): void => {});
  });

  it("sends through StreamElements when it works", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => jsonResponse({}));
    const chatSender: ChatSender = createChatSender(baseCredentials, fetchMock as unknown as typeof fetch);

    await chatSender.sendMessage("hola");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.streamelements.com/kappa/v2/bot/se-channel/say",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("falls back to Twitch when StreamElements fails", async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ data: [{ message_id: "m1", is_sent: true }] }));
    const chatSender: ChatSender = createChatSender(
      { ...baseCredentials, twitchChatUserToken: "user-token" },
      fetchMock as unknown as typeof fetch,
    );

    await chatSender.sendMessage("hola");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]).toEqual([
      "https://api.twitch.tv/helix/chat/messages",
      expect.objectContaining({ method: "POST" }),
    ]);
  });

  it("does not throw when every channel fails", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => {
      throw new Error("network down");
    });
    const chatSender: ChatSender = createChatSender(
      { ...baseCredentials, twitchChatUserToken: "user-token" },
      fetchMock as unknown as typeof fetch,
    );

    await expect(chatSender.sendMessage("hola")).resolves.toBeUndefined();
  });

  it("skips the fallback when no Twitch token is configured", async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => jsonResponse({}, 500));
    const chatSender: ChatSender = createChatSender(baseCredentials, fetchMock as unknown as typeof fetch);

    await chatSender.sendMessage("hola");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
