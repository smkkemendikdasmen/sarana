/**
 * Default templates for RPD (Rencana Penggunaan Dana) & PKS (Perjanjian Kerja Sama).
 * HTML templates use placeholders like {{nama_sekolah}}, {{npsn}}, etc.
 * The frontend resolver (rich-text-editor.tsx → resolvePlaceholdersHtml)
 * replaces them at render time before review/print.
 */
export type RpdPksPlaceholderKey =
  | "nama_sekolah"
  | "npsn"
  | "alamat_sekolah"
  | "alamat_jalan"
  | "kecamatan"
  | "kab_kota"
  | "kab_kota_sekolah"
  | "provinsi"
  | "provinsi_sekolah"
  | "kode_pos"
  | "kode_pos_sekolah"
  | "kepala_sekolah_nama"
  | "kepala_sekolah_nip"
  | "kepala_sekolah_hp"
  | "wakasek_sarana_nama"
  | "wakasek_sarana_hp"
  | "bendahara_sekolah_nama"
  | "bendahara_sekolah_nip"
  | "tanggal_sekarang"
  | "tahun_anggaran"
  | "tahun_ajaran"
  | "tempat_tanggal_buat"
  | "kota_pembuatan_surat"
  | "nama_fasilitator"
  | "nip_fasilitator"
  | "nama_fasilitator_adm"
  | "nip_fasilitator_adm"
  | "nama_fasilitator_alat"
  | "nip_fasilitator_alat"
  | "nama_ppk"
  | "nip_ppk"
  | "kab_kota_ttd"
  | "nomor_rpd"
  | "nomor_pks"
  | "total_anggaran_rp"
  | "total_anggaran_terbilang"
  | "sumber_dana"
  | "konsentrasi_keahlian_list"
  | "konsentrasi_keahlian_uraian"
  | "konsentrasi_keahlian_rpd_uraian"
  | "progress_dok_adm_pct"
  | "dok_adm_sudah_upload"
  | "dok_adm_total"
  | "dok_adm_tabel_body_rows"
  | "survey_harga_tabel_body_rows"
  | "grand_total_survey_rp"
  | "rpkp_tabel_body_rows"
  | "total_rpkp_rp"
  | "total_rpkp_terbilang"
  | "rab_kelompok_a_body_rows"
  | "rab_subtotal_a_rp"
  | "rab_kelompok_b_body_rows"
  | "rab_subtotal_b_rp"
  | "rab_kelompok_c_body_rows"
  | "rab_subtotal_c_rp"
  | "grand_total_rab_rp"
  | "grand_total_rab_terbilang"
  | "tahap1_70_rp"
  | "tahap2_30_rp"
  | "mitra_nama"
  | "mitra_alamat"
  | "mitra_kota"
  | "mitra_npwp"
  | "mitra_direktur_nama"
  | "mitra_direktur_nik"
  | "masa_berlaku_mulai"
  | "masa_berlaku_selesai"
  | "hari_tanggal_terbilang"
  | "kontak_kepala_sekolah"
  | "nomor_sk_tim"
  | "nomor_bast"
  | "nomor_bapb"
  | "ketua_tim_sarpras_nama"
  | "sekretaris_tim_nama"
  | "bendahara_tim_nama"
  | "anggota_teknis_tim_nama"
  | "ruang_lingkup";

export const RPD_PKS_PLACEHOLDER_CHEATSHEET: {
  key: RpdPksPlaceholderKey;
  label: string;
  contoh: string;
}[] = [
  { key: "nama_sekolah", label: "Nama Sekolah", contoh: "SMKS MUHAMMADIYAH 1 JAKARTA" },
  { key: "npsn", label: "NPSN", contoh: "20102903" },
  { key: "alamat_sekolah", label: "Alamat Sekolah", contoh: "Jl. Kyai Mojo No.12" },
  { key: "kab_kota_sekolah", label: "Kab/Kota Sekolah", contoh: "Kota Administrasi Jakarta Pusat" },
  { key: "provinsi_sekolah", label: "Provinsi Sekolah", contoh: "DKI Jakarta" },
  { key: "kode_pos_sekolah", label: "Kode Pos Sekolah", contoh: "10330" },
  { key: "kepala_sekolah_nama", label: "Nama Kepala Sekolah", contoh: "Dra. Hj. Siti Rahmawati, M.Pd." },
  { key: "kepala_sekolah_nip", label: "NIP Kepala Sekolah", contoh: "196805121990032001" },
  { key: "tanggal_sekarang", label: "Tanggal Sekarang (lengkap)", contoh: "27 Agustus 2026" },
  { key: "tahun_anggaran", label: "Tahun Anggaran", contoh: "2026" },
  { key: "tahun_ajaran", label: "Tahun Ajaran", contoh: "2026/2027" },
  { key: "kota_pembuatan_surat", label: "Kota Pembuatan Surat", contoh: "Jakarta" },
  { key: "nama_fasilitator", label: "Nama Fasilitator", contoh: "Bpk. Aditya Pratama" },
  { key: "nip_fasilitator", label: "NIP/NIK Fasilitator", contoh: "198102032010011005" },
  { key: "nama_ppk", label: "Nama PPK", contoh: "Dr. Rina Kusumawardani, S.Si., M.T." },
  { key: "nip_ppk", label: "NIP PPK", contoh: "197510102005012003" },
  { key: "kab_kota_ttd", label: "Kota TTD", contoh: "Jakarta" },
  { key: "nomor_rpd", label: "Nomor RPD", contoh: "001/RPD-SMK/BSKAP/2026" },
  { key: "nomor_pks", label: "Nomor PKS", contoh: "001/PKS-SMK/DUDI/2026" },
  { key: "total_anggaran_rp", label: "Total Anggaran (Rp angka)", contoh: "Rp 842.500.000,00" },
  { key: "total_anggaran_terbilang", label: "Total Anggaran (terbilang)", contoh: "Delapan Ratus Empat Puluh Dua Juta Lima Ratus Ribu Rupiah" },
  { key: "sumber_dana", label: "Sumber Dana", contoh: "DAK Fisik Bidang SMK Tahun Anggaran 2026" },
  { key: "konsentrasi_keahlian_list", label: "Daftar Konsentrasi Keahlian (HTML <li>)", contoh: "<li>Teknik Kendaraan Ringan</li><li>Teknik Sepeda Motor</li>" },
  { key: "mitra_nama", label: "Nama Mitra / DUDI", contoh: "PT. Industri Otomotif Nusantara" },
  { key: "mitra_alamat", label: "Alamat Mitra", contoh: "Jl. Industri Raya Blok A-12 Kawasan MM2100" },
  { key: "mitra_kota", label: "Kota Mitra", contoh: "Kota Bekasi" },
  { key: "mitra_npwp", label: "NPWP Mitra", contoh: "01.234.567.8-912.000" },
  { key: "mitra_direktur_nama", label: "Nama Direktur Mitra", contoh: "Bpk. Hendrawan Susilo" },
  { key: "mitra_direktur_nik", label: "NIK Direktur Mitra", contoh: "3174051709850001" },
  { key: "masa_berlaku_mulai", label: "Mulai Masa Berlaku PKS", contoh: "1 September 2026" },
  { key: "masa_berlaku_selesai", label: "Selesai Masa Berlaku PKS", contoh: "31 Agustus 2027" },
  { key: "ruang_lingkup", label: "Ruang Lingkup Kegiatan", contoh: "Pengadaan alat praktik, bimtek guru, dan praktek kerja industri (PRAKERIN)." },
  { key: "hari_tanggal_terbilang", label: "Hari & Tanggal Terbilang", contoh: "Senin, tanggal lima belas Agustus tahun dua ribu dua puluh enam" },
  { key: "tahap1_70_rp", label: "Nilai Pencairan Tahap I (70%)", contoh: "Rp344.486.100" },
  { key: "tahap2_30_rp", label: "Nilai Pencairan Tahap II (30%)", contoh: "Rp147.636.900" },
  { key: "konsentrasi_keahlian_rpd_uraian", label: "Uraian Kegiatan Konsentrasi Keahlian (RPD)", contoh: "Pengadaan Peralatan Praktik Teknik Kendaraan Ringan" },
  { key: "kontak_kepala_sekolah", label: "No HP Kepala Sekolah", contoh: "08123456789" },
  { key: "nomor_sk_tim", label: "Nomor SK Tim Pelaksana", contoh: "102/SK-TIM/SMK-M1/VI/2026" },
  { key: "nomor_bast", label: "Nomor Berita Acara Serah Terima (BAST)", contoh: "005/BAST-SARPRAS/2026" },
  { key: "nomor_bapb", label: "Nomor Berita Acara Pemeriksaan Barang (BAPB)", contoh: "003/BAPB-SARPRAS/2026" },
  { key: "ketua_tim_sarpras_nama", label: "Nama Ketua Tim Sarpras", contoh: "Ahmad Fauzi, S.T." },
  { key: "sekretaris_tim_nama", label: "Nama Sekretaris Tim", contoh: "Siti Rahmah, S.Pd." },
  { key: "bendahara_tim_nama", label: "Nama Bendahara Tim", contoh: "Nurhayati, S.E." },
  { key: "anggota_teknis_tim_nama", label: "Nama Anggota Teknis / Pengadaan", contoh: "Budi Santoso, S.T." }
];

export function buildPlaceholderMapFromProfile(
  profile: {
    schoolName?: string | null;
    npsn?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
    principalName?: string | null;
    principalNip?: string | null;
    concentrations?: readonly { name?: string | null; code?: string | null }[];
  },
  extras: {
    totalAnggaranRpNumber?: number | null;
    ppkName?: string | null;
    ppkNip?: string | null;
    fasilitatorName?: string | null;
    fasilitatorNipNik?: string | null;
  } = {},
): Partial<Record<RpdPksPlaceholderKey, string>> {
  const today = new Date();
  const dateId = today.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const konsentrasiHtml =
    profile.concentrations && profile.concentrations.length > 0
      ? profile.concentrations
          .map((c) => `<li>${String(c.name ?? c.code ?? "").trim()}</li>`)
          .filter((v) => v !== "<li></li>")
          .join("\n")
      : "";
  const konsentrasiNamesPlain =
    profile.concentrations && profile.concentrations.length > 0
      ? profile.concentrations
          .map((c) => String(c.name ?? c.code ?? "").trim())
          .filter((v) => v.length > 0)
          .join(", ")
      : "";
  const totalNum = extras.totalAnggaranRpNumber ?? 0;
  const fmtRp = (n: number) =>
    n <= 0 ? "" : "Rp" + Math.round(n).toLocaleString("id-ID");
  const tahap1 = totalNum ? Math.round(totalNum * 0.7) : 0;
  const tahap2 = totalNum ? Math.round(totalNum * 0.3) : 0;

  return {
    nama_sekolah: profile.schoolName ?? "",
    npsn: profile.npsn ?? "",
    alamat_sekolah: profile.address ?? "",
    kab_kota_sekolah: profile.city ?? "",
    provinsi_sekolah: profile.province ?? "",
    kode_pos_sekolah: profile.postalCode ?? "",
    kepala_sekolah_nama: profile.principalName ?? "",
    kepala_sekolah_nip: profile.principalNip ?? "",
    tanggal_sekarang: dateId,
    tahun_anggaran: String(today.getFullYear()),
    tahun_ajaran: `${today.getFullYear()}/${today.getFullYear() + 1}`,
    kota_pembuatan_surat: profile.city ?? "",
    kab_kota_ttd: profile.city ?? "",
    konsentrasi_keahlian_list: konsentrasiHtml,
    sumber_dana: "DAK Fisik Bidang SMK Tahun Anggaran {{tahun_anggaran}}",
    nama_ppk: extras.ppkName ?? "",
    nip_ppk: extras.ppkNip ?? "",
    nama_fasilitator: extras.fasilitatorName ?? "",
    nip_fasilitator: extras.fasilitatorNipNik ?? "",
    total_anggaran_rp: fmtRp(totalNum),
    total_anggaran_terbilang: "",
    tahap1_70_rp: fmtRp(tahap1),
    tahap2_30_rp: fmtRp(tahap2),
    konsentrasi_keahlian_rpd_uraian: konsentrasiNamesPlain
      ? `Kegiatan Pengadaan Sarana dan Peralatan Konsentrasi Keahlian ${konsentrasiNamesPlain}`
      : "",
    hari_tanggal_terbilang: "",
    kontak_kepala_sekolah: "",
    nomor_rpd: "",
    nomor_pks: "",
    nomor_sk_tim: "",
    nomor_bast: "",
    nomor_bapb: "",
    ketua_tim_sarpras_nama: "",
    sekretaris_tim_nama: "",
    bendahara_tim_nama: "",
    anggota_teknis_tim_nama: "",
    masa_berlaku_mulai: "",
    masa_berlaku_selesai: "",
    mitra_nama: "",
    mitra_alamat: "",
    mitra_kota: "",
    mitra_npwp: "",
    mitra_direktur_nama: "",
    mitra_direktur_nik: "",
    ruang_lingkup:
      "Pengadaan alat praktik untuk program keahlian, Bimbingan Teknis (Bimtek) guru, dan Praktik Kerja Lapangan (PKL) siswa.",
  };
}

/* =============== DEFAULT TEMPLATE RPD (2 HALAMAN 1:1 6_RPD.docx) =============== */
const _RPD_PAGE_BLOCK_TEMPLATE = `
<p style="margin:0 0 4px 0;text-align:center;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:11pt;font-weight:700;letter-spacing:0;line-height:1.2;">RENCANA PENGGUNAAN DANA (RPD)</p>
<p style="margin:0 0 4px 0;text-align:center;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:11pt;font-weight:700;line-height:1.2;">BANTUAN PEMERINTAH SARANA DAN PERALATAN PEMBELAJARAN</p>
<p style="margin:0 0 4px 0;text-align:center;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:11pt;font-weight:700;line-height:1.2;">SEKOLAH MENENGAH KEJURUAN (SMK)</p>
<p style="margin:0 0 18px 0;text-align:center;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:11pt;font-weight:700;line-height:1.2;">TAHUN {{tahun_anggaran}}</p>

<p style="margin:4px 0;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:11pt;font-weight:700;">SMK : {{nama_sekolah}}</p>
<p style="margin:4px 0;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:11pt;font-weight:700;">NPSN : {{npsn}}</p>
<p style="margin:4px 0;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:11pt;font-weight:700;">KAB/KOTA : {{kab_kota_sekolah}}</p>
<p style="margin:4px 0 18px 0;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:11pt;font-weight:700;">PROVINSI : {{provinsi_sekolah}}</p>

<p style="margin:16px 0 2px 0;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:8pt;font-weight:400;">CATATAN :</p>
<p style="margin:0 0 1px 0;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:8pt;line-height:1.45;">1. Jenis bantuan ini sesuai dengan kebutuhan sekolah.</p>
<p style="margin:0 0 1px 0;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:8pt;line-height:1.45;">2. Rincian dari RPD tercantum dalam Rencana Anggaran Biaya (RAB).</p>
<p style="margin:0 0 18px 0;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:8pt;line-height:1.45;">3. Jika terjadi perubahan RAB, RAB Perubahan yang telah disetujui wajib dilampirkan sebagai pelaporan.</p>

<table style="width:100%;border-collapse:collapse;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:11pt;">
  <thead>
    <tr style="background:#ffffff;">
      <th style="width:10%;border:1.5pt solid #000000;padding:6px 8px;text-align:center;font-weight:700;">NO</th>
      <th style="width:62%;border:1.5pt solid #000000;padding:6px 8px;text-align:left;font-weight:700;">URAIAN PEKERJAAN</th>
      <th style="width:28%;border:1.5pt solid #000000;padding:6px 8px;text-align:center;font-weight:700;">TOTAL BIAYA</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border:1pt solid #000000;padding:6px 8px;text-align:center;vertical-align:top;">1</td>
      <td style="border:1pt solid #000000;padding:6px 8px;vertical-align:top;">
        <p style="margin:0 0 4px 0;font-weight:700;">SARANA DAN PERALATAN PEMBELAJARAN</p>
        <p style="margin:0;">{{konsentrasi_keahlian_rpd_uraian}}</p>
      </td>
      <td style="border:1pt solid #000000;padding:6px 8px;text-align:right;vertical-align:top;font-weight:700;">{{total_anggaran_rp}}</td>
    </tr>
    <tr>
      <td style="border-top:1pt solid #000000;border-right:1pt solid #000000;border-bottom:1.5pt solid #000000;border-left:1.5pt solid #000000;padding:6px 8px;text-align:right;font-weight:700;background:#f8fafc;" colspan="2">TOTAL</td>
      <td style="border-top:1pt solid #000000;border-right:1.5pt solid #000000;border-bottom:1.5pt solid #000000;border-left:1pt solid #000000;padding:6px 8px;text-align:right;font-weight:700;background:#f8fafc;">{{total_anggaran_rp}}</td>
    </tr>
  </tbody>
</table>

<table style="width:100%;border-collapse:collapse;margin-top:24px;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:11pt;">
  <tbody>
    <tr>
      <td style="width:24%;padding:4px 0;font-weight:700;" colspan="2">Pencairan Tahap I</td>
      <td style="width:38%;padding:4px 0;"></td>
      <td style="width:38%;padding:4px 0;"></td>
    </tr>
    <tr>
      <td style="padding:3px 0;" colspan="2">70% dari Total</td>
      <td style="padding:3px 0;">Total pencairan Tahap I</td>
      <td style="padding:3px 0;text-align:right;font-weight:700;">{{tahap1_70_rp}}</td>
    </tr>
    <tr>
      <td style="padding:4px 0;font-weight:700;" colspan="2">Pencairan Tahap II</td>
      <td style="padding:4px 0;"></td>
      <td style="padding:4px 0;"></td>
    </tr>
    <tr>
      <td style="padding:3px 0;" colspan="2">30% dari Total</td>
      <td style="padding:3px 0;">Total pencairan Tahap II</td>
      <td style="padding:3px 0;text-align:right;font-weight:700;">{{tahap2_30_rp}}</td>
    </tr>
    <tr><td style="padding:8px 0;" colspan="4"></td></tr>
    <tr>
      <td style="padding:2px 0;font-size:11pt;" colspan="2">disetujui oleh</td>
      <td style="padding:2px 0;font-size:11pt;text-align:center;" colspan="2">{{kota_pembuatan_surat}}, {{tanggal_sekarang}}</td>
    </tr>
    <tr>
      <td style="padding:2px 0;font-weight:700;font-size:11pt;" colspan="2">Pejabat Pembuat Komitmen</td>
      <td style="padding:2px 0;font-weight:700;font-size:11pt;text-align:center;" colspan="2">Kepala {{nama_sekolah}}</td>
    </tr>
    <tr><td style="height:96px;" colspan="4"></td></tr>
    <tr>
      <td style="padding:2px 0;font-weight:700;font-size:11pt;text-decoration:underline;text-underline-offset:3pt;" colspan="2">{{nama_ppk}}</td>
      <td style="padding:2px 0;font-weight:700;font-size:11pt;text-align:center;text-decoration:underline;text-underline-offset:3pt;" colspan="2">{{kepala_sekolah_nama}}</td>
    </tr>
  </tbody>
</table>

<table style="width:100%;border-collapse:collapse;margin-top:28px;table-layout:fixed;font-family:&quot;Times New Roman&quot;,Times,serif;font-size:11pt;">
  <thead>
    <tr>
      <th style="width:25%;padding:6px 6px 10px 6px;border:none;background:transparent;text-align:center;font-weight:700;font-size:10.5pt;vertical-align:bottom;">PIC Pengelola Program Sarana dan Peralatan Pembelajaran</th>
      <th style="width:25%;padding:6px 6px 10px 6px;border:none;background:transparent;text-align:center;font-weight:700;font-size:10.5pt;vertical-align:bottom;">Wakil PIC Pengelola Program Sarana dan Peralatan Pembelajaran</th>
      <th style="width:25%;padding:6px 6px 10px 6px;border:none;background:transparent;text-align:center;font-weight:700;font-size:10.5pt;vertical-align:bottom;">Fasilitator Peralatan</th>
      <th style="width:25%;padding:6px 6px 10px 6px;border:none;background:transparent;text-align:center;font-weight:700;font-size:10.5pt;vertical-align:bottom;">Fasilitator Administrasi</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="height:64px;border:1pt dashed #cbd5e1;background:transparent;"></td>
      <td style="height:64px;border:1pt dashed #cbd5e1;background:transparent;"></td>
      <td style="height:64px;border:1pt dashed #cbd5e1;background:transparent;"></td>
      <td style="height:64px;border:1pt dashed #cbd5e1;background:transparent;"></td>
    </tr>
  </tbody>
</table>
`;

export const DEFAULT_RPD_TEMPLATE_HTML = `
<div class="rpd-docx-6-print" style="font-family:&quot;Times New Roman&quot;,Times,serif;">
  <!-- LEMBAR 1 (halaman 1 dari 2) -->
  <section class="rpd-lembar rpd-lembar-1" style="page-break-after:always;">
${_RPD_PAGE_BLOCK_TEMPLATE}
  </section>

  <!-- LEMBAR 2 (halaman 2 dari 2) = DUPLIKAT PERSIS LEMBAR 1 (print RPD rangkap 2 sesuai 6_RPD.docx) -->
  <section class="rpd-lembar rpd-lembar-2">
${_RPD_PAGE_BLOCK_TEMPLATE}
  </section>
</div>
`;

/* =============== DEFAULT TEMPLATE PKS =============== */
export const DEFAULT_PKS_TEMPLATE_HTML = `
<p><strong>TUT WURI HANDAYANI<br /><br />PERJANJIAN KERJA SAMA<br />antara<br />PEJABAT PEMBUAT KOMITMEN<br />SUB DIREKTORAT FASILITASI SARANA PRASARANA DAN TATA KELOLA<br />DIREKTORAT SEKOLAH MENENGAH KEJURUAN<br />DIREKTORAT JENDERAL PENDIDIKAN VOKASI, PENDIDIKAN KHUSUS, DAN PENDIDIKAN LAYANAN KHUSUS<br />KEMENTERIAN PENDIDIKAN DASAR DAN MENENGAH<br />dengan<br />KEPALA {{nama_sekolah}}<br /><br />NOMOR: {{nomor_pks}}<br /><br />TENTANG<br />BANTUAN PEMERINTAH SARANA DAN PERALATAN PEMBELAJARAN SMK<br />TAHUN 2026</strong></p><p>Pada hari ini {{hari_tanggal_terbilang}}, kami yang bertanda tangan di bawah ini:</p><p>1. {{nama_ppk}} - Pejabat Pembuat Komitmen Subdirektorat Fasilitasi Sarana Prasarana dan Tata Kelola, Direktorat Sekolah Menengah Kejuruan, Jalan Jenderal Sudirman, Gedung B Lantai 5, Senayan, Jakarta 10270. Bertindak untuk dan atas nama jabatan, selanjutnya disebut PIHAK KESATU.</p><p>2. {{kepala_sekolah_nama}} - Kepala {{nama_sekolah}}, {{alamat_sekolah}}, {{kab_kota_sekolah}}, {{provinsi_sekolah}}. Bertindak untuk dan atas nama Jabatan, selanjutnya disebut PIHAK KEDUA.</p><p></p><p><strong>PERJANJIAN KERJA SAMA (LANJUTAN)<br />BANTUAN PEMERINTAH SARANA DAN PERALATAN PEMBELAJARAN SMK {{tahun_anggaran}}</strong></p><p>Pasal 1: TUJUAN DAN JENIS BANTUAN<br />1. Kerja sama PIHAK KESATU dan PIHAK KEDUA bertujuan untuk melaksanakan Bantuan Pemerintah Sarana dan Peralatan Pembelajaran Pada Satuan Pendidikan Di Lingkungan Direktorat Jenderal Pendidikan Vokasi, Pendidikan Khusus, dan Pendidikan Layanan Khusus Tahun Anggaran {{tahun_anggaran}}.<br />2. Jenis bantuan adalah Pengadaan Sarana dan Peralatan Pembelajaran di Sekolah Menengah Kejuruan (SMK).</p><p>Pasal 2: RUANG LINGKUP<br />1. Ruang Lingkup Kerja sama ini meliputi pekerjaan Pengadaan Sarana dan Peralatan Pembelajaran untuk Konsentrasi Keahlian {{konsentrasi_keahlian_list}} sesuai Rencana Penggunaan Dana (RPD) yang disetujui.<br />2. Rincian Alokasi Dana tertuang dalam Rencana Penggunaan Dana (RPD) terlampir.</p><p>Pasal 3: PELAKSANAAN PEKERJAAN<br />1. Pelaksanaan pekerjaan Bantuan Pemerintah mengacu pada Petunjuk Teknis dan Panduan Pelaksanaan Tahun Anggaran {{tahun_anggaran}}.<br />2. PIHAK KESATU dapat melakukan pemeriksaan kebenaran penggunaan dana bantuan.<br />3. PIHAK KEDUA berkewajiban membuat laporan digital (Laporan Awal 0%, Kemajuan 50%, dan Akhir 100%).</p><p></p><p><strong>PERJANJIAN KERJA SAMA (LANJUTAN)</strong></p><p>Pasal 4: PEMBIAYAAN<br />1. Jumlah dana bantuan dari PIHAK KESATU sebesar {{total_anggaran_rp}} ({{total_anggaran_terbilang}}).<br />2. Penyaluran dana dilakukan dalam 2 (dua) tahap: Tahap I (70%) sebesar {{tahap1_70_rp}} dan Tahap II (30%) sebesar {{tahap2_30_rp}}.<br />3. Dana dibebankan pada DIPA Satuan Kerja Direktorat Sekolah Menengah Kejuruan TA {{tahun_anggaran}}.</p><p>Pasal 5: PENYALURAN DANA<br />Penyaluran dana disalurkan melalui KPPN Jakarta III ke Bank Mandiri ke rekening {{nama_sekolah}}.</p><p>Pasal 6: WAKTU PELAKSANAAN PEKERJAAN<br />Waktu pelaksanaan harus diselesaikan selambat-lambatnya pada tanggal {{masa_berlaku_selesai}}.</p><p></p><p><strong>PERJANJIAN KERJA SAMA (LANJUTAN)</strong></p><p>Pasal 7: HAK DAN KEWAJIBAN<br />1. PIHAK KESATU berhak menerima laporan, menilai usulan perubahan, dan melakukan supervisi.<br />2. PIHAK KESATU berkewajiban memproses penyaluran dana dan memberikan fasilitasi/bimbingan teknis.<br />3. PIHAK KEDUA berhak menerima dana bantuan dan petunjuk teknis.<br />4. PIHAK KEDUA berkewajiban menggunakan dana sesuai RPD, bertanggung jawab penuh, serta menyetorkan sisa dana/pajak sesuai ketentuan.</p><p>Pasal 8: PERUBAHAN PEKERJAAN<br />Setiap perubahan RPD harus mendapat persetujuan tertulis dari PIHAK KESATU tanpa menambah total dana bantuan.</p><p>Pasal 9: FORCE MAJEURE<br />Keadaan kahar harus dilaporkan paling lambat 3 x 24 jam beserta bukti resmi dari pihak berwenang.</p><p></p><p><strong>PERJANJIAN KERJA SAMA (LANJUTAN)</strong></p><p>Pasal 10: SANKSI<br />1. Kelalaian penyampaian laporan dapat mengakibatkan sanksi daftar hitam (Blacklist).<br />2. Pelanggaran ketentuan mewajibkan pengembalian seluruh dana bantuan ke Kas Negara.</p><p>Pasal 11: KETENTUAN LAIN-LAIN<br />Perubahan PKS dilakukan atas kesepakatan tertulis KEDUA BELAH PIHAK.</p><p>Pasal 12: PENUTUP<br />Perjanjian ini dibuat dalam 3 (tiga) rangkap bermeterai cukup dan berlaku sejak ditandatangani.</p><p><br /><br />PIHAK KEDUA,<br />Kepala {{nama_sekolah}}<br /><br /><br /><br />({{kepala_sekolah_nama}})				PIHAK KESATU,<br />				PPK Subdirektorat Fasilitasi Sarana Prasarana<br /><br /><br /><br />				({{nama_ppk}})</p><p></p><p><strong>SURAT PERNYATAAN TANGGUNG JAWAB MUTLAK (SPTJM)</strong></p><p>Saya yang bertanda tangan di bawah ini:<br />Nama: {{kepala_sekolah_nama}}<br />Jabatan: Kepala {{nama_sekolah}}<br />Alamat: {{alamat_sekolah}}<br />No HP: {{kontak_kepala_sekolah}}<br /><br />Dengan ini menyatakan bertanggung jawab penuh secara hukum, teknis, administrasi, dan keuangan atas pelaksanaan Bantuan Pemerintah Sarana dan Peralatan Pembelajaran SMK Tahun 2026 sebesar {{total_anggaran_rp}} ({{total_anggaran_terbilang}}).</p><p><br /><br />{{kota_pembuatan_surat}}, {{tanggal_sekarang}}<br />Kepala {{nama_sekolah}}<br /><br /><br /><br />{{kepala_sekolah_nama}}</p><p></p><p><strong>PAKTA INTEGRITAS</strong></p><p>Saya yang bertanda tangan di bawah ini:<br />Nama: {{kepala_sekolah_nama}}<br />Jabatan: Kepala {{nama_sekolah}}<br /><br />Menyatakan berkomitmen untuk:<br />1. Tidak melakukan KKN, suap, atau gratifikasi dalam bentuk apapun.<br />2. Bersikap transparan, jujur, akuntabel, dan profesional.<br />3. Melaksanakan pengadaan sesuai juknis dan peraturan perundang-undangan.<br />4. Siap menerima sanksi hukum apabila melanggar pakta integritas ini.</p><p><br /><br />{{kota_pembuatan_surat}}, {{tanggal_sekarang}}<br />Kepala {{nama_sekolah}}<br /><br /><br /><br />{{kepala_sekolah_nama}}</p><p></p><p><strong>RENCANA PENGGUNAAN DANA (RPD)<br />BANTUAN PEMERINTAH SARANA DAN PERALATAN PEMBELAJARAN SMK {{tahun_anggaran}}</strong></p><p>Nama Sekolah: {{nama_sekolah}}<br />NPSN: {{npsn}}<br />Kabupaten/Kota: {{kab_kota_sekolah}}<br />Provinsi: {{provinsi_sekolah}}<br /></p><table><tr><td><p><strong>NO</strong></p></td><td><p><strong>URAIAN PEKERJAAN</strong></p></td><td><p><strong>JUMLAH BIAYA (RP)</strong></p></td></tr><tr><td><p>1</p></td><td><p>Pengadaan Sarana &amp; Peralatan Pembelajaran Konsentrasi Keahlian {{konsentrasi_keahlian_list}}</p></td><td><p>{{total_anggaran_rp}}</p></td></tr><tr><td><p></p></td><td><p><strong>TOTAL</strong></p></td><td><p><strong>{{total_anggaran_rp}}</strong></p></td></tr></table><p></p><p><strong>RENCANA ANGGARAN BELANJA (RAB) - REKAPITULASI</strong></p><table><tr><td><p><strong>NO</strong></p></td><td><p><strong>NAMA BARANG / PERALATAN</strong></p></td><td><p><strong>HARGA SATUAN</strong></p></td><td><p><strong>VOL</strong></p></td><td><p><strong>TOTAL HARGA</strong></p></td></tr><tr><td><p>1</p></td><td><p>Laptop Spesifikasi Pembelajaran / Trainer</p></td><td><p>Rp10.545.000</p></td><td><p>9 Unit</p></td><td><p>Rp94.905.000</p></td></tr><tr><td><p>2</p></td><td><p>Programmable Logic Controller (PLC) Training Set</p></td><td><p>Rp66.203.131</p></td><td><p>6 Unit</p></td><td><p>Rp397.218.786</p></td></tr><tr><td><p></p></td><td><p><strong>TOTAL KESELURUHAN</strong></p></td><td><p></p></td><td><p></p></td><td><p><strong>{{total_anggaran_rp}}</strong></p></td></tr></table><p></p><p><strong>LAMPIRAN SPESIFIKASI TEKNIS PERALATAN<br />ITEM 1: LAPTOP PEMBELAJARAN</strong></p><p>Rincian Spesifikasi Teknis Laptop Pembelajaran Konsentrasi Keahlian {{konsentrasi_keahlian_list}}:<br />- Processor: Minimum Intel Core i5 / AMD Ryzen 5 Gen Terbaru<br />- RAM: 16 GB DDR4/DDR5<br />- Storage: 512 GB SSD NVMe<br />- Display: 14 Inch Full HD IPS<br />- OS: Windows 11 Original + Software Pemrograman PLC Pre-installed<br />- Garansi: 1 Tahun Garansi Resmi Nasional<br />- Jumlah: 9 Unit</p><p></p><p><strong>LAMPIRAN SPESIFIKASI TEKNIS PERALATAN<br />ITEM 2: PROGRAMMABLE LOGIC CONTROLLER (PLC) TRAINING SET</strong></p><p>Rincian Spesifikasi Teknis PLC Training Set:<br />- Main PLC Unit: Compact CPU dengan Modul Expansion Digital I/O &amp; Analog I/O<br />- HMI Display: 7 Inch Touchscreen Graphic Display<br />- Power Supply: Built-in 24V DC Regulated Power Supply<br />- Module Frame: Aluminium Profile Structure dengan Safety Socket 4mm<br />- Accessories: Kabel Patch Cord Set, Cable Programming USB/Ethernet, Demo Board Sensor &amp; Actuator<br />- Software: License PLC Programming &amp; HMI Software<br />- Jumlah: 6 Unit</p><p></p><p><strong>SURAT KEPUTUSAN KEPALA {{nama_sekolah}}<br />NOMOR: 102/SK-TIM/SMK-M1/VI/2026<br />TENTANG<br />PENETAPAN TIM PELAKSANA BANTUAN PEMERINTAH SARANA PEMBELAJARAN TA {{tahun_anggaran}}</strong></p><p>Menetapkan Tim Pelaksana Bantuan Pembelajaran {{nama_sekolah}}:<br />1. Penanggung Jawab: {{kepala_sekolah_nama}} (Kepala Sekolah)<br />2. Ketua Tim: {{ketua_tim_sarpras_nama}} (Wakil Kepala Sekolah Bidang Sarpras)<br />3. Sekretaris: {{sekretaris_tim_nama}}<br />4. Bendahara: {{bendahara_tim_nama}}<br />5. Anggota Teknis / Pengadaan: {{anggota_teknis_tim_nama}}</p><p></p><p><strong>JADWAL PELAKSANAAN PEKERJAAN (TIMELINE WORKPLAN)</strong></p><p>Rencana Jadwal Kerja Kegiatan Pengadaan Sarana &amp; Peralatan Pembelajaran:<br />1. Juni 2026: Penandatanganan PKS &amp; Pencairan Tahap I (70%)<br />2. Juli - Agustus 2026: Proses Pengadaan &amp; Pemesanan Peralatan via E-Katalog/SIPLah<br />3. September 2026: Pengiriman Peralatan ke Sekolah &amp; Verifikasi Fisik (Laporan 50%)<br />4. Oktober 2026: Pengajuan &amp; Pencairan Tahap II (30%)<br />5. November 2026: Instalasi, Uji Coba, &amp; Pelatihan Penggunaan Alat bagi Guru<br />6. Desember 2026: Penyusunan &amp; Penyerahan Laporan Akhir (100%) &amp; BAST</p><p></p><p><strong>PROSEDUR PEMELIHARAAN DAN INVENTARISASI ASET BANTUAN</strong></p><p>1. Seluruh barang bantuan wajib dicatat dalam Buku Inventaris Barang Sekolah dan Aplikasi SIMAK/Dapodik.<br />2. Peralatan PLC Training Set dan Laptop wajib diberi label Kode Barang Bantuan Pemerintah TA {{tahun_anggaran}}.<br />3. Pemeliharaan berkala dilakukan oleh Teknisi Laboratorium {{konsentrasi_keahlian_list}} secara berkesinambungan.</p><p></p><p><strong>FORMAT LAPORAN KEMAJUAN 0% (LAPORAN AWAL)</strong></p><p>Komponen Laporan 0%:<br />1. Lembar Pengesahan Laporan Awal<br />2. Foto Rekening Bank Sekolah Aktif<br />3. Fotokopi PKS yang telah ditandatangani<br />4. SK Tim Pelaksana Bantuan Sekolah<br />5. Rencana Jadwal Pelaksanaan Pekerjaan (Bar Chart Timeline)</p><p></p><p><strong>FORMAT LAPORAN KEMAJUAN 50%</strong></p><p>Komponen Laporan 50%:<br />1. Laporan Realisasi Penggunaan Dana Tahap I<br />2. Bukti Transfer / Pembayaran / Transaksi Pengadaan Barang<br />3. Berita Acara Penerimaan Barang Fisik Sebagian (Minimal 50%)<br />4. Foto Dokumentasi Fisik Barang di Laboratorium<br />5. Rekapitulasi Bukti Pembayaran Pajak (PPN/PPh)</p><p></p><p><strong>FORMAT LAPORAN AKHIR 100%</strong></p><p>Komponen Laporan 100%:<br />1. Laporan Akhir Pertanggungjawaban Keuangan &amp; Teknis<br />2. Berita Acara Serah Terima Pekerjaan (BAST)<br />3. Berita Acara Pemeriksaan Fisik 100%<br />4. Foto Dokumentasi Penggunaan Peralatan dalam Pembelajaran<br />5. Bukti Setor Sisa Dana / Bunga Bank ke Kas Negara (Jika Ada)</p><p></p><p><strong>BERITA ACARA SERAH TERIMA PEKERJAAN (BAST)<br />NOMOR: {{nomor_bast}}</strong></p><p>Pada hari ini ......... tanggal ..... bulan .............. tahun dua ribu dua puluh enam, kami yang bertanda tangan di bawah ini:<br /><br />1. {{kepala_sekolah_nama}} (Kepala {{nama_sekolah}}) bertindak sebagai PIHAK KEDUA (Penerima Bantuan).<br />2. {{nama_ppk}} (PPK Subdirektorat Fasilitasi Sarana Prasarana) bertindak sebagai PIHAK KESATU (Pemberi Bantuan).<br /><br />PIHAK KESATU menyerahkan hasil Pengadaan Sarana dan Peralatan Pembelajaran SMK TA {{tahun_anggaran}} senilai {{total_anggaran_rp}} kepada PIHAK KEDUA dalam keadaan lengkap, baik, dan berfungsi 100%.</p><p></p><p><strong>BERITA ACARA PEMERIKSAAN BARANG<br />NOMOR: {{nomor_bapb}}</strong></p><p>Tim Pemeriksa Barang {{nama_sekolah}} telah melakukan verifikasi dan uji coba fungsi terhadap barang bantuan:<br />1. Laptop Pembelajaran: 9 Unit (Kondisi Baik &amp; Sesuai Spesifikasi)<br />2. PLC Training Set: 6 Unit (Kondisi Baik &amp; Sesuai Spesifikasi)<br /><br />Demikian Berita Acara Pemeriksaan Barang ini dibuat untuk dipergunakan sebagaimana mestinya.</p><p></p><p><strong>KUITANSI / BUKTI PENERIMAAN DANA BANTUAN</strong></p><p>Telah diterima dari: Pejabat Pembuat Komitmen Subdirektorat Fasilitasi Sarana Prasarana Direktorat SMK<br />Uang Sejumlah: {{total_anggaran_rp}} ({{total_anggaran_terbilang}})<br />Untuk Pembayaran: Bantuan Pemerintah Sarana dan Peralatan Pembelajaran {{nama_sekolah}} Tahun {{tahun_anggaran}}.<br /><br />Mengetahui,<br />Kepala Sekolah				Bendahara Sekolah<br /><br /><br /><br />({{kepala_sekolah_nama}})				(Nurhayati, S.E.)</p><p></p><p><strong>LEMBAR VERIFIKASI &amp; CHECKLIST KELENGKAPAN DOKUMEN BANTUAN PEMERINTAH 2026</strong></p><table><tr><td><p><strong>NO</strong></p></td><td><p><strong>NAMA DOKUMEN</strong></p></td><td><p><strong>STATUS VERIFIKASI</strong></p></td></tr><tr><td><p>1</p></td><td><p>1. Perjanjian Kerja Sama (PKS) Asli Bermeterai</p></td><td><p>[  ] LENGKAP</p></td></tr><tr><td><p>2</p></td><td><p>2. Surat Pernyataan Tanggung Jawab Mutlak (SPTJM)</p></td><td><p>[  ] LENGKAP</p></td></tr><tr><td><p>3</p></td><td><p>3. Pakta Integritas</p></td><td><p>[  ] LENGKAP</p></td></tr><tr><td><p>4</p></td><td><p>4. Rencana Penggunaan Dana (RPD) &amp; RAB</p></td><td><p>[  ] LENGKAP</p></td></tr><tr><td><p>5</p></td><td><p>5. Laporan Kemajuan 0%, 50%, dan 100%</p></td><td><p>[  ] LENGKAP</p></td></tr><tr><td><p>6</p></td><td><p>6. Berita Acara Serah Terima (BAST) &amp; Foto Fisik Alat</p></td><td><p>[  ] LENGKAP</p></td></tr></table><p><br /><br />Petugas Verifikasi Direktorat SMK,<br /><br /><br /><br />___________________________</p>
`;

/* =============== DEFAULT TEMPLATE 1-5 (IDENTITAS s.d. RAB) =============== */
export const DEFAULT_IDENTITAS_TEMPLATE_HTML = String(
  `<h2 style="text-align:center;margin-bottom:4px;">DATA SEKOLAH — IDENTITAS</h2>
<p style="text-align:center;color:#475569;margin-top:0;">Program Bantuan Sarana dan Peralatan SMK Tahun Anggaran {{tahun_anggaran}}</p>
<hr style="border:1px solid #cbd5e1;margin:18px 0;" />
<h3 style="margin-top:22px;">1. Profil Umum Sekolah</h3>
<table style="width:100%;border-collapse:collapse;margin-top:10px;">
  <tbody>
    <tr style="background:#f8fafc;"><td style="width:32%;padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">Nama Sekolah</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{nama_sekolah}}</td></tr>
    <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">NPSN</td><td style="padding:10px 12px;border:1px solid #e2e8f0;font-family:monospace;">{{npsn}}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">Alamat Jalan</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{alamat_jalan}}</td></tr>
    <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">Kecamatan</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{kecamatan}}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">Kabupaten / Kota</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{kab_kota}}</td></tr>
    <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">Provinsi</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{provinsi}}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">Kode Pos</td><td style="padding:10px 12px;border:1px solid #e2e8f0;font-family:monospace;">{{kode_pos}}</td></tr>
  </tbody>
</table>
<h3 style="margin-top:28px;">2. Struktur Kepemimpinan Sekolah</h3>
<table style="width:100%;border-collapse:collapse;margin-top:10px;">
  <tbody>
    <tr style="background:#f8fafc;"><td style="width:32%;padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">Nama Kepala Sekolah</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{kepala_sekolah_nama}}</td></tr>
    <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">NIP Kepala Sekolah</td><td style="padding:10px 12px;border:1px solid #e2e8f0;font-family:monospace;">{{kepala_sekolah_nip}}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">Kontak HP Kepala Sekolah</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{kepala_sekolah_hp}}</td></tr>
    <tr><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">Wakasek Sarana (Nama)</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{wakasek_sarana_nama}}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:700;">Wakasek Sarana (HP)</td><td style="padding:10px 12px;border:1px solid #e2e8f0;">{{wakasek_sarana_hp}}</td></tr>
  </tbody>
</table>
<h3 style="margin-top:28px;">3. Konsentrasi Keahlian yang Diusulkan</h3>
<div style="margin-top:10px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
  <ul style="margin:0;padding-left:20px;line-height:1.8;">{{konsentrasi_keahlian_list}}</ul>
</div>
<p style="margin-top:42px;text-align:right;color:#334155;">{{tempat_tanggal_buat}}, {{tanggal_sekarang}}</p>
<table style="width:100%;margin-top:14px;">
  <tbody>
    <tr>
      <td style="width:50%;text-align:center;vertical-align:top;">
        <p>Mengetahui,</p>
        <p style="font-weight:700;margin-top:10px;">Kepala Sekolah</p>
        <div style="height:80px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{kepala_sekolah_nama}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP. {{kepala_sekolah_nip}}</p>
      </td>
      <td style="width:50%;text-align:center;vertical-align:top;">
        <p>Fasilitator Administrasi,</p>
        <div style="height:80px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{nama_fasilitator_adm}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP/NIK. {{nip_fasilitator_adm}}</p>
      </td>
    </tr>
  </tbody>
</table>`
);

export const DEFAULT_ADMINISTRASI_TEMPLATE_HTML = String(
  `<h2 style="text-align:center;margin-bottom:4px;">CEKLIS KELENGKAPAN DOKUMEN ADMINISTRASI</h2>
<p style="text-align:center;color:#475569;margin-top:0;">Verifikasi Fasilitator Administrasi — SMK Tahun Anggaran {{tahun_anggaran}}</p>
<hr style="border:1px solid #cbd5e1;margin:18px 0;" />
<h3 style="margin-top:22px;">Identitas Sekolah</h3>
<table style="width:100%;border-collapse:collapse;">
  <tbody>
    <tr><td style="width:24%;padding:8px 10px;font-weight:700;">Nama Sekolah</td><td style="width:1%;padding:8px 10px;">:</td><td style="padding:8px 10px;">{{nama_sekolah}}</td><td style="width:16%;padding:8px 10px;padding-left:24px;font-weight:700;">NPSN</td><td style="width:1%;padding:8px 10px;">:</td><td style="padding:8px 10px;font-family:monospace;">{{npsn}}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:8px 10px;font-weight:700;">Kab./Kota</td><td style="padding:8px 10px;">:</td><td style="padding:8px 10px;">{{kab_kota}}</td><td style="padding:8px 10px;padding-left:24px;font-weight:700;">Provinsi</td><td style="padding:8px 10px;">:</td><td style="padding:8px 10px;">{{provinsi}}</td></tr>
  </tbody>
</table>
<h3 style="margin-top:26px;">Hasil Pemeriksaan Dokumen Administrasi</h3>
<p style="margin-top:2px;color:#475569;font-size:12.5px;"><b>Progress Kelengkapan:</b> <span style="font-weight:900;font-size:14px;">{{progress_dok_adm_pct}}%</span> ({{dok_adm_sudah_upload}} dari {{dok_adm_total}} dokumen)</p>
<div style="width:100%;height:10px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin:8px 0 18px 0;">
  <div style="height:100%;width:{{progress_dok_adm_pct}}%;background:#10b981;border-radius:99px;"></div>
</div>
<table style="width:100%;border-collapse:collapse;margin-top:6px;">
  <thead>
    <tr style="background:#f1f5f9;">
      <th style="width:6%;padding:10px 8px;border:1px solid #0f172a;text-align:center;font-weight:800;">No</th>
      <th style="width:54%;padding:10px 8px;border:1px solid #0f172a;text-align:left;font-weight:800;">Dokumen Administrasi</th>
      <th style="width:10%;padding:10px 8px;border:1px solid #0f172a;text-align:center;font-weight:800;">Uploaded</th>
      <th style="width:10%;padding:10px 8px;border:1px solid #0f172a;text-align:center;font-weight:800;">Hasil Review</th>
      <th style="width:20%;padding:10px 8px;border:1px solid #0f172a;text-align:left;font-weight:800;">Catatan Fasilitator</th>
    </tr>
  </thead>
  <tbody>
    {{dok_adm_tabel_body_rows}}
  </tbody>
</table>
<p style="margin-top:22px;font-size:12.5px;color:#475569;line-height:1.75;"><b>Catatan:</b> Kriteria Sesuai/Tidak Sesuai ditetapkan oleh Fasilitator Administrasi berdasarkan kesesuaian isi berkas dengan persyaratan Banper ABT Tahun Anggaran {{tahun_anggaran}}.</p>
<p style="margin-top:36px;text-align:right;color:#334155;">{{tempat_tanggal_buat}}, {{tanggal_sekarang}}</p>
<table style="width:100%;margin-top:14px;">
  <tbody>
    <tr>
      <td style="width:50%;text-align:center;vertical-align:top;">
        <p>Kepala Sekolah</p>
        <div style="height:78px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{kepala_sekolah_nama}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP. {{kepala_sekolah_nip}}</p>
      </td>
      <td style="width:50%;text-align:center;vertical-align:top;">
        <p>Fasilitator Administrasi</p>
        <div style="height:78px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{nama_fasilitator_adm}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP/NIK. {{nip_fasilitator_adm}}</p>
      </td>
    </tr>
  </tbody>
</table>`
);

export const DEFAULT_SURVEY_HARGA_TEMPLATE_HTML = String(
  `<h2 style="text-align:center;margin-bottom:4px;">SURVEY HARGA PASAR</h2>
<p style="text-align:center;color:#475569;margin-top:0;">Perbandingan Harga Peralatan — 3 Sumber Toko / Supplier Referensi</p>
<hr style="border:1px solid #cbd5e1;margin:18px 0;" />
<table style="width:100%;border-collapse:collapse;">
  <tbody>
    <tr><td style="width:20%;padding:8px 10px;font-weight:700;">Nama Sekolah</td><td style="width:1%;padding:8px 10px;">:</td><td style="padding:8px 10px;">{{nama_sekolah}}</td><td style="width:12%;padding-left:22px;padding:8px 10px;font-weight:700;">NPSN</td><td style="width:1%;padding:8px 10px;">:</td><td style="padding:8px 10px;font-family:monospace;">{{npsn}}</td></tr>
  </tbody>
</table>
<h3 style="margin-top:26px;">Ringkasan Survey Harga</h3>
<table style="width:100%;border-collapse:collapse;margin-top:8px;">
  <thead>
    <tr style="background:#f1f5f9;">
      <th style="width:5%;padding:10px 8px;border:1px solid #0f172a;text-align:center;font-weight:800;">No</th>
      <th style="width:26%;padding:10px 8px;border:1px solid #0f172a;text-align:left;font-weight:800;">Nama Alat / Paket</th>
      <th style="width:8%;padding:10px 8px;border:1px solid #0f172a;text-align:center;font-weight:800;">Qty</th>
      <th style="width:16%;padding:10px 8px;border:1px solid #0f172a;text-align:right;font-weight:800;">Toko 1 (Rp)</th>
      <th style="width:16%;padding:10px 8px;border:1px solid #0f172a;text-align:right;font-weight:800;">Toko 2 (Rp)</th>
      <th style="width:16%;padding:10px 8px;border:1px solid #0f172a;text-align:right;font-weight:800;">Toko 3 (Rp)</th>
      <th style="width:13%;padding:10px 8px;border:1px solid #0f172a;text-align:right;font-weight:800;">Harga Terbaik (Rp)</th>
    </tr>
  </thead>
  <tbody>{{survey_harga_tabel_body_rows}}</tbody>
</table>
<table style="width:100%;margin-top:14px;">
  <tbody>
    <tr style="background:#ecfdf5;">
      <td style="width:73%;padding:12px 14px;border:1px solid #10b981;font-weight:800;">GRAND TOTAL SURVEY HARGA (Harga Terbaik × Qty)</td>
      <td style="width:27%;padding:12px 14px;border:1px solid #10b981;text-align:right;font-weight:900;font-size:15px;">{{grand_total_survey_rp}}</td>
    </tr>
  </tbody>
</table>
<p style="margin-top:22px;font-size:12.5px;color:#475569;line-height:1.75;"><b>Sumber Data &amp; Catatan Survey:</b> Harga dikumpulkan dari minimal 3 (tiga) sumber toko / supplier resmi peralatan pendidikan. Harga terbaik yang dipilih adalah nilai terendah setelah mempertimbangkan kelayakan kualitas, garansi, dan ongkos kirim ke lokasi sekolah ({{kab_kota}}, {{provinsi}}).</p>
<p style="margin-top:38px;text-align:right;color:#334155;">{{tempat_tanggal_buat}}, {{tanggal_sekarang}}</p>
<table style="width:100%;margin-top:12px;">
  <tbody>
    <tr>
      <td style="width:50%;text-align:center;vertical-align:top;">
        <p>Fasilitator Peralatan,</p>
        <div style="height:80px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{nama_fasilitator_alat}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP/NIK. {{nip_fasilitator_alat}}</p>
      </td>
      <td style="width:50%;text-align:center;vertical-align:top;">
        <p>Mengetahui (Fasilitator Adm.),</p>
        <div style="height:80px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{nama_fasilitator_adm}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP/NIK. {{nip_fasilitator_adm}}</p>
      </td>
    </tr>
  </tbody>
</table>`
);

export const DEFAULT_RPKP_TEMPLATE_HTML = String(
  `<h2 style="text-align:center;margin-bottom:4px;">RENCANA PENGADAAN KERJA PRAKTEK (RPKP)</h2>
<p style="text-align:center;color:#475569;margin-top:0;">Usulan Pengadaan Sarana Praktik SMK Tahun Anggaran {{tahun_anggaran}}</p>
<hr style="border:1px solid #cbd5e1;margin:18px 0;" />
<table style="width:100%;border-collapse:collapse;">
  <tbody>
    <tr><td style="width:20%;padding:8px 10px;font-weight:700;">Nama Sekolah</td><td style="width:1%;padding:8px 10px;">:</td><td style="padding:8px 10px;">{{nama_sekolah}}</td><td style="width:14%;padding-left:22px;padding:8px 10px;font-weight:700;">NPSN</td><td style="width:1%;padding:8px 10px;">:</td><td style="padding:8px 10px;font-family:monospace;">{{npsn}}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:8px 10px;font-weight:700;">Konsentrasi</td><td style="padding:8px 10px;">:</td><td style="padding:8px 10px;" colspan="4">{{konsentrasi_keahlian_uraian}}</td></tr>
  </tbody>
</table>
<h3 style="margin-top:26px;">Daftar Rencana Pengadaan Alat Praktik</h3>
<table style="width:100%;border-collapse:collapse;margin-top:8px;">
  <thead>
    <tr style="background:#f1f5f9;">
      <th style="width:5%;padding:10px 8px;border:1px solid #0f172a;text-align:center;font-weight:800;">No</th>
      <th style="width:30%;padding:10px 8px;border:1px solid #0f172a;text-align:left;font-weight:800;">Nama Barang / Alat</th>
      <th style="width:13%;padding:10px 8px;border:1px solid #0f172a;text-align:left;font-weight:800;">Merk / Tipe</th>
      <th style="width:7%;padding:10px 8px;border:1px solid #0f172a;text-align:center;font-weight:800;">Satuan</th>
      <th style="width:8%;padding:10px 8px;border:1px solid #0f172a;text-align:center;font-weight:800;">Qty</th>
      <th style="width:15%;padding:10px 8px;border:1px solid #0f172a;text-align:right;font-weight:800;">Harga Satuan (Rp)</th>
      <th style="width:13%;padding:10px 8px;border:1px solid #0f172a;text-align:right;font-weight:800;">Subtotal (Rp)</th>
      <th style="width:9%;padding:10px 8px;border:1px solid #0f172a;text-align:left;font-weight:800;">Prioritas</th>
    </tr>
  </thead>
  <tbody>{{rpkp_tabel_body_rows}}</tbody>
</table>
<table style="width:100%;margin-top:14px;">
  <tbody>
    <tr style="background:#eef2ff;">
      <td style="width:73%;padding:12px 14px;border:1px solid #6366f1;font-weight:800;">TOTAL ANGGARAN RPKP</td>
      <td style="width:27%;padding:12px 14px;border:1px solid #6366f1;text-align:right;font-weight:900;font-size:15px;">{{total_rpkp_rp}}</td>
    </tr>
    <tr style="background:#eef2ff;"><td style="padding:12px 14px;border-left:1px solid #6366f1;border-right:1px solid #6366f1;border-bottom:1px solid #6366f1;font-weight:800;">Terbilang</td><td style="padding:12px 14px;border-right:1px solid #6366f1;border-bottom:1px solid #6366f1;text-align:right;font-style:italic;">{{total_rpkp_terbilang}}</td></tr>
  </tbody>
</table>
<p style="margin-top:22px;font-size:12.5px;color:#475569;line-height:1.75;"><b>Catatan Pelaksanaan:</b> Pengadaan dilaksanakan melalui mekanisme pengadaan barang/jasa yang berlaku, mengacu pada Survey Harga Pasar (3 Toko) yang telah diverifikasi oleh Fasilitator Peralatan. Estimasi pelaksanaan: Minggu II — Minggu IV Tahun Anggaran {{tahun_anggaran}}.</p>
<p style="margin-top:38px;text-align:right;color:#334155;">{{tempat_tanggal_buat}}, {{tanggal_sekarang}}</p>
<table style="width:100%;margin-top:12px;">
  <tbody>
    <tr>
      <td style="width:33%;text-align:center;vertical-align:top;">
        <p>Fasilitator Peralatan</p>
        <div style="height:78px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{nama_fasilitator_alat}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP/NIK. {{nip_fasilitator_alat}}</p>
      </td>
      <td style="width:34%;text-align:center;vertical-align:top;">
        <p>Fasilitator Administrasi</p>
        <div style="height:78px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{nama_fasilitator_adm}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP/NIK. {{nip_fasilitator_adm}}</p>
      </td>
      <td style="width:33%;text-align:center;vertical-align:top;">
        <p>Kepala Sekolah</p>
        <div style="height:78px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{kepala_sekolah_nama}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP. {{kepala_sekolah_nip}}</p>
      </td>
    </tr>
  </tbody>
</table>`
);

export const DEFAULT_RAB_TEMPLATE_HTML = String(
  `<h2 style="text-align:center;margin-bottom:4px;">RENCANA ANGGARAN BIAYA (RAB)</h2>
<p style="text-align:center;color:#475569;margin-top:0;">Rincian Anggaran Biaya Pengadaan Sarana SMK Tahun Anggaran {{tahun_anggaran}}</p>
<hr style="border:1px solid #cbd5e1;margin:18px 0;" />
<table style="width:100%;border-collapse:collapse;">
  <tbody>
    <tr><td style="width:20%;padding:8px 10px;font-weight:700;">Nama Sekolah</td><td style="width:1%;padding:8px 10px;">:</td><td style="padding:8px 10px;">{{nama_sekolah}}</td><td style="width:14%;padding-left:22px;padding:8px 10px;font-weight:700;">NPSN</td><td style="width:1%;padding:8px 10px;">:</td><td style="padding:8px 10px;font-family:monospace;">{{npsn}}</td></tr>
    <tr style="background:#f8fafc;"><td style="padding:8px 10px;font-weight:700;">Sumber Dana</td><td style="padding:8px 10px;">:</td><td style="padding:8px 10px;font-weight:700;color:#0f766e;" colspan="4">{{sumber_dana}}</td></tr>
  </tbody>
</table>
<h3 style="margin-top:26px;">A. Biaya Persiapan &amp; Administrasi</h3>
<table style="width:100%;border-collapse:collapse;margin-top:8px;">
  <thead><tr style="background:#f1f5f9;"><th style="width:56%;padding:10px 8px;border:1px solid #0f172a;text-align:left;font-weight:800;">Uraian</th><th style="width:15%;padding:10px 8px;border:1px solid #0f172a;text-align:right;font-weight:800;">Nilai (Rp)</th></tr></thead>
  <tbody>{{rab_kelompok_a_body_rows}}</tbody>
  <tfoot><tr style="background:#f1f5f9;font-weight:800;"><td style="padding:10px 8px;border:1px solid #0f172a;">SUBTOTAL A — Biaya Persiapan</td><td style="padding:10px 8px;border:1px solid #0f172a;text-align:right;">{{rab_subtotal_a_rp}}</td></tr></tfoot>
</table>
<h3 style="margin-top:24px;">B. Belanja Modal — Pengadaan Alat Praktik (RPKP)</h3>
<table style="width:100%;border-collapse:collapse;margin-top:8px;">
  <thead><tr style="background:#f1f5f9;"><th style="width:56%;padding:10px 8px;border:1px solid #0f172a;text-align:left;font-weight:800;">Uraian</th><th style="width:15%;padding:10px 8px;border:1px solid #0f172a;text-align:right;font-weight:800;">Nilai (Rp)</th></tr></thead>
  <tbody>{{rab_kelompok_b_body_rows}}</tbody>
  <tfoot><tr style="background:#f1f5f9;font-weight:800;"><td style="padding:10px 8px;border:1px solid #0f172a;">SUBTOTAL B — Belanja Alat</td><td style="padding:10px 8px;border:1px solid #0f172a;text-align:right;">{{rab_subtotal_b_rp}}</td></tr></tfoot>
</table>
<h3 style="margin-top:24px;">C. Biaya Pelatihan &amp; Bimbingan Teknis</h3>
<table style="width:100%;border-collapse:collapse;margin-top:8px;">
  <thead><tr style="background:#f1f5f9;"><th style="width:56%;padding:10px 8px;border:1px solid #0f172a;text-align:left;font-weight:800;">Uraian</th><th style="width:15%;padding:10px 8px;border:1px solid #0f172a;text-align:right;font-weight:800;">Nilai (Rp)</th></tr></thead>
  <tbody>{{rab_kelompok_c_body_rows}}</tbody>
  <tfoot><tr style="background:#f1f5f9;font-weight:800;"><td style="padding:10px 8px;border:1px solid #0f172a;">SUBTOTAL C — Biaya Pelatihan / Bimtek</td><td style="padding:10px 8px;border:1px solid #0f172a;text-align:right;">{{rab_subtotal_c_rp}}</td></tr></tfoot>
</table>
<h3 style="margin-top:26px;">RINGKASAN TOTAL ANGGARAN</h3>
<table style="width:100%;border-collapse:collapse;margin-top:8px;">
  <tbody>
    <tr style="background:#ecfdf5;"><td style="width:60%;padding:12px 14px;border:1px solid #10b981;font-weight:800;">GRAND TOTAL RAB (A + B + C)</td><td style="width:40%;padding:12px 14px;border:1px solid #10b981;text-align:right;font-weight:900;font-size:16px;">{{grand_total_rab_rp}}</td></tr>
    <tr style="background:#ecfdf5;"><td style="padding:12px 14px;border-left:1px solid #10b981;border-right:1px solid #10b981;border-bottom:1px solid #10b981;font-weight:800;">Terbilang</td><td style="padding:12px 14px;border-right:1px solid #10b981;border-bottom:1px solid #10b981;text-align:right;font-style:italic;">{{grand_total_rab_terbilang}}</td></tr>
    <tr style="background:#ecfdf5;"><td style="padding:12px 14px;border-left:1px solid #10b981;border-right:1px solid #10b981;border-bottom:1px solid #10b981;font-weight:800;">Tahap I Pencairan 70%</td><td style="padding:12px 14px;border-right:1px solid #10b981;border-bottom:1px solid #10b981;text-align:right;font-weight:800;">{{tahap1_70_rp}}</td></tr>
    <tr style="background:#ecfdf5;"><td style="padding:12px 14px;border-left:1px solid #10b981;border-right:1px solid #10b981;border-bottom:1px solid #10b981;font-weight:800;">Tahap II Pencairan 30%</td><td style="padding:12px 14px;border-right:1px solid #10b981;border-bottom:1px solid #10b981;text-align:right;font-weight:800;">{{tahap2_30_rp}}</td></tr>
  </tbody>
</table>
<p style="margin-top:22px;font-size:12.5px;color:#475569;line-height:1.75;"><b>Catatan Keuangan:</b> Pencairan dana dilakukan bertahap sesuai pencapaian fisik kegiatan. LPJ 0% sebelum Tahap I; LPJ 50% setelah realisasi 50% fisik + keuangan; LPJ 100% (final) sebelum pencairan Tahap II. Semua bukti transaksi berupa kuitansi/faktur pajak wajib dilampirkan.</p>
<p style="margin-top:38px;text-align:right;color:#334155;">{{tempat_tanggal_buat}}, {{tanggal_sekarang}}</p>
<table style="width:100%;margin-top:12px;">
  <tbody>
    <tr>
      <td style="width:25%;text-align:center;vertical-align:top;">
        <p>Fasilitator Peralatan</p>
        <div style="height:76px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{nama_fasilitator_alat}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP/NIK. {{nip_fasilitator_alat}}</p>
      </td>
      <td style="width:25%;text-align:center;vertical-align:top;">
        <p>Bendahara Sekolah</p>
        <div style="height:76px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{bendahara_sekolah_nama}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP/NIK. {{bendahara_sekolah_nip}}</p>
      </td>
      <td style="width:25%;text-align:center;vertical-align:top;">
        <p>Fasilitator Administrasi</p>
        <div style="height:76px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{nama_fasilitator_adm}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP/NIK. {{nip_fasilitator_adm}}</p>
      </td>
      <td style="width:25%;text-align:center;vertical-align:top;">
        <p>Kepala Sekolah</p>
        <div style="height:76px;"></div>
        <p style="font-weight:700;text-decoration:underline;text-underline-offset:4px;">{{kepala_sekolah_nama}}</p>
        <p style="color:#64748b;font-family:monospace;">NIP. {{kepala_sekolah_nip}}</p>
      </td>
    </tr>
  </tbody>
</table>`
);
