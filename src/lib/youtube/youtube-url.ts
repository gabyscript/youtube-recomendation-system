const VIDEO_ID_PATTERN: RegExp = /^[A-Za-z0-9_-]{11}$/;

/** Finds YouTube-looking URLs (with or without scheme) inside free text. */
const YOUTUBE_URL_CANDIDATE_PATTERN: RegExp =
  /(?<![\w.-])(?:https?:\/\/)?(?:[\w-]+\.)*(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^\s<>"']*/gi;

const SHORT_LINK_HOSTNAMES: ReadonlySet<string> = new Set(["youtu.be", "www.youtu.be"]);

const FULL_SITE_HOSTNAMES: ReadonlySet<string> = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const VIDEO_PATH_PREFIXES: readonly string[] = ["/shorts/", "/embed/", "/live/", "/v/"];

function parseVideoIdFromUrl(urlCandidate: string): string | null {
  const urlWithScheme: string = /^https?:\/\//i.test(urlCandidate) ? urlCandidate : `https://${urlCandidate}`;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlWithScheme);
  } catch {
    return null;
  }

  const hostname: string = parsedUrl.hostname.toLowerCase();
  const pathname: string = parsedUrl.pathname;
  let candidateVideoId: string | null = null;

  if (SHORT_LINK_HOSTNAMES.has(hostname)) {
    candidateVideoId = pathname.split("/")[1] ?? null;
  } else if (FULL_SITE_HOSTNAMES.has(hostname)) {
    if (pathname === "/watch") {
      candidateVideoId = parsedUrl.searchParams.get("v");
    } else {
      const matchingPrefix: string | undefined = VIDEO_PATH_PREFIXES.find((pathPrefix: string) =>
        pathname.startsWith(pathPrefix),
      );
      if (matchingPrefix) {
        candidateVideoId = pathname.slice(matchingPrefix.length).split("/")[0] ?? null;
      }
    }
  }

  return candidateVideoId !== null && VIDEO_ID_PATTERN.test(candidateVideoId) ? candidateVideoId : null;
}

/**
 * Extracts the 11-character video id from the first valid YouTube link found in `text`.
 * Supports watch, youtu.be, mobile, music, shorts, embed and live URLs, even when the
 * link is surrounded by other text. Returns `null` when no valid link is found.
 */
export function extractVideoId(text: string): string | null {
  for (const urlMatch of text.matchAll(YOUTUBE_URL_CANDIDATE_PATTERN)) {
    const videoId: string | null = parseVideoIdFromUrl(urlMatch[0]);
    if (videoId !== null) {
      return videoId;
    }
  }
  return null;
}
