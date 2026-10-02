import { z } from "zod";

/** Header that authorizes `twitch-webhook` to trigger the background function. */
export const INTERNAL_SECRET_HEADER_NAME: string = "x-internal-secret";

export const PROCESS_REDEMPTION_FUNCTION_PATH: string = "/.netlify/functions/process-redemption-background";

export const redemptionJobSchema = z.object({
  redemptionId: z.string().min(1),
  userLogin: z.string().min(1),
  userName: z.string().min(1),
  userInput: z.string(),
});
