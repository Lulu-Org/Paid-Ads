import { z } from "zod";
import { listQuerySchema } from "./common";

export const approvalInboxQuerySchema = listQuerySchema.extend({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

export type ApprovalInboxQuery = z.infer<typeof approvalInboxQuerySchema>;