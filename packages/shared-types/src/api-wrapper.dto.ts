import { z } from 'zod';

export const ApiOkRespSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
    traceId: z.string(),
    ts: z.string().datetime(),
  });

export type ApiOkResp<T> = {
  ok: true;
  data: T;
  traceId: string;
  ts: string;
};

export const ApiErrRespSchema = z.object({
  ok: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    traceId: z.string(),
    statusCode: z.number().int(),
  }),
});

export type ApiErrResp = z.infer<typeof ApiErrRespSchema>;
