import type { z } from "zod";
import type { appEnvironmentSchema, setupEnvironmentSchema } from "../../lib/common/env.js";

/** Variables required by the Netlify functions at runtime. */
export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;

/** Subset of variables required by `scripts/setup-eventsub.ts`. */
export type SetupEnvironment = z.infer<typeof setupEnvironmentSchema>;
