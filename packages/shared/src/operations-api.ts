import { z } from "zod";
import { idSchema, listQuerySchema } from "./common";

export const syncRunsQuerySchema = listQuerySchema.pick({ page: true, pageSize: true });
export const userIdParamSchema = z.object({ userId: idSchema });

export type SyncRunsQuery = z.infer<typeof syncRunsQuerySchema>;