// Crea la suscripción EventSub channel.channel_points_custom_reward_redemption.add apuntando a twitch-webhook.
// Uso: npm run setup:eventsub -- [https://<sitio>.netlify.app/twitch-webhook] [--force]
import { getSetupEnvironment } from "../src/lib/common/env.js";
import type { SetupEnvironment } from "../src/types/common/env.js";
import type {
  TwitchAppAccessTokenResponse,
  TwitchEventSubSubscriptionListResponse,
  TwitchEventSubSubscriptionRecord,
} from "../src/types/eventsub/twitch-eventsub-api.js";

const TWITCH_TOKEN_URL: string = "https://id.twitch.tv/oauth2/token";
const TWITCH_AUTHORIZE_URL: string = "https://id.twitch.tv/oauth2/authorize";
const TWITCH_SUBSCRIPTIONS_URL: string = "https://api.twitch.tv/helix/eventsub/subscriptions";
const REDEMPTION_SUBSCRIPTION_TYPE: string = "channel.channel_points_custom_reward_redemption.add";
const ACTIVE_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set(["enabled", "webhook_callback_verification_pending"]);

function loadDotEnvFile(): void {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Without a .env file the variables must already be in the environment.
  }
}

async function requestAppAccessToken(environment: SetupEnvironment): Promise<string> {
  const tokenRequestBody: URLSearchParams = new URLSearchParams({
    client_id: environment.TWITCH_CLIENT_ID,
    client_secret: environment.TWITCH_CLIENT_SECRET,
    grant_type: "client_credentials",
  });
  const tokenResponse: Response = await fetch(TWITCH_TOKEN_URL, { method: "POST", body: tokenRequestBody });
  if (!tokenResponse.ok) {
    throw new Error(`Could not get app access token (${tokenResponse.status}): ${await tokenResponse.text()}`);
  }
  const tokenPayload: TwitchAppAccessTokenResponse = (await tokenResponse.json()) as TwitchAppAccessTokenResponse;
  return tokenPayload.access_token;
}

function buildTwitchHeaders(environment: SetupEnvironment, appAccessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${appAccessToken}`,
    "Client-Id": environment.TWITCH_CLIENT_ID,
    "Content-Type": "application/json",
  };
}

async function listRedemptionSubscriptions(
  environment: SetupEnvironment,
  twitchHeaders: Record<string, string>,
): Promise<TwitchEventSubSubscriptionRecord[]> {
  const collectedSubscriptions: TwitchEventSubSubscriptionRecord[] = [];
  let paginationCursor: string | undefined;

  do {
    const listUrl: URL = new URL(TWITCH_SUBSCRIPTIONS_URL);
    listUrl.searchParams.set("type", REDEMPTION_SUBSCRIPTION_TYPE);
    if (paginationCursor) {
      listUrl.searchParams.set("after", paginationCursor);
    }
    const listResponse: Response = await fetch(listUrl, { headers: twitchHeaders });
    if (!listResponse.ok) {
      throw new Error(`Could not list subscriptions (${listResponse.status}): ${await listResponse.text()}`);
    }
    const listPayload: TwitchEventSubSubscriptionListResponse =
      (await listResponse.json()) as TwitchEventSubSubscriptionListResponse;
    collectedSubscriptions.push(...listPayload.data);
    paginationCursor = listPayload.pagination.cursor;
  } while (paginationCursor);

  return collectedSubscriptions.filter(
    (subscription: TwitchEventSubSubscriptionRecord) =>
      subscription.condition.broadcaster_user_id === environment.TWITCH_BROADCASTER_ID,
  );
}

async function deleteSubscription(twitchHeaders: Record<string, string>, subscriptionId: string): Promise<void> {
  const deleteUrl: URL = new URL(TWITCH_SUBSCRIPTIONS_URL);
  deleteUrl.searchParams.set("id", subscriptionId);
  const deleteResponse: Response = await fetch(deleteUrl, { method: "DELETE", headers: twitchHeaders });
  if (!deleteResponse.ok) {
    throw new Error(`Could not delete subscription ${subscriptionId} (${deleteResponse.status})`);
  }
}

function printAuthorizationHelp(environment: SetupEnvironment): void {
  const authorizeUrl: URL = new URL(TWITCH_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", environment.TWITCH_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", "http://localhost");
  authorizeUrl.searchParams.set("response_type", "token");
  authorizeUrl.searchParams.set("scope", "channel:read:redemptions");
  console.error(
    [
      "Twitch rechazó la suscripción: el canal todavía no autorizó la app con el scope channel:read:redemptions.",
      "Abre esta URL logueado con la cuenta del canal (http://localhost debe estar registrado como Redirect URL de la app):",
      authorizeUrl.toString(),
      "Después vuelve a correr este script.",
    ].join("\n"),
  );
}

async function createSubscription(
  environment: SetupEnvironment,
  twitchHeaders: Record<string, string>,
  callbackUrl: string,
): Promise<void> {
  const createResponse: Response = await fetch(TWITCH_SUBSCRIPTIONS_URL, {
    method: "POST",
    headers: twitchHeaders,
    body: JSON.stringify({
      type: REDEMPTION_SUBSCRIPTION_TYPE,
      version: "1",
      condition: {
        broadcaster_user_id: environment.TWITCH_BROADCASTER_ID,
        reward_id: environment.TWITCH_REWARD_ID,
      },
      transport: {
        method: "webhook",
        callback: callbackUrl,
        secret: environment.TWITCH_EVENTSUB_SECRET,
      },
    }),
  });

  if (createResponse.status === 403) {
    printAuthorizationHelp(environment);
    process.exitCode = 1;
    return;
  }
  if (!createResponse.ok) {
    throw new Error(`Could not create subscription (${createResponse.status}): ${await createResponse.text()}`);
  }
  const createPayload: TwitchEventSubSubscriptionListResponse =
    (await createResponse.json()) as TwitchEventSubSubscriptionListResponse;
  const createdSubscription: TwitchEventSubSubscriptionRecord | undefined = createPayload.data[0];
  console.log(`Suscripción creada: ${createdSubscription?.id} (estado: ${createdSubscription?.status})`);
  console.log("Twitch enviará el challenge a la función; revisa los logs de twitch-webhook para confirmar.");
}

async function main(): Promise<void> {
  loadDotEnvFile();
  const environment: SetupEnvironment = getSetupEnvironment();
  const commandLineArguments: string[] = process.argv.slice(2);
  const shouldForceRecreate: boolean = commandLineArguments.includes("--force");
  const callbackUrl: string | undefined =
    commandLineArguments.find((argument: string) => !argument.startsWith("--")) ?? environment.WEBHOOK_URL;

  if (!callbackUrl || !callbackUrl.startsWith("https://")) {
    throw new Error("Indica la URL HTTPS del webhook como argumento o en WEBHOOK_URL (ej. https://<sitio>.netlify.app/twitch-webhook)");
  }

  const appAccessToken: string = await requestAppAccessToken(environment);
  const twitchHeaders: Record<string, string> = buildTwitchHeaders(environment, appAccessToken);
  const existingSubscriptions: TwitchEventSubSubscriptionRecord[] = await listRedemptionSubscriptions(
    environment,
    twitchHeaders,
  );

  const reusableSubscription: TwitchEventSubSubscriptionRecord | undefined = shouldForceRecreate
    ? undefined
    : existingSubscriptions.find(
        (subscription: TwitchEventSubSubscriptionRecord) =>
          subscription.transport.callback === callbackUrl &&
          subscription.condition.reward_id === environment.TWITCH_REWARD_ID &&
          ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status),
      );

  for (const staleSubscription of existingSubscriptions) {
    if (staleSubscription.id === reusableSubscription?.id) {
      continue;
    }
    console.log(
      `Eliminando suscripción ${staleSubscription.id} (${staleSubscription.status} → ${staleSubscription.transport.callback})`,
    );
    await deleteSubscription(twitchHeaders, staleSubscription.id);
  }

  if (reusableSubscription) {
    console.log(
      `Ya existe una suscripción activa para ${callbackUrl} (${reusableSubscription.id}). Usa --force para recrearla.`,
    );
    return;
  }

  await createSubscription(environment, twitchHeaders, callbackUrl);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
