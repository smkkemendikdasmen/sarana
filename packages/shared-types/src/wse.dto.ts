import { z } from 'zod';
import type { NpsnChar8 } from './branded-types';

const NpsnChar8Schema = z.string().length(8) as unknown as z.ZodType<NpsnChar8>;

export const WseUpdateReqSchema = z.object({
  npsn: NpsnChar8Schema,
  version: z.number().int().min(1),
  data_json: z.record(z.any()),
  data_sha256: z.string().optional(),
});

export type WseUpdateReq = z.infer<typeof WseUpdateReqSchema>;

export const WseRespSchema = z.object({
  npsn: NpsnChar8Schema,
  version: z.number().int().min(1),
  data_json: z.record(z.any()),
  data_sha256: z.string().optional().nullable(),
  updated_at: z.string().datetime(),
  updated_by: z.union([z.string(), z.number()]),
});

export type WseResp = z.infer<typeof WseRespSchema>;

export const WseOptimisticLockErrSchema = z.object({
  code: z.literal('OPTIMISTIC_LOCK'),
  expected_version: z.number().int(),
  current_version: z.number().int(),
});

export type WseOptimisticLockErr = z.infer<typeof WseOptimisticLockErrSchema>;
