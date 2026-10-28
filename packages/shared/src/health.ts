import { z } from "zod";

export const dependencyStatusSchema = z.enum(["ok", "down"]);

export const healthStatusSchema = z.object({
  data: z.object({
    // "degraded" when any dependency check fails; the HTTP status is 503 (see docs/api.md).
    status: z.enum(["ok", "degraded"]),
    checks: z.object({
      database: dependencyStatusSchema,
      redis: dependencyStatusSchema,
    }),
  }),
});

export const healthLiveSchema = z.object({
  data: z.object({
    status: z.literal("ok"),
  }),
});

export type DependencyStatus = z.infer<typeof dependencyStatusSchema>;
export type HealthStatus = z.infer<typeof healthStatusSchema>;
export type HealthLiveStatus = z.infer<typeof healthLiveSchema>;
