import { describe, expect, it } from "vitest";
import { extractVideoId } from "./youtube-url.js";

const EXPECTED_VIDEO_ID: string = "dQw4w9WgXcQ";

describe("extractVideoId", () => {
  it.each<string>([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
    "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RD",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc123",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://www.youtube.com/live/dQw4w9WgXcQ?feature=share",
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    "youtube.com/watch?v=dQw4w9WgXcQ",
    "youtu.be/dQw4w9WgXcQ",
    "HTTPS://WWW.YOUTUBE.COM/watch?v=dQw4w9WgXcQ",
  ])("extracts the id from %s", (videoUrl: string) => {
    expect(extractVideoId(videoUrl)).toBe(EXPECTED_VIDEO_ID);
  });

  it("finds the link inside surrounding text", () => {
    const redemptionText: string = "mira este video jaja https://youtu.be/dQw4w9WgXcQ está buenísimo";
    expect(extractVideoId(redemptionText)).toBe(EXPECTED_VIDEO_ID);
  });

  it("skips invalid links and uses the first valid one", () => {
    const redemptionText: string = "https://youtube.com/watch?v=short y https://youtu.be/dQw4w9WgXcQ";
    expect(extractVideoId(redemptionText)).toBe(EXPECTED_VIDEO_ID);
  });

  it.each<string>([
    "",
    "hola, pon algo bueno",
    "https://www.youtube.com/watch?v=tooShort",
    "https://www.youtube.com/watch?v=waytoolongvideoid",
    "https://www.youtube.com/@somechannel",
    "https://www.youtube.com/playlist?list=PL123",
    "https://notyoutube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
    "https://vimeo.com/123456789",
  ])("returns null for %s", (redemptionText: string) => {
    expect(extractVideoId(redemptionText)).toBeNull();
  });
});
