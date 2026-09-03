import { z } from 'zod';
import type { NpsnChar8, UserRoleCode } from './branded-types';

export const LoginReqSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export type LoginReq = z.infer<typeof LoginReqSchema>;

const UserRoleCodeEnum = z.enum([
  'ADMIN',
  'FASILITATOR_ADMINISTRASI',
  'FASILITATOR_ALAT',
  'SEKOLAH',
]) as unknown as z.ZodType<UserRoleCode>;

const NpsnChar8Schema = z.string().length(8) as unknown as z.ZodType<NpsnChar8>;

export const AuthClaimsSchema = z.object({
  npsn: NpsnChar8Schema,
  role: UserRoleCodeEnum,
  user_id: z.union([z.string(), z.number()]),
});

export type AuthClaims = z.infer<typeof AuthClaimsSchema>;

export const LoginRespSchema = z.object({
  ok: z.boolean(),
  token: z.string().optional(),
  claims: AuthClaimsSchema.optional(),
});

export type LoginResp = z.infer<typeof LoginRespSchema>;
