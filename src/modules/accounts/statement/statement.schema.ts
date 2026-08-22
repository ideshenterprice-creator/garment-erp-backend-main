import { z } from "zod";

export const statementQuerySchema = z.object({
  partyId: z.string().uuid(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export type StatementQuery = z.infer<typeof statementQuerySchema>;
