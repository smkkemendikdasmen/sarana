import { z } from 'zod';
import type { NpsnChar8, UserRoleCode } from './branded-types';

const NpsnChar8Schema = z.string().length(8) as unknown as z.ZodType<NpsnChar8>;
const UserRoleCodeEnum = z.enum([
  'ADMIN',
  'FASILITATOR_ADMINISTRASI',
  'FASILITATOR_ALAT',
  'SEKOLAH',
]) as unknown as z.ZodType<UserRoleCode>;

export const AssignmentDTOSchema = z.object({
  id: z.union([z.string(), z.number()]),
  npsn: NpsnChar8Schema,
  user_id: z.union([z.string(), z.number()]),
  role: UserRoleCodeEnum,
  status: z.string(),
});

export type AssignmentDTO = z.infer<typeof AssignmentDTOSchema>;
