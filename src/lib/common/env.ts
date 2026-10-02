import { z } from "zod";
import type { AppEnvironment, SetupEnvironment } from "../../types/common/env.js";

const requiredString: z.ZodString = z.string().min(1);

export const appEnvironmentSchema = z.object({
  TWITCH_CLIENT_ID: requiredString,
  TWITCH_CLIENT_SECRET: requiredString,
  TWITCH_EVENTSUB_SECRET: z.string().min(10).max(100),
  TWITCH_BROADCASTER_ID: requiredString,
  TWITCH_REWARD_ID: requiredString,
  YOUTUBE_PLAYLIST_ID: requiredString,
  GOOGLE_CLIENT_ID: requiredString,
  GOOGLE_CLIENT_SECRET: requiredString,
  GOOGLE_REFRESH_TOKEN: requiredString,
  SE_CHANNEL_ID: requiredString,
  SE_JWT: requiredString,
  INTERNAL_SECRET: requiredString,
  TWITCH_CHAT_USER_TOKEN: requiredString.optional(),
});

export const setupEnvironmentSchema = appEnvironmentSchema
  .pick({
    TWITCH_CLIENT_ID: true,
    TWITCH_CLIENT_SECRET: true,
    TWITCH_EVENTSUB_SECRET: true,
    TWITCH_BROADCASTER_ID: true,
    TWITCH_REWARD_ID: true,
  })
  .extend({
    WEBHOOK_URL: z.url().optional(),
  });

/** Drops empty values so that `VAR=` in a .env file counts as "not set". */
function withoutEmptyValues(environmentSource: NodeJS.ProcessEnv): Record<string, string> {
  const filteredEnvironment: Record<string, string> = {};
  for (const [variableName, variableValue] of Object.entries(environmentSource)) {
    if (variableValue !== undefined && variableValue.trim() !== "") {
      filteredEnvironment[variableName] = variableValue.trim();
    }
  }
  return filteredEnvironment;
}

export function parseEnvironment<Schema extends z.ZodType>(
  schema: Schema,
  environmentSource: NodeJS.ProcessEnv = process.env,
): z.infer<Schema> {
  const parseResult: z.ZodSafeParseResult<z.infer<Schema>> = schema.safeParse(withoutEmptyValues(environmentSource));
  if (!parseResult.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parseResult.error)}`);
  }
  return parseResult.data;
}

let cachedAppEnvironment: AppEnvironment | undefined;

export function getAppEnvironment(): AppEnvironment {
  cachedAppEnvironment ??= parseEnvironment(appEnvironmentSchema);
  return cachedAppEnvironment;
}

export function getSetupEnvironment(): SetupEnvironment {
  return parseEnvironment(setupEnvironmentSchema);
}
