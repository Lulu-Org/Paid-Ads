import { z } from "zod";
import { adPlatformSchema } from "./campaign";

// HTTP form of reportRunQuerySchema: platforms arrive as "google_ads,meta_ads" (empty = all).
export const reportRunHttpQuerySchema = z
    .object({
        from: z.iso.date(),
        to: z.iso.date(),
        platforms: z
        .string()
        .default("")
        .transform((value) =>
            value
            .split(",")
            .map((part) => part.trim())
            .filter((part) => part.length > 0),
        )
        .pipe(z.array(adPlatformSchema)),
    })
    .refine((query) => query.from <= query.to, { path: ["to"], message: "errors.validation.invalid_range" });

export type ReportRunHttpQuery = z.infer<typeof reportRunHttpQuerySchema>;