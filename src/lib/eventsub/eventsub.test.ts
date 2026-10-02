import { describe, expect, it } from "vitest";
import type { EventSubHeaders } from "../../types/eventsub/eventsub.js";
import { computeEventSubSignature, readEventSubHeaders, verifyEventSubSignature } from "./eventsub.js";

const EVENTSUB_SECRET: string = "test-secret-1234567890";
const MESSAGE_ID: string = "e76c6bd4-55c9-4987-8304-da1588d8988b";
const MESSAGE_TIMESTAMP: string = "2026-10-01T12:00:00.000Z";
const RAW_BODY: string = '{"subscription":{"id":"abc"},"event":{"user_input":"https://youtu.be/dQw4w9WgXcQ"}}';
const MESSAGE_TIME_MILLISECONDS: number = Date.parse(MESSAGE_TIMESTAMP);

function buildHeaders(messageSignature: string, messageTimestamp: string = MESSAGE_TIMESTAMP): EventSubHeaders {
  return { messageId: MESSAGE_ID, messageTimestamp, messageSignature, messageType: "notification" };
}

describe("verifyEventSubSignature", () => {
  const validSignature: string = computeEventSubSignature(EVENTSUB_SECRET, MESSAGE_ID, MESSAGE_TIMESTAMP, RAW_BODY);

  it("accepts a correctly signed, fresh message", () => {
    expect(
      verifyEventSubSignature(EVENTSUB_SECRET, buildHeaders(validSignature), RAW_BODY, MESSAGE_TIME_MILLISECONDS + 1000),
    ).toBe(true);
  });

  it("rejects a message signed with another secret", () => {
    const foreignSignature: string = computeEventSubSignature("another-secret-123", MESSAGE_ID, MESSAGE_TIMESTAMP, RAW_BODY);
    expect(
      verifyEventSubSignature(EVENTSUB_SECRET, buildHeaders(foreignSignature), RAW_BODY, MESSAGE_TIME_MILLISECONDS),
    ).toBe(false);
  });

  it("rejects a tampered body", () => {
    const tamperedBody: string = RAW_BODY.replace("dQw4w9WgXcQ", "aaaaaaaaaaa");
    expect(
      verifyEventSubSignature(EVENTSUB_SECRET, buildHeaders(validSignature), tamperedBody, MESSAGE_TIME_MILLISECONDS),
    ).toBe(false);
  });

  it("rejects a malformed signature header", () => {
    expect(verifyEventSubSignature(EVENTSUB_SECRET, buildHeaders("sha256=xyz"), RAW_BODY, MESSAGE_TIME_MILLISECONDS)).toBe(
      false,
    );
  });

  it("rejects messages older than 10 minutes", () => {
    const elevenMinutesLater: number = MESSAGE_TIME_MILLISECONDS + 11 * 60 * 1000;
    expect(verifyEventSubSignature(EVENTSUB_SECRET, buildHeaders(validSignature), RAW_BODY, elevenMinutesLater)).toBe(
      false,
    );
  });

  it("rejects an unparseable timestamp", () => {
    expect(
      verifyEventSubSignature(EVENTSUB_SECRET, buildHeaders(validSignature, "not-a-date"), RAW_BODY, MESSAGE_TIME_MILLISECONDS),
    ).toBe(false);
  });
});

describe("readEventSubHeaders", () => {
  it("returns null when a header is missing", () => {
    const incompleteHeaders: Headers = new Headers({ "Twitch-Eventsub-Message-Id": MESSAGE_ID });
    expect(readEventSubHeaders(incompleteHeaders)).toBeNull();
  });

  it("reads headers case-insensitively", () => {
    const requestHeaders: Headers = new Headers({
      "Twitch-Eventsub-Message-Id": MESSAGE_ID,
      "Twitch-Eventsub-Message-Timestamp": MESSAGE_TIMESTAMP,
      "Twitch-Eventsub-Message-Signature": "sha256=abc",
      "Twitch-Eventsub-Message-Type": "notification",
    });
    expect(readEventSubHeaders(requestHeaders)).toEqual(buildHeaders("sha256=abc"));
  });
});
