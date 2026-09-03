import type { UserRole } from "@/lib/roles";

export interface DashboardMetric {
  label: string;
  value: string;
  change: string;
  tone: "primary" | "success" | "warning" | "danger";
}

export interface DashboardPanel {
  title: string;
  description: string;
  items: string[];
}

export interface SchoolProfileSummary {
  schoolName: string;
  npsn: string;
  principalName: string;
  operatorName: string;
  region: string;
  lastUpdate: string;
  profileStatus: string;
}

export interface DashboardPayload {
  headline: string;
  summary: string;
  metrics: DashboardMetric[];
  focus: DashboardPanel[];
  schoolProfile?: SchoolProfileSummary;
}

export const emptyDashboard: DashboardPayload = {
  headline: "Dashboard sedang disiapkan",
  summary: "Struktur halaman sudah siap dan akan diperdalam sesuai kebutuhan tiap peran.",
  metrics: [],
  focus: [],
  schoolProfile: undefined,
};

export const schoolPageContent = {
  profile: {
    title: "Data Sekolah",
    description: "Lengkapi profil, kontak PIC, serta status kelengkapan sekolah secara bertahap.",
    items: [
      "Profil identitas sekolah dan NPSN",
      "Alamat, provinsi, dan kabupaten/kota",
      "Program keahlian dan jumlah peserta didik",
      "Kontak kepala sekolah dan PIC sarana",
    ],
  },
  equipment: {
    title: "Data Sarana Sekolah",
    description: "Kelola inventaris alat berdasarkan kategori, kondisi, dan sumber bantuan.",
    items: [
      "Tabel alat dengan pencarian dan filter",
      "Status kondisi alat per ruang praktik",
      "Tahun perolehan dan sumber pendanaan",
      "Aksi tambah, ubah, dan pembaruan bukti",
    ],
  },
  proposal: {
    title: "Data Pengajuan Sarana",
    description: "Ajukan kebutuhan alat baru lengkap dengan prioritas dan lampiran pendukung.",
    items: [
      "Buat draft pengajuan",
      "Isi alasan kebutuhan dan tingkat prioritas",
      "Unggah dokumen pendukung",
      "Pantau status verifikasi dan revisi",
    ],
  },
  help: {
    title: "Bantuan",
    description: "Pusat bantuan terstruktur untuk mempercepat adopsi SARANA SMK oleh sekolah.",
    items: [
      "FAQ dan panduan singkat",
      "Pencarian topik bantuan",
      "Form tiket dukungan",
      "Daftar tindak lanjut bantuan terakhir",
    ],
  },
};

export const roleSummaries: Record<UserRole, string> = {
  SUPERADMIN: "Memantau performa nasional dan menjaga tata kelola sistem SARANA SMK lintas role.",
  ADMIN: "Mengelola operasional harian, validasi data, dan akun pengguna secara terpusat.",
  FASILITATOR_ALAT: "Memprioritaskan verifikasi kondisi alat dan sekolah binaan yang perlu pendampingan.",
  FASILITATOR_ADMINISTRASI:
    "Menjaga kelengkapan dokumen dan mempercepat tindak lanjut administratif sekolah.",
  SEKOLAH: "Mengelola profil sekolah, inventaris alat, dan pengajuan kebutuhan sarana.",
  KOORDINATOR_ALAT: "Melihat distribusi kebutuhan alat dan prioritas tindak lanjut per wilayah.",
  PPK: "Memantau kesiapan pengajuan menuju persetujuan dan pelaksanaan pengadaan.",
};
