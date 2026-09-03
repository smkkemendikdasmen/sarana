import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BookOpen,
  BookText,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSignature,
  FileSpreadsheet,
  Gauge,
  GraduationCap,
  HardHat,
  LifeBuoy,
  NotebookPen,
  Printer,
  ScrollText,
  ShieldCheck,
  UserCog,
  Wrench,
} from "lucide-react";

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
  fullName: string;
  role: UserRole;
  organization: string;
  region: string;
  balai?: string | null;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  mustChangePassword?: boolean;
}

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group?: string;
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

export const roleLabels: Record<UserRole, string> = {
  SUPERADMIN: "Superadmin",
  ADMIN: "Admin",
  FASILITATOR_ALAT: "Fasilitator Alat",
  FASILITATOR_ADMINISTRASI: "Fasilitator Administrasi",
  SEKOLAH: "Sekolah",
  KOORDINATOR_ALAT: "Koordinator Alat",
  PPK: "PPK",
};

export const dashboardPath = (role: UserRole) => `/dashboard/${roleSlugMap[role]}`;

const _ADMIN_BASE_NAV: NavItem[] = [
  {
    href: "/admin/sekolah-penerima/reguler",
    label: "Sekolah Penerima",
    icon: Building2,
    group: "Data Utama",
  },
  {
    href: "/admin/pagu-anggaran",
    label: "Pagu Anggaran",
    icon: FileSpreadsheet,
    group: "Data Utama",
  },
  {
    href: "/admin/konsentrasi-rekomendasi",
    label: "Konsentrasi Rekomendasi",
    icon: GraduationCap,
    group: "Data Utama",
  },
  {
    href: "/admin/data-banper-2026/abt/proses-seleksi",
    label: "Proses Seleksi",
    icon: ClipboardCheck,
    group: "Data Banper 2026",
  },
  {
    href: "/admin/verifikasi-online",
    label: "Verifikasi Online",
    icon: CheckCircle2,
    group: "Tahapan Utama",
  },
  {
    href: "/admin/wawancara",
    label: "Wawancara",
    icon: BookOpen,
    group: "Tahapan Utama",
  },
  {
    href: "/admin/pra-bimtek",
    label: "Pra Bimtek",
    icon: ClipboardCheck,
    group: "Tahapan Utama",
  },
  {
    href: "/admin/bimbingan-teknis",
    label: "Bimtek",
    icon: HardHat,
    group: "Tahapan Utama",
  },
  {
    href: "/admin/data-siap-print",
    label: "Siap Print",
    icon: Printer,
    group: "Tahapan Utama",
  },
  {
    href: "/admin/master-data/data-alat-perdirjen",
    label: "Alat Perdirjen",
    icon: Database,
    group: "Master Data",
  },
  {
    href: "/admin/master-data/data-cp-fase-f",
    label: "CP Fase F",
    icon: BookText,
    group: "Master Data",
  },
  {
    href: "/admin/master-data/template-rpd-pks",
    label: "Template Dokumen",
    icon: FileSpreadsheet,
    group: "Master Data",
  },
  {
    href: "/admin/pengguna",
    label: "Pengguna",
    icon: UserCog,
    group: "Pengaturan",
  },
  {
    href: "/admin/laporan",
    label: "Laporan Terpadu",
    icon: BarChart3,
    group: "Pelaporan",
  },
  {
    href: "/admin/audit-log",
    label: "Audit Log",
    icon: ScrollText,
    group: "Pengaturan",
  },
];

export const navigationByRole: Record<UserRole, NavItem[]> = {
  SUPERADMIN: [
    { href: dashboardPath("SUPERADMIN"), label: "Dashboard", icon: ShieldCheck },
    ..._ADMIN_BASE_NAV,
    {
      href: "/admin/version-changelog",
      label: "Versi Rilis",
      icon: NotebookPen,
      group: "Pengaturan",
    },
  ],
  ADMIN: [
    { href: dashboardPath("ADMIN"), label: "Dashboard", icon: Gauge },
    ..._ADMIN_BASE_NAV,
  ],
  FASILITATOR_ALAT: [
    { href: dashboardPath("FASILITATOR_ALAT"), label: "Dashboard", icon: Wrench },
    {
      href: "/fasilitator-alat/verifikasi-online",
      label: "Verifikasi Online",
      icon: CheckCircle2,
      group: "Tahapan Bimbingan",
    },
    {
      href: "/fasilitator-alat/wawancara",
      label: "Wawancara",
      icon: BookOpen,
      group: "Tahapan Bimbingan",
    },
    {
      href: "/fasilitator-alat/pra-bimtek",
      label: "Pra Bimtek",
      icon: ClipboardCheck,
      group: "Tahapan Bimbingan",
    },
    {
      href: "/fasilitator-alat/bimbingan-teknis",
      label: "Bimtek",
      icon: HardHat,
      group: "Tahapan Bimbingan",
    },
    {
      href: "/fasilitator-alat/data-dampingan",
      label: "Data Dampingan",
      icon: FileSpreadsheet,
      group: "Pelaporan",
    },
    {
      href: "/fasilitator-alat/rpa-pks",
      label: "RPA & PKS",
      icon: FileSignature,
      group: "Dokumen",
    },
    {
      href: "/fasilitator-alat/master-data/data-alat-perdirjen",
      label: "Referensi Alat",
      icon: Database,
      group: "Referensi",
    },
    {
      href: "/fasilitator-alat/master-data/data-cp-fase-f",
      label: "Referensi CP",
      icon: BookText,
      group: "Referensi",
    },
  ],
  FASILITATOR_ADMINISTRASI: [
    {
      href: dashboardPath("FASILITATOR_ADMINISTRASI"),
      label: "Dashboard",
      icon: Wrench,
      group: "Utama",
    },
    {
      href: "/fasilitator-administrasi/verifikasi-online",
      label: "Verifikasi",
      icon: CheckCircle2,
      group: "Tahapan Bimbingan",
    },
    {
      href: "/fasilitator-administrasi/wawancara",
      label: "Wawancara",
      icon: BookOpen,
      group: "Tahapan Bimbingan",
    },
    {
      href: "/fasilitator-administrasi/pra-bimtek",
      label: "Pra Bimtek",
      icon: ClipboardCheck,
      group: "Tahapan Bimbingan",
    },
    {
      href: "/fasilitator-administrasi/bimbingan-teknis",
      label: "Bimtek",
      icon: HardHat,
      group: "Tahapan Bimbingan",
    },
    {
      href: "/fasilitator-administrasi/data-dampingan",
      label: "Data Dampingan",
      icon: FileSpreadsheet,
      group: "Pelaporan",
    },
    {
      href: "/fasilitator-administrasi/laporan-progress",
      label: "Laporan Progress",
      icon: BarChart3,
      group: "Pelaporan",
    },
    {
      href: "/fasilitator-administrasi/data-siap-print",
      label: "Siap Print",
      icon: Printer,
      group: "Pelaporan",
    },
    {
      href: "/fasilitator-administrasi/rpa-pks",
      label: "RPA & PKS",
      icon: FileSignature,
      group: "Dokumen",
    },
    {
      href: "/fasilitator-administrasi/master-data/data-alat-perdirjen",
      label: "Referensi Alat",
      icon: Database,
      group: "Referensi",
    },
    {
      href: "/fasilitator-administrasi/master-data/data-cp-fase-f",
      label: "Referensi CP",
      icon: BookText,
      group: "Referensi",
    },
    {
      href: "/fasilitator-administrasi/profile",
      label: "Profil",
      icon: UserCog,
      group: "Pengaturan",
    },
  ],
  SEKOLAH: [
    { href: dashboardPath("SEKOLAH"), label: "Dashboard", icon: Gauge, group: "Utama" },
    { href: "/sekolah/pengajuan", label: "Pengajuan Sarana", icon: HardHat, group: "Tugas Utama" },
    { href: "/sekolah/profil", label: "Data Profil Sekolah", icon: Building2, group: "Tugas Utama" },
    { href: "/sekolah/alat", label: "Data Sarana & Alat", icon: Boxes, group: "Tugas Utama" },
    { href: "/sekolah/rpa-pks", label: "RPA & PKS", icon: FileSignature, group: "Dokumen" },
    { href: "/sekolah/panduan-alat", label: "Panduan", icon: BookOpen, group: "Bantuan" },
    { href: "/sekolah/bantuan", label: "Pusat Bantuan", icon: LifeBuoy, group: "Bantuan" },
  ],
  KOORDINATOR_ALAT: [
    { href: dashboardPath("KOORDINATOR_ALAT"), label: "Dashboard", icon: Boxes },
    { href: "/dashboard/koordinator-alat", label: "Distribusi", icon: HardHat },
  ],
  PPK: [
    { href: dashboardPath("PPK"), label: "Dashboard", icon: ClipboardCheck },
    { href: "/dashboard/ppk", label: "Persetujuan", icon: ShieldCheck },
  ],
};

export const demoCredentials = [
  { username: "admin", password: "Direktoratsmk123!", role: "Admin" },
  { username: "fasilitator.alat", password: "Direktoratsmk123!", role: "Fasilitator Alat" },
  {
    username: "fasilitator.adm",
    password: "Direktoratsmk123!",
    role: "Fasilitator Administrasi",
  },
  { username: "sekolah", password: "Direktoratsmk123!", role: "Sekolah" },
];
