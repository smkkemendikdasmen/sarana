export type UserRole =
  | "SUPERADMIN"
  | "ADMIN"
  | "FASILITATOR_ALAT"
  | "FASILITATOR_ADMINISTRASI"
  | "SEKOLAH"
  | "KOORDINATOR_ALAT"
  | "PPK";

export interface AuthUser {
  id: string;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  organization: string;
  region: string;
}

export const roleSlugMap: Record<UserRole, string> = {
  SUPERADMIN: "superadmin",
  ADMIN: "admin",
  FASILITATOR_ALAT: "fasilitator-alat",
  FASILITATOR_ADMINISTRASI: "fasilitator-administrasi",
  SEKOLAH: "sekolah",
  KOORDINATOR_ALAT: "koordinator-alat",
  PPK: "ppk",
};

export const slugRoleMap = Object.fromEntries(
  Object.entries(roleSlugMap).map(([role, slug]) => [slug, role]),
) as Record<string, UserRole>;
