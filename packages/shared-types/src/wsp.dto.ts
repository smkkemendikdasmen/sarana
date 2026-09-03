import { z } from 'zod';
import type { NpsnChar8 } from './branded-types';

const NpsnChar8Schema = z.string().length(8) as unknown as z.ZodType<NpsnChar8>;

export const WspUpdateReqSchema = z.object({
  npsn: NpsnChar8Schema,
  version: z.number().int().min(1),
  data_json: z.record(z.any()),
  data_sha256: z.string().optional(),
});

export type WspUpdateReq = z.infer<typeof WspUpdateReqSchema>;

export const WspRespSchema = z.object({
  npsn: NpsnChar8Schema,
  version: z.number().int().min(1),
  data_json: z.record(z.any()),
  data_sha256: z.string().optional().nullable(),
  updated_at: z.string().datetime(),
  updated_by: z.union([z.string(), z.number()]),
});

export type WspResp = z.infer<typeof WspRespSchema>;

export const OptimisticLockErrSchema = z.object({
  code: z.literal('OPTIMISTIC_LOCK'),
  expected_version: z.number().int(),
  current_version: z.number().int(),
});

export type OptimisticLockErr = z.infer<typeof OptimisticLockErrSchema>;
