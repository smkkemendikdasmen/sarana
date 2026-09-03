export const APP_VERSION = "2.1.0";

export interface AppChangelogEntry {
  version: string;
  date: string;
  summary: string;
}

export const APP_CHANGELOG: AppChangelogEntry[] = [
  {
    version: "2.1.0",
    date: "2026-08-28",
    summary:
      "Rilis MINOR peningkatan Manajemen Fasilitator Bimbingan Teknis (Bimtek) peran ganda (Fasilitator Alat & Administrasi) dengan kolom komentar independen per-role dan fix data penugasan. " +
      "[1] FITUR BARU — Kolom Komentar Inline per Fasilitator di Tabel List Bimtek: (a) Route /fasilitator-administrasi/bimbingan-teknis menampilkan kolom 'Komentar Fasil Admin Bimtek' dengan textarea 2 baris + tombol 'Simpan Komentar Fasil Admin' berwarna Emerald per baris sekolah; (b) Route /fasilitator-alat/bimbingan-teknis menampilkan kolom 'Komentar Fasil Alat Bimtek' dengan tombol 'Simpan Komentar Fasil Alat' berwarna Sky per baris sekolah; (c) Textarea otomatis pre-filled dari DB value existing saat load; (d) Feedback visual saat save: border hijau = sukses (label berubah '✓ Tersimpan' selama 2,5 detik), border merah = error, disabled state = loading 'Menyimpan...'. " +
      "[2] DATABASE 2 KOLOM BARU Idempotent — Tabel workspace_bimtek_reviews menambahkan kolom fasil_alat_comment TEXT NULL dan fasil_admin_comment TEXT NULL secara otomatis via pattern colCheck information_schema COUNT + ALTER TABLE ADD COLUMN (tidak perlu script SQL manual di PROD). SQL Upsert menggunakan pattern COALESCE(VALUES(field), field) anti-overwrite: role Fasil Alat mengirim fasilAdminComment=NULL namun nilai komentar Admin existing TIDAK di-null-kan (vice versa). " +
      "[3] PERBAIKAN KRITIS List Penugasan Fasil Alat — Sebelumnya route /fasilitator-alat/bimbingan-teknis TIDAK mengirim parameter facilitatorEquipmentId & facilitatorEquipmentName saat request workspaceAssignmentsRequest, akibatnya API mengembalikan SEMUA assignment bimbingan-teknis milik semua fasil (filter client-side hanya lapis kedua). Setelah fix, role Alat mengirim Equipment ID + Full Name dan role Admin mengirim Administration ID + Full Name (sebelumnya hanya ID) ke backend; logika filter AND equipmentMatch && administrationMatch di getAssignments() memastikan HANYA penugasan milik user login yang ditampilkan. " +
      "[4] STANDARISASI UI — Kedua route Bimtek Alat & Administrasi menggunakan komponen shared FacilitatorAlatBimbinganPage (List) + FacilitatorAdministrasiBimtekDetailPage (Detail) dengan section header panel rounded-[32px] p-8 persis sama (sebelumnya Detail Alat memiliki 426 baris inline client hardcoded role FASILITATOR_ALAT yang divergen). Role otomatis dideteksi dari useAuthStore session.user.role (isFA discriminator) — tidak ada hardcode peran di route page file. " +
      "[5] STABILITAS Backend — (a) Upsert BimtekReview otomatis memanggil invalidateRuntimeCache('bimtek_reviews') + invalidateAllWorkspaceSummaryCaches() setelah write (sebelumnya tidak ada, menyebabkan perubahan komentar tidak tampil sampai hard refresh); (b) DTO UpsertBimtekReviewBody menambahkan 2 field @IsString @IsOptional fasilAlatComment & fasilAdminComment secara backward-compatible (call sites saveReviewDraft & approveActiveDocument yang tidak kirim field baru TETAP lolos validasi).",
  },
  {
    version: "2.0.0",
    date: "2026-08-27",
    summary:
      "Rilis MAJOR versi 2.0 dengan fokus peningkatan performa, fitur RPD/PKS mandiri tanpa Google Docs, 2 Card Biaya Persiapan & Pelatihan di halaman pengajuan sekolah, dan 7 Tab cetak A4 Preview+Print di detail FA Bimtek. " +
      "[1] MODUL BARU RichTextEditor HTML — Upload Gambar inline (FileReader dataURI base64) + Page Setup A4 5 preset cycle (default/a4/a4-narrow/a4-wide/a4-landscape) + A4 Page Badge toolbar, diterapkan di Admin Master Template dan School RPD/PKS Editor. " +
      "[2] MODUL BARU RPD & PKS Tanpa Google Docs — 44 placeholder keys (RpdPksPlaceholderKey) + buildPlaceholderMapFromProfile() dengan extras inject totalAnggaranRpNumber/ppkName/ppkNip/fasilitatorName + auto calc tahap1_70_rp×0.7, tahap2_30_rp×0.3, konsentrasi_keahlian_rpd_uraian, total_anggaran_terbilang via angkaTerbilang(). Template HTML sumber 100% di-convert dari DOCX asli user: CONTOH_RPD_Sarana_2026_editable.docx dan PKS_Lengkap_21_Halaman_SMK_Muhammadiyah_1.docx. " +
      "[3] BACKEND BARU 8 CRUD workspace-data/*: MasterTemplate (seed auto idempotent RPD/PKS HTML) + School Instance RPD/PKS per NPSN dengan 2 tabel MySQL; FIX ERROR 500 endpoint /workspace-data/master-tables via ensureMinimumMasterRpdPksTemplates() embed constant + COUNT typecast. " +
      "[4] HALAMAN SEKOLAH /pengajuan — 2 CARD BARU di BAWAH tabel Konsentrasi Keahlian (setelah tfoot, sebelum Catatan Umum): (a) Card 1 Biaya Persiapan & Pelaporan indigo 4 default kegiatan × SBM standar, (b) Card 2 Biaya Pendukung Uji Fungsi & Pelatihan violet 6 kolom (No · Nama Produk · Jumlah Unit · Dropdown Butuh Pelatihan Ya/Tidak · Total Biaya Pelatihan disabled jika Tidak · Aksi Edit/Trash). Tombol Simpan (flush debounce autosave) di kanan atas card, sukses/error banner per-card. " +
      "[5] HALAMAN RAB DETAIL — 4 Card berurutan: Card 1 Biaya Persiapan (indigo) → Card 2 Belanja Alat (tabel KK) → Card 3 Biaya Pelatihan (violet) → Card 4 RINGKASAN TOTAL RAB gradien Emerald A+B+C + pembulatan Ribuan. Semua subtotal masuk ke rabGrand agregator. " +
      "[6] FASILITATOR ADMINISTRASI BIMTEK DETAIL — 7 Tab (Identitas, Administrasi, Survey, RPKP, RAB, RPD, PKS) MASING-MASING TABBAR dengan tombol Preview modal A4 + Print window.print PDF. Dialog print preview single modal dengan cloneElementToPrintPortal() + @media print A4 landscape/portrait stylesheet. " +
      "[7] PERFORMA MAJOR lib/api.ts — 6 function Proposal & Equipment GET dulu TANPA client caching, SEKARANG pakai scopedCacheKey(token+url) SHORT_TTL_MS 90 detik + clientGetInFlight Promise dedupe (render paralel → 1 fetch). 3 save mutation functions otomatis clearCache prefix /me| + /by-npsn/| lalu write-back hasil PUT ke cache /me| → menghilangkan re-fetch redundan. Perkiraan penurunan request GET proposal: 75%. " +
      "[8] PERFORMA CPU detail FA Pra-Bimtek — PageHeaderSummary sebelum recalc rabGrand/rpkpGrand DUA KALI (parent + child identik) kini props precomputedTotals? opsional, hasil useMemo parent dipassing ke child supaya skip recalc. " +
      "[9] HALAMAN BARU Admin /admin/version-changelog — Navigasi menu 'Versi & Catatan Rilis' di grup Pelaporan & Log untuk role SUPERADMIN dan ADMIN, menampilkan APP_CHANGELOG versi 1.0.0 s/d 2.0.0 dengan highlight badge Released tanggal. " +
      "[10] ROUTE BARU /fasilitator-alat/bimbingan-teknis/[npsn]/page.tsx — useDetailBundle hook Promise.all profil sekolah + proposal byNpsn + aggregate rabGrand/rpkpGrand untuk RPD/PKS placeholder.",
  },
  {
    version: "1.6.0",
    date: "2026-08-20",
    summary:
      "8 area peningkatan major & perbaikan stabilitas: (1) BACKEND Sync Jadwal Wawancara Cross-Module — perbaikan service updateAssignmentInterviewSchedule WHERE module_key dihapus, sehingga 1x simpan jadwal dari /fasilitator-administrasi/wawancara OTOMATIS mengisi interview_scheduled_date/interview_scheduled_time/interview_meeting_link ke SEMUA module assignments per NPSN sekolah yang sama (verifikasi-online, pra-bimtek, bimbingan-teknis, rpa-pks, wawancara). (2) HALAMAN SEKOLAH /alat Parser Hybrid AlatReviewDetailStruct v3 — read note perKk[code].{sarana,pengajuan,konsentrasi} dan mapping ke buckets conditions/proposals/concentrations, ditambah Inline Callout tepat di section KK aktif (3 stack: Profil KK ungu, Sarana amber, Komentar Umum indigo) TEPAT sebelum tabel alat per kategori. (3) HALAMAN SEKOLAH /pengajuan — parser v3 hybrid sama + Inline Callout tepat sebelum tab Survey/RPKP/RAB (stack: Profil KK ungu, Pengajuan Sarana sky, Komentar Umum indigo). (4) HALAMAN SEKOLAH /profil — parser v3 hybrid mapping perKk[code].konsentrasi ke concentrations bucket, catatan KK terpadu tampil di list Konsentrasi Keahlian. (5) DASHBOARD /dashboard/sekolah Card Informasi Penting — Panel Jadwal Wawancara lengkap (badge status 6-state: Belum dijadwalkan/H-ini/Hari Ini/H-n/Sudah dilaksanakan) + 3 card: Tanggal (format locale id-ID panjang + updateAt), Jam WIB + nama Fasilitator Administrasi pewawancara, Link Meeting clickable Button Buka Meeting target=_blank. Data 100% dari workspaceAssignmentsRequest filter NPSN sekolah login. (6) MENU FASILITATOR ALAT: Tambah menu Pra Bimtek setelah Wawancara (3 section: Survey Harga Pasar, RPKP, RAB) + rename RPA & PKS jadi Review RPD dan PKS dengan wrapper DocumentReadonlyPreview 100% readonly (CSS disable pointer-events input & hidden buttons). (7) PERFORMA Data Dampingan Fasil Alat: scope light + debounce 220ms search, 2-phase loading, 5 StatChip, 6 error TypeScript Pra Bimtek diperbaiki (adminSelectionMap → proposalMap, includeEquipment parameter dihapus, iterate Object.entries proposalBundles, b.statuses.updatedAt → b.updatedAt, schoolProvince/City fallback ?? string). (8) RUNTIME stabil: package.json dev runner tsx watch (tanpa --experimental-loader deprecated), Node Heap cap 4GB dev & 6GB build, global SIGTERM/SIGINT/uncaught/unhandled handlers di src/main.ts.",
  },
  {
    version: "1.5.0",
    date: "2026-08-18",
    summary:
      "Perbaikan 3 area: (1) Render catatan review kolom Catatan Ringkasan Review di /admin/verifikasi-online dan tabel sekolah-penerima-abt tidak lagi menampilkan JSON mentah (support field nama versi Indonesia + fallback empty state non-literal). (2) Dashboard FASILITATOR ALAT disederhanakan (hilangkan card informasi non-esensial, tinggal badge role, headline, 4 metric, dan section fokus tugas). (3) Revert konfigurasi akun pengguna ADMIN & SUPERADMIN ke sandi asli (hash bcrypt Direktoratsmk123!, field plaintext kembali kosong) dan E2E scan 18 halaman /admin/* + /fasilitator-alat/* untuk memastikan 0 tampilan JSON literal di UI.",
  },
  {
    version: "1.4.0",
    date: "2026-08-18",
    summary:
      "Perbaikan: Tabel Survey Harga Pasar di Pengajuan menggunakan modal edit (bukan inline autosave). Tabel RAB menampilkan rincian nama alat, jumlah, harga satuan, dan subtotal. Dashboard sekolah menampilkan card Informasi Penting dan Dokumen Administrasi 10 item (12 UMUM dikurangi SK Yayasan & Kemenkumham). Sidebar admin menambahkan menu grup Pelaporan & Log dengan Laporan dan Audit Log (Versi + detail perubahan).",
  },
  {
    version: "1.3.0",
    date: "2026-08-17",
    summary:
      "Perbaikan: Data Sarana Sekolah menggunakan modal edit tabel dengan tombol Update. Penyesuaian styling sidebar, card ringkasan, dan konfigurasi workspace shell untuk role SEKOLAH, FASILITATOR, dan ADMIN.",
  },
  {
    version: "1.2.0",
    date: "2026-08-12",
    summary:
      "Implementasi halaman /sekolah/bantuan: Data Fasilitator menampilkan detail penugasan (Verifikasi Online, Wawancara, Bimbingan Teknis) sesuai WorkspaceAssignmentRecord. Dukungan pencarian nama, NPSN, dan nomor kontak.",
  },
  {
    version: "1.1.0",
    date: "2026-08-08",
    summary:
      "Peningkatan halaman Pengajuan Sarana: Tab Survey Harga Pasar, RPKP, dan RAB dengan kalkulasi subtotal per toko, upload bukti SIPLAH dengan kompresi gambar, dan validasi field satuan/harga. Dashboard SARANA SMK versi beta pertama.",
  },
  {
    version: "1.0.0",
    date: "2026-08-01",
    summary:
      "Rilis perdana aplikasi SARANA SMK: Dashboard per role (Admin, Fasilitator Administrasi, Fasilitator Alat, Sekolah), manajemen profil sekolah, data sarana per konsentrasi keahlian, dan sistem dokumen administrasi 12 kategori UMUM.",
  },
];
