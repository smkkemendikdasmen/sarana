import { z } from 'zod';

export const HealthRespSchema = z.object({
  ok: z.literal(true),
  slot: z.string().optional(),
  ts: z.string().datetime(),
  uptimeMs: z.number().int(),
  memRssMb: z.number(),
});

export type HealthResp = z.infer<typeof HealthRespSchema>;
