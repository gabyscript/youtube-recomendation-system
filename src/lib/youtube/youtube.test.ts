import { describe, expect, it } from "vitest";
import type { GoogleApiErrorShape } from "../../types/youtube/youtube.js";
import { isYouTubeServiceUnavailableError } from "./youtube.js";

describe("isYouTubeServiceUnavailableError", () => {
  it.each<[string, GoogleApiErrorShape]>([
    ["quota exceeded", { response: { status: 403, data: { error: { errors: [{ reason: "quotaExceeded" }] } } } }],
    ["daily limit", { response: { status: 403, data: { error: { errors: [{ reason: "dailyLimitExceeded" }] } } } }],
    ["revoked refresh token", { response: { status: 400, data: { error: "invalid_grant" } } }],
    ["unauthorized", { response: { status: 401, data: {} } }],
    ["invalid_grant in message", { message: "invalid_grant: Token has been expired or revoked." }],
  ])("detects %s", (_caseName: string, googleError: GoogleApiErrorShape) => {
    expect(isYouTubeServiceUnavailableError(googleError)).toBe(true);
  });

  it.each<[string, unknown]>([
    ["playlist not found", { response: { status: 404, data: { error: { errors: [{ reason: "playlistNotFound" }] } } } }],
    ["network error", new Error("ECONNRESET")],
    ["null", null],
  ])("ignores %s", (_caseName: string, error: unknown) => {
    expect(isYouTubeServiceUnavailableError(error)).toBe(false);
  });
});
