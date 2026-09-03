"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import type {
  SchoolProfileRecord,
  SchoolAdministrativeDocumentRecord,
  WorkspaceSchoolEquipmentData,
  WorkspaceSchoolProposalData,
} from "@/lib/api";

export interface AdminDocItem {
  label: string;
  uploaded: boolean;
  verified: boolean;
  updatedAt?: string;
  fileName?: string;
  filePath?: string;
  fileSize?: number;
  files?: unknown[];
  reviewStatus?: string;
  reviewNotes?: string;
  no?: number;
  code?: string;
  name?: string;
  path?: string;
}

export interface AdminEquipmentByConcentration {
  konsentrasi: string;
  no: number;
  alatBagus: number;
  alatRusak: number;
  kebutuhan: string;
}

export interface AdminEquipmentRow {
  no: number;
  kode: string;
  namaAlat: string;
  kondisi: "Baik" | "Rusak Ringan" | "Rusak Berat" | "Tidak Ada";
  jumlah: number;
  satuan: string;
  keterangan?: string;
  konsentrasi?: string;
  spesifikasi?: string;
  baik?: number;
  rusak?: number;
  kebutuhan?: number;
  kepemilikan?: string;
}

export interface AdminProposalToko {
  nama: string;
  alamat?: string;
  noHp?: string;
  harga?: number;
  link?: string;
  catatan?: string;
  screenshot?: string;
  siplahScreenshots?: Array<{ id?: string; size?: number; dataUrl?: string; fileName?: string; mimeType?: string; uploadedAt?: string }>;
}

export interface AdminProposalRow {
  no: number;
  kode: string;
  namaAlat: string;
  spesifikasi: string;
  qty: number;
  satuan: string;
  hargaSatuan: number;
  sumberPendanaan: string;
  tokoSumber?: string;
  fotoAlat: string[];
  toko: [AdminProposalToko | null, AdminProposalToko | null, AdminProposalToko | null];
  konsentrasi?: string;
}

export interface AdminSchoolReportRow {
  no: number;
  id: string;
  npsn: string;
  nama: string;
  alamat?: string;
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  desaKel?: string;
  kepsek?: string;
  nipKepsek?: string;
  hpKepsek?: string;
  wakasekSarana?: string;
  hpWakasekSarana?: string;
  konsentrasi?: string[];
  tahunAjaran?: string;
  dataSekolahComplete: number;
  dataSekolahTotal: number;
  dokumen: AdminDocItem[];
  adminDocs: SchoolAdministrativeDocumentRecord[];
  alat: AdminEquipmentRow[];
  alatByKonsentrasi: AdminEquipmentByConcentration[];
  pengajuan: AdminProposalRow[];
  profile?: SchoolProfileRecord;
  equipment?: WorkspaceSchoolEquipmentData | null;
  proposal?: WorkspaceSchoolProposalData | null;
}

function safe(doc: jsPDF, x: number, y: number, text: string, w?: number, align?: "left" | "center" | "right") {
  const parts = typeof text === "string" ? text.split("\n") : [String(text ?? "")];
  let yy = y;
  for (const line of parts) {
    doc.text(String(line ?? ""), x, yy, { maxWidth: w, align });
    yy += 5;
  }
}

function printHeader(doc: jsPDF, title: string, subtitle: string, landscape = false) {
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const pageW = landscape ? 297 : 210;
  doc.text(title, pageW / 2, 14, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90);
  doc.text(subtitle, pageW / 2, 21, { align: "center" });
  doc.setTextColor(0);
  doc.setLineWidth(0.3);
  doc.line(12, 25, pageW - 12, 25);
}

function filenameSafe(school: Pick<AdminSchoolReportRow, "npsn" | "nama">) {
  return `${school.npsn}_${school.nama.replace(/[^a-zA-Z0-9]+/g, "_").slice(0, 40)}`;
}

function blobDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleDateString("id-ID");
  } catch {
    return "-";
  }
}

async function fetchImageToDataUrl(url: string, fallbackColor?: [number, number, number]): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("fetch fail");
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    return await blobDataUri(blob);
  } catch {
    if (!fallbackColor) return null;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 240;
      canvas.height = 160;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = `rgb(${fallbackColor.join(",")})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FOTO", canvas.width / 2, canvas.height / 2 - 4);
      ctx.font = "14px sans-serif";
      ctx.fillText("Alat Praktik", canvas.width / 2, canvas.height / 2 + 20);
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  }
}

export async function generateDataSekolahPDF(school: AdminSchoolReportRow, mode: "download" | "preview" = "download") {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  printHeader(doc, "1. PROFIL SEKOLAH", `Laporan Verifikasi Online SARANA SMK · ${new Date().toLocaleDateString("id-ID")}`);

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Informasi · Data", 14, 34);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const konsentrasiDisplay =
    school.profile?.concentrations
      ?.map((c) => c.name)
      .filter(Boolean)
      .join(", ") ??
    school.konsentrasi?.join(", ") ??
    "-";
  const body: [string, string][] = [
    ["NPSN", school.npsn],
    ["Nama Sekolah", school.nama],
    ["Provinsi", school.profile?.province || school.provinsi || "-"],
    ["Kota / Kabupaten", school.profile?.city || school.kabupaten || "-"],
    ["Kecamatan", school.profile?.district || school.kecamatan || "-"],
    ["Kelurahan / Desa", school.profile?.village || school.desaKel || "-"],
    ["Alamat Lengkap", school.profile?.address || school.alamat || "-"],
    ["Kode Pos", school.profile?.postalCode || "-"],
    ["Nama Kepala Sekolah", school.profile?.principalName || school.kepsek || "-"],
    ["NIP Kepala Sekolah", school.profile?.principalNip || school.nipKepsek || "-"],
    ["No HP Kepala Sekolah", school.profile?.principalPhone || school.hpKepsek || "-"],
    ["Nama Wakasek Bidang Sarana", school.profile?.vicePrincipalFacilitiesName || school.wakasekSarana || "-"],
    ["No HP Wakasek Sarana", school.profile?.vicePrincipalFacilitiesPhone || school.hpWakasekSarana || "-"],
    ["Konsentrasi Keahlian", konsentrasiDisplay],
    ["Tahun Ajaran", school.tahunAjaran ?? "2026/2027"],
    ["Jumlah Rombongan Belajar", school.profile?.totalRombel ? String(school.profile.totalRombel) : "-"],
    ["Jumlah Total Siswa", school.profile?.totalStudents ? String(school.profile.totalStudents) : "-"],
    ["Status Verifikasi", school.profile?.verificationStatus || "MENUNGGU_REVIEW"],
  ];
  autoTable(doc, {
    startY: 38,
    styles: { fontSize: 9.5, cellPadding: 2.5, lineColor: [220, 220, 220], lineWidth: 0.2, textColor: [20, 20, 20] },
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 9 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "grid",
    body,
    columns: [
      { header: "Informasi", dataKey: "0", cellWidth: 62, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } } as unknown as object,
      { header: "Data", dataKey: "1", cellWidth: "wrap" } as unknown as object,
    ] as unknown as object[],
  });

  let y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  if (y > 248) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Dokumen Administrasi · Status Upload · Verifikasi (14 Butir)", 14, y + 6);
  y += 10;
  const eqLen = Number((school.equipment as any)?.equipmentTables?.length ?? school.alat.length ?? 0);
  const pLen = Number((school.proposal as any)?.proposalTables?.length ?? school.pengajuan.length ?? 0);
  const jumlahKK =
    (school.alatByKonsentrasi?.length ?? 0) > 0
      ? school.alatByKonsentrasi!.length
      : Array.from(new Set(school.pengajuan.map((p) => p.konsentrasi).filter(Boolean))).length ||
        (school.profile?.concentrations?.length ??
          school.konsentrasi?.length ??
          0);
  const nama12Labels: string[] = [
    "SK Pengangkatan Kepala Sekolah",
    "Scan KTP Kepala Sekolah Berwarna dan Asli",
    "Sertifikat Akreditasi",
    "NPWP Sekolah atau Yayasan",
    "Akta Yayasan (Swasta)",
    "Pengesahan Kemenkumham (Swasta)",
    "Izin Operasional Sekolah",
    "Rekomendasi Dinas Pendidikan",
    "Pernyataan Daya Listrik",
    "Pernyataan Tidak Memiliki Tunggakan",
    "SK Tim Pengadaan",
    "Surat Pernyataan (Format Terbaru)",
  ];
  const dok12Base = school.adminDocs?.length
    ? school.adminDocs.slice(0, 12).map((d, i) => ({
        no: 0,
        code: d.code,
        name: nama12Labels[i] || d.name,
        required: d.required,
        allowMultiple: d.allowMultiple,
        maxFiles: d.maxFiles,
        uploaded: d.uploaded,
        fileName: d.fileName,
        filePath: d.filePath,
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        uploadedAt: d.uploadedAt,
        reviewStatus: d.reviewStatus,
        reviewNotes: d.reviewNotes,
        files: d.files,
      }))
    : school.dokumen.slice(0, 12).map((d, i) => ({
        no: 0,
        code: "",
        name: nama12Labels[i] || d.label,
        required: true,
        allowMultiple: false,
        maxFiles: 1,
        uploaded: d.uploaded,
        fileName: "",
        filePath: "",
        mimeType: "",
        fileSize: 0,
        uploadedAt: d.updatedAt ?? null,
        reviewStatus: d.verified ? "DISETUJUI" : "PROSES",
        reviewNotes: "",
        files: [],
      }));
  const extraDok13 = {
    no: 13,
    code: "kondisi-alat-saat-ini",
    name: `Kondisi Peralatan Saat Ini (Jumlah KK: ${jumlahKK})`,
    required: true,
    allowMultiple: false,
    maxFiles: 1,
    uploaded: eqLen > 0,
    fileName: "",
    filePath: "",
    mimeType: "",
    fileSize: 0,
    uploadedAt: (school.equipment?.updatedAt as string | null) ?? null,
    reviewStatus: eqLen > 5 ? "DISETUJUI" : "PROSES",
    reviewNotes: jumlahKK ? `${jumlahKK} Konsentrasi Keahlian` : "",
    files: [],
  };
  const extraDok14 = {
    no: 14,
    code: "ajuan-alat",
    name: `Ajuan Alat (Jumlah KK: ${jumlahKK})`,
    required: true,
    allowMultiple: false,
    maxFiles: 1,
    uploaded: pLen > 0,
    fileName: "",
    filePath: "",
    mimeType: "",
    fileSize: 0,
    uploadedAt: (school.proposal?.updatedAt as string | null) ?? null,
    reviewStatus: pLen > 3 ? "DISETUJUI" : "PROSES",
    reviewNotes: jumlahKK ? `${jumlahKK} Konsentrasi Keahlian` : "",
    files: [],
  };
  const dok14 = [...dok12Base, extraDok13, extraDok14];
  autoTable(doc, {
    startY: y,
    styles: { fontSize: 8.8, cellPadding: 2.4, lineColor: [220, 220, 220], lineWidth: 0.2, valign: "middle" },
    headStyles: { fillColor: [14, 165, 233], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "grid",
    head: [["No", "Butir Dokumen Administrasi", "Status Upload", "Verifikasi"]],
    body: dok14.map((d, i) => [
      String((d.no ?? 0) || i + 1),
      d.name,
      d.uploaded ? `✅ Sudah (${formatDate(d.uploadedAt)})` : "⬜ Belum Upload",
      ["DISETUJUI", "APPROVED", "VERIFIED"].includes(String(d.reviewStatus || "").toUpperCase())
        ? "✅ Terverifikasi"
        : d.uploaded
          ? "⏳ Menunggu Review"
          : "—",
    ]),
  });
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`Halaman ${i} / ${pageCount}`, 210 - 14, 290, { align: "right" });
    doc.text("SARANA SMK · Direktorat SMK", 14, 290);
  }
  const fname = `01_PROFIL_SEKOLAH_${filenameSafe(school)}.pdf`;
  if (mode === "download") doc.save(fname);
  return { dataUri: await blobDataUri(doc.output("blob")), filename: fname };
}

export async function generateDokumenPDF(school: AdminSchoolReportRow, mode: "download" | "preview" = "download") {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  printHeader(doc, "2. DOKUMEN ADMINISTRASI (12 BUTIR)", `Sekolah: ${school.nama} (${school.npsn}) · SARANA SMK`);

  const nama12Labels: string[] = [
    "SK Pengangkatan Kepala Sekolah",
    "Scan KTP Kepala Sekolah Berwarna dan Asli",
    "Sertifikat Akreditasi",
    "NPWP Sekolah atau Yayasan",
    "Akta Yayasan (Swasta)",
    "Pengesahan Kemenkumham (Swasta)",
    "Izin Operasional Sekolah",
    "Rekomendasi Dinas Pendidikan",
    "Pernyataan Daya Listrik",
    "Pernyataan Tidak Memiliki Tunggakan",
    "SK Tim Pengadaan",
    "Surat Pernyataan (Format Terbaru)",
  ];
  const dok12 = school.adminDocs?.length
    ? school.adminDocs.slice(0, 12).map((d, i) => ({
        no: 0,
        code: d.code,
        name: nama12Labels[i] || d.name,
        required: d.required,
        allowMultiple: d.allowMultiple,
        maxFiles: d.maxFiles,
        uploaded: d.uploaded,
        fileName: d.fileName,
        filePath: d.filePath,
        mimeType: d.mimeType,
        fileSize: d.fileSize,
        uploadedAt: d.uploadedAt,
        reviewStatus: d.reviewStatus,
        reviewNotes: d.reviewNotes,
        files: d.files,
      }))
    : school.dokumen.slice(0, 12).map((d, i) => ({
        no: 0,
        code: "",
        name: nama12Labels[i] || d.label,
        required: true,
        allowMultiple: false,
        maxFiles: 1,
        uploaded: d.uploaded,
        fileName: d.uploaded ? `Dokumen_${(nama12Labels[i] || d.label).replace(/\s+/g, "_")}.pdf` : "",
        filePath: "",
        mimeType: d.uploaded ? "application/pdf" : "",
        fileSize: d.uploaded ? 256_000 : 0,
        uploadedAt: d.updatedAt ?? null,
        reviewStatus: d.verified ? "DISETUJUI" : "PROSES",
        reviewNotes: "",
        files: [],
      }));

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Daftar 12 Dokumen Administrasi — Preview & Download Data Asli Sekolah", 14, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(90);
  doc.text("Klik link file asli / download server via lampiran (nama file sesuai upload sekolah).", 14, 36);
  doc.setTextColor(0);

  const rows: (string | number)[][] = [];
  for (let i = 0; i < dok12.length; i++) {
    const d = dok12[i];
    const no = (d.no ?? 0) || i + 1;
    const status = d.uploaded
      ? `Uploaded · ${d.fileName || "file"}\nSize: ${(d.fileSize ? (d.fileSize / 1024).toFixed(1) + " KB" : "-")} · Tgl: ${formatDate(d.uploadedAt)}`
      : "Belum diunggah";
    const verifikasi = ["DISETUJUI", "APPROVED", "VERIFIED"].includes(String(d.reviewStatus || "").toUpperCase())
      ? `✅ Terverifikasi\nCatatan: ${d.reviewNotes || "OK"}`
      : d.uploaded
        ? `⏳ Proses review\nCatatan: ${d.reviewNotes || "-"}`
        : "—";
    rows.push([
      no,
      d.name,
      status,
      verifikasi,
    ]);
  }

  autoTable(doc, {
    startY: 40,
    styles: { fontSize: 9, cellPadding: 2.6, lineColor: [220, 220, 220], lineWidth: 0.2, valign: "top" },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "grid",
    head: [["No", "Butir Dokumen Administrasi", "Data Asli Upload Sekolah", "Status Verifikasi"]],
    body: rows as string[][],
    columns: [
      { header: "No", dataKey: "0", cellWidth: 10, styles: { halign: "center" } } as unknown as object,
      { header: "Butir Dokumen Administrasi", dataKey: "1", cellWidth: 60 } as unknown as object,
      { header: "Data Asli Upload Sekolah", dataKey: "2", cellWidth: 68 } as unknown as object,
      { header: "Status Verifikasi", dataKey: "3", cellWidth: "wrap" } as unknown as object,
    ] as unknown as object[],
  });

  let y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60;
  if (y > 250) {
    doc.addPage();
    y = 20;
  } else {
    y += 8;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Rekapitulasi Kelengkapan", 14, y);
  y += 6;
  const total = dok12.length;
  const uploaded = dok12.filter((d) => d.uploaded).length;
  const verified = dok12.filter((d) =>
    ["DISETUJUI", "APPROVED", "VERIFIED"].includes(String(d.reviewStatus || "").toUpperCase()),
  ).length;
  autoTable(doc, {
    startY: y,
    styles: { fontSize: 10, cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.2 },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    theme: "grid",
    body: [
      ["Total Butir Dokumen Administrasi", String(total)],
      ["Dokumen Sudah Diunggah", `${uploaded} / ${total} (${Math.round((uploaded / Math.max(1, total)) * 100)}%)`],
      ["Dokumen Sudah Terverifikasi", `${verified} / ${total} (${Math.round((verified / Math.max(1, total)) * 100)}%)`],
      [
        "Kesimpulan Kelengkapan Administrasi",
        uploaded >= 10 ? "✅ MEMADAI (≥10 butir upload)" : uploaded >= 6 ? "⚠️ SEBAGIAN LENGKAP" : "❌ KURANG LENGKAP",
      ],
    ] as unknown as string[][],
    columns: [
      { header: "Parameter", dataKey: "0", cellWidth: 80, styles: { fontStyle: "bold", fillColor: [241, 245, 249] } } as unknown as object,
      { header: "Nilai", dataKey: "1", cellWidth: "wrap" } as unknown as object,
    ] as unknown as object[],
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`Halaman ${i} / ${pageCount}`, 210 - 14, 290, { align: "right" });
    doc.text("SARANA SMK · Direktorat SMK", 14, 290);
  }
  const fname = `02_DOKUMEN_ADMINISTRASI_${filenameSafe(school)}.pdf`;
  if (mode === "download") doc.save(fname);
  return { dataUri: await blobDataUri(doc.output("blob")), filename: fname };
}

export function generateKondisiAlatExcel(school: AdminSchoolReportRow) {
  const konsentrasiGroup = school.alatByKonsentrasi?.length
    ? school.alatByKonsentrasi
    : (() => {
        const map = new Map<string, { bagus: number; rusak: number; keter: string[] }>();
        for (const a of school.alat) {
          const k = a.konsentrasi ?? "Umum / Lainnya";
          const cur = map.get(k) ?? { bagus: 0, rusak: 0, keter: [] };
          if (a.kondisi === "Baik") cur.bagus += a.jumlah;
          else if (a.kondisi !== "Tidak Ada") cur.rusak += a.jumlah;
          if (a.keterangan) cur.keter.push(`${a.namaAlat}: ${a.keterangan}`);
          map.set(k, cur);
        }
        return Array.from(map.entries()).map(([konsentrasi, g], i) => ({
          no: i + 1,
          konsentrasi,
          alatBagus: g.bagus,
          alatRusak: g.rusak,
          kebutuhan: g.keter.slice(0, 6).join("; ") || "-",
        }));
      })();
  const summarySheet = XLSX.utils.json_to_sheet(
    konsentrasiGroup.map((g) => ({
      No: g.no,
      "Konsentrasi Keahlian": g.konsentrasi,
      "Alat Bagus": g.alatBagus,
      "Alat Rusak": g.alatRusak,
      Kebutuhan: g.kebutuhan,
    })),
  );
  summarySheet["!cols"] = [
    { wch: 5 },
    { wch: 40 },
    { wch: 14 },
    { wch: 14 },
    { wch: 80 },
  ];
  const detailSheet = XLSX.utils.json_to_sheet(
    school.alat.map((e) => ({
      No: e.no,
      "Konsentrasi Keahlian": e.konsentrasi ?? "-",
      Kode: e.kode,
      "Nama Alat": e.namaAlat,
      Kondisi: e.kondisi,
      Jumlah: e.jumlah,
      Satuan: e.satuan,
      Keterangan: e.keterangan ?? "",
    })),
  );
  detailSheet["!cols"] = [
    { wch: 5 },
    { wch: 28 },
    { wch: 14 },
    { wch: 42 },
    { wch: 16 },
    { wch: 8 },
    { wch: 10 },
    { wch: 30 },
  ];
  const info = XLSX.utils.aoa_to_sheet([
    ["3. DATA KONDISI ALAT PRAKTIK SEKOLAH"],
    [],
    ["Nama Sekolah", school.nama],
    ["NPSN", school.npsn],
    ["Provinsi", school.profile?.province || school.provinsi || ""],
    ["Kabupaten / Kota", school.profile?.city || school.kabupaten || ""],
    ["Kepala Sekolah", school.profile?.principalName || school.kepsek || ""],
    ["Tanggal Ekspor", new Date().toLocaleString("id-ID")],
  ]);
  info["!cols"] = [{ wch: 22 }, { wch: 80 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, info, "Informasi");
  XLSX.utils.book_append_sheet(wb, summarySheet, "Rekap per Konsentrasi");
  XLSX.utils.book_append_sheet(wb, detailSheet, "Detail Alat");
  const fname = `03_KONDISI_ALAT_${filenameSafe(school)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

function drawSectionHeader(doc: jsPDF, text: string, y: number, landscape = false): number {
  const pageW = landscape ? 297 : 210;
  doc.setFillColor(15, 52, 96);
  doc.rect(12, y - 6, pageW - 24, 8, "F");
  doc.setTextColor(255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(text, 14, y - 0.3);
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  return y + 5;
}

function drawTable2Col(doc: jsPDF, rows: [string, string][], startY: number, landscape = false, keyWidth = 62) {
  const pageW = landscape ? 297 : 210;
  const xL = 12;
  const xR = xL + keyWidth;
  const wR = pageW - 24 - keyWidth;
  let y = startY;
  for (const [k, v] of rows) {
    doc.setDrawColor(180, 200, 220);
    doc.setLineWidth(0.2);
    doc.setFillColor(235, 243, 252);
    doc.rect(xL, y, keyWidth, 7, "FD");
    doc.rect(xR, y, wR, 7, "D");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(String(k ?? ""), xL + 1.5, y + 4.7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(String(v ?? ""), xR + 1.5, y + 4.7, { maxWidth: wR - 2 });
    y += 7;
  }
  return y;
}

export async function generateAjuanAlatPDF(school: AdminSchoolReportRow, mode: "download" | "preview" = "download") {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  printHeader(
    doc,
    "4. FORMULIR ANALISA HARGA PASAR · AJUAN ALAT SARANA SMK",
    `Sekolah: ${school.nama} (${school.npsn}) · Min. 3 Sumber Referensi Harga`,
    true,
  );

  let y = 30;

  // ========== A. IDENTITAS SEKOLAH ==========
  y = drawSectionHeader(doc, "A. IDENTITAS SEKOLAH", y, true);
  y += 4;
  const profile = school.profile;
  const identitas: [string, string][] = [
    ["Nama Sekolah", school.nama],
    ["NPSN / NSS", school.npsn],
    ["Alamat Sekolah", profile?.address || school.alamat || "-"],
    ["Provinsi", profile?.province || school.provinsi || "-"],
    ["Kabupaten / Kota", profile?.city || school.kabupaten || "-"],
    ["Kecamatan", profile?.district || school.kecamatan || "-"],
    ["Desa / Kelurahan", profile?.village || school.desaKel || "-"],
    ["Kepala Sekolah", `${profile?.principalName || school.kepsek || "-"}${school.nipKepsek ? ` · NIP ${school.nipKepsek}` : ""}`],
    ["No. HP / WA Kepala Sekolah", profile?.principalPhone || school.hpKepsek || "-"],
    ["Wakasek Sarana / Prasarana", school.wakasekSarana || (profile as any)?.saranaHeadName || "-"],
    ["Tahun Ajaran", school.tahunAjaran || (profile as any)?.academicYear || "2026 / 2027"],
    ["Status Akreditasi", (profile as any)?.accreditation || (school.profile as any)?.schoolStatus || "-"],
  ];
  y = drawTable2Col(doc, identitas, y, true, 66);
  y += 5;

  // ========== B. KONSENTRASI KEAHLIAN YANG DIUSULKAN ==========
  y = drawSectionHeader(doc, "B. KONSENTRASI KEAHLIAN YANG DIUSULKAN", y, true);
  y += 4;
  const konsentrasiList = Array.from(
    new Set([
      ...(school.konsentrasi ?? []),
      ...(school.profile?.concentrations?.map((c) => `${c.code} · ${c.name}`) ?? []),
      ...school.pengajuan.map((p) => p.konsentrasi).filter(Boolean) as string[],
    ]),
  );
  const proposalTables = (school.proposal as any)?.proposalTables;
  if (proposalTables && typeof proposalTables === "object") {
    for (const k of Object.keys(proposalTables)) {
      if (typeof k === "string" && k.includes(":")) {
        const parts = k.split(":");
        if (parts[parts.length - 1]) konsentrasiList.push(parts[parts.length - 1]);
      }
    }
  }
  const konsentrasiUnique = Array.from(new Set(konsentrasiList)).filter(Boolean);
  if (konsentrasiUnique.length === 0) konsentrasiUnique.push("-");
  const konsRows: [string, string][] = konsentrasiUnique.map((k, i) => [`Konsentrasi Keahlian ${i + 1}`, k]);
  konsRows.push(["Jumlah Total Konsentrasi (KK)", String(konsentrasiUnique.length)]);
  const totalItem = school.pengajuan.length;
  const totalQty = school.pengajuan.reduce((a, b) => a + b.qty, 0);
  const totalNilai = school.pengajuan.reduce((a, b) => a + b.qty * b.hargaSatuan, 0);
  konsRows.push(["Jumlah Item Alat Diajukan", String(totalItem)]);
  konsRows.push(["Total Kuantitas Alat", `${totalQty} unit`]);
  konsRows.push(["Estimasi Total Nilai Anggaran", `Rp ${totalNilai.toLocaleString("id-ID")}`]);
  konsRows.push([
    "Sumber Pendanaan Utama",
    Array.from(new Set(school.pengajuan.map((p) => p.sumberPendanaan).filter(Boolean))).join(", ") || "-",
  ]);
  y = drawTable2Col(doc, konsRows, y, true, 66);
  y += 6;

  // ========== Preload semua gambar referensi (3 toko x 1 screenshot = max 3 per row, plus 3 foto alat lama) ==========
  const allImageUrls = new Set<string>();
  for (const p of school.pengajuan) {
    (p.fotoAlat ?? []).slice(0, 3).forEach((f) => f && allImageUrls.add(f));
    for (const tk of p.toko) {
      if (!tk) continue;
      const sShot = (tk as any).screenshot;
      if (typeof sShot === "string" && sShot) allImageUrls.add(sShot);
      const ssList = (tk as any).siplahScreenshots as Array<{ dataUrl?: string; fileName?: string }> | undefined;
      if (Array.isArray(ssList)) {
        for (const ss of ssList.slice(0, 1)) {
          if (ss?.dataUrl) allImageUrls.add(ss.dataUrl);
        }
      }
    }
  }
  const thumbnailCache = new Map<string, string | null>();
  if (allImageUrls.size > 0) {
    const loadPromises = Array.from(allImageUrls).map(async (url, i) => {
      const palette: [number, number, number] = [
        [14, 165, 233],
        [99, 102, 241],
        [16, 185, 129],
        [234, 88, 12],
        [139, 92, 246],
        [20, 184, 166],
      ][i % 6] as [number, number, number];
      const data = await fetchImageToDataUrl(url, palette);
      thumbnailCache.set(url, data);
    });
    await Promise.all(loadPromises);
  }

  function addImageOrPlaceholder(url: string | undefined | null, x: number, yy: number, w: number, h: number, fallbackIdx: number) {
    if (!url) return;
    const dataUrl = thumbnailCache.get(url);
    if (!dataUrl) return;
    try {
      doc.addImage(dataUrl, "PNG", x, yy, w, h, undefined, "FAST");
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);
      doc.roundedRect(x, yy, w, h, 0.8, 0.8, "S");
    } catch {
      /* skip */
    }
    void fallbackIdx;
  }

  const pageH = 210;
  const pageW = 297;
  const footerH = 10;
  const groups = new Map<string, AdminProposalRow[]>();
  for (const p of school.pengajuan) {
    const k = p.konsentrasi ?? "Pengajuan Umum";
    const arr = groups.get(k) ?? [];
    arr.push(p);
    groups.set(k, arr);
  }

  // ========== E. SURVEI HARGA PASAR (Minimal 3 Sumber Referensi) ==========
  y = drawSectionHeader(doc, "E. SURVEI HARGA PASAR (Minimal 3 Sumber Referensi)", y, true);
  y += 4;

  let firstAlat = true;
  const konsentrasiArr = Array.from(groups.entries());
  if (konsentrasiArr.length === 0) {
    konsentrasiArr.push(["Pengajuan Umum", school.pengajuan]);
  }
  for (const [konsentrasi, items] of konsentrasiArr) {
    for (let alatIdx = 0; alatIdx < items.length; alatIdx++) {
      const p = items[alatIdx];

      // estimate height ~230mm + 30mm for screenshot section = minimal 2 page per alat
      if (!firstAlat) {
        doc.addPage();
        y = 30;
      }
      firstAlat = false;

      // Header alat: No, Nama Alat, Kategori
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(`${p.no || alatIdx + 1}. ${p.namaAlat}`, 14, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const kategori = p.sumberPendanaan
        ? `Kategori: Usulan Alat Praktik · Sumber: ${p.sumberPendanaan} · Konsentrasi: ${konsentrasi}`
        : `Kategori: Usulan Alat Praktik · Konsentrasi: ${konsentrasi}`;
      doc.text(kategori, 14, y);
      y += 6;
      doc.setTextColor(0);

      // 3 TOKO referensi (minimal 3 sumber) — horizontal 3 kolom
      const leftMargin = 14;
      const gap = 2.5;
      const tokoColW = (pageW - 2 * leftMargin - 2 * gap) / 3;
      const tokoHeaderH = 7;
      const labelW = 30;

      const tokoYStart = y;
      // pass 1: draw label column wrapper + content text to estimate heights
      const tokoContents: Array<Array<{ label: string; value: string; link?: boolean; imageUrls: string[] }>> = [];
      for (let t = 0; t < 3; t++) {
        const tk = p.toko[t] ?? null;
        const konten: Array<{ label: string; value: string; link?: boolean; imageUrls: string[] }> = [];
        konten.push({ label: "Nama Toko / Platform", value: tk?.nama || `(Sumber ${t + 1} belum diisi)`, imageUrls: [] });
        konten.push({ label: "Link Referensi Toko", value: tk?.link || "-", link: !!tk?.link, imageUrls: [] });
        konten.push({ label: "Nama Barang di Toko", value: p.namaAlat, imageUrls: [] });
        konten.push({ label: "Spesifikasi / Varian", value: p.spesifikasi || tk?.catatan || "-", imageUrls: [] });
        const harga = tk?.harga ?? 0;
        konten.push({
          label: "Harga Satuan (Rp)",
          value: harga > 0 ? `Rp ${harga.toLocaleString("id-ID")}` : "-",
          imageUrls: [],
        });
        // screenshot
        const imgUrls: string[] = [];
        if (tk) {
          const sShot = (tk as any).screenshot;
          if (typeof sShot === "string" && sShot) imgUrls.push(sShot);
          const ssList = (tk as any).siplahScreenshots as Array<{ dataUrl?: string }> | undefined;
          if (Array.isArray(ssList) && ssList.length > 0) {
            for (const ss of ssList.slice(0, 1)) {
              if (ss?.dataUrl) imgUrls.push(ss.dataUrl);
            }
          }
        }
        // fallback: jika tidak ada screenshot toko, pakai fotoAlat sesuai index toko
        if (imgUrls.length === 0 && (p.fotoAlat ?? []).length > 0) {
          const fallback = p.fotoAlat[t] ?? p.fotoAlat[0];
          if (fallback) imgUrls.push(fallback);
        }
        konten.push({ label: "Screenshot Foto Barang", value: "", imageUrls: imgUrls });
        tokoContents.push(konten);
      }

      // Draw 3 toko boxes
      for (let t = 0; t < 3; t++) {
        const x = leftMargin + t * (tokoColW + gap);
        doc.setFillColor(219, 234, 254);
        doc.setDrawColor(147, 197, 253);
        doc.setLineWidth(0.25);
        doc.rect(x, y, tokoColW, tokoHeaderH, "FD");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 58, 138);
        doc.text(`Toko / Penyedia ${t + 1}`, x + 1.5, y + 4.8);
        doc.setTextColor(0);
        doc.setFont("helvetica", "normal");
        let yc = y + tokoHeaderH;
        const konten = tokoContents[t];
        let boxH = tokoHeaderH;
        for (const k of konten) {
          const isImg = k.label === "Screenshot Foto Barang";
          if (isImg) {
            const rowH = 60;
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.2);
            doc.setFillColor(241, 245, 249);
            doc.rect(x, yc, labelW, rowH, "FD");
            doc.rect(x + labelW, yc, tokoColW - labelW, rowH, "D");
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(k.label, x + 1, yc + 4.2);
            doc.setTextColor(0);
            doc.setFont("helvetica", "normal");
            // gambar
            if (k.imageUrls.length > 0) {
              const imgAreaX = x + labelW + 1.2;
              const imgAreaY = yc + 1.5;
              const imgAreaW = tokoColW - labelW - 2.4;
              const imgAreaH = rowH - 3;
              addImageOrPlaceholder(k.imageUrls[0], imgAreaX, imgAreaY, imgAreaW, imgAreaH, t * 7 + alatIdx);
            } else {
              doc.setFontSize(8);
              doc.setTextColor(100, 116, 139);
              doc.text("(Belum ada screenshot)", x + labelW + 1, yc + rowH / 2);
              doc.setTextColor(0);
            }
            boxH += rowH;
            yc += rowH;
          } else {
            // splitText for value
            doc.setFontSize(8.5);
            const valMaxW = tokoColW - labelW - 2;
            const valLines = doc.splitTextToSize(String(k.value ?? ""), valMaxW);
            const rowH = Math.max(7, valLines.length * 4.4 + 2.2);
            doc.setDrawColor(203, 213, 225);
            doc.setLineWidth(0.2);
            doc.setFillColor(241, 245, 249);
            doc.rect(x, yc, labelW, rowH, "FD");
            doc.rect(x + labelW, yc, tokoColW - labelW, rowH, "D");
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(k.label, x + 1, yc + 4.2);
            doc.setFont("helvetica", "normal");
            if (k.link && k.value && k.value !== "-") {
              doc.setTextColor(37, 99, 235);
              doc.setTextColor(37, 99, 235);
            } else {
              doc.setTextColor(0);
            }
            let ly = yc + 4.4;
            for (const ln of valLines) {
              doc.text(String(ln), x + labelW + 1, ly, { maxWidth: valMaxW });
              ly += 4.4;
            }
            doc.setTextColor(0);
            boxH += rowH;
            yc += rowH;
          }
        }
        // outline wrapper box
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, tokoColW, boxH, 1, 1, "S");
        void tokoYStart;
      }
      y = y + 125; // toko boxes + spacing

      // ========== Extra: Ringkasan Qty, Total Estimasi, Perbandingan Harga 3 Toko ==========
      if (y + 20 > pageH - footerH) {
        doc.addPage();
        y = 30;
      }
      doc.setFillColor(254, 249, 195);
      doc.rect(14, y - 2, pageW - 28, 6, "F");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(113, 63, 18);
      doc.text("RINGKASAN PERBANDINGAN HARGA · QTY · TOTAL ESTIMASI", 15.5, y + 1.8);
      doc.setTextColor(0);
      y += 7;

      const ringRows: [string, string][] = [
        ["Kuantitas Diajukan", `${p.qty} ${p.satuan || "unit"}`],
        ["Konsentrasi Keahlian", p.konsentrasi ?? konsentrasi],
        [
          "Harga Toko 1",
          p.toko[0]?.harga ? `Rp ${p.toko[0].harga.toLocaleString("id-ID")}` : "-",
        ],
        [
          "Harga Toko 2",
          p.toko[1]?.harga ? `Rp ${p.toko[1].harga.toLocaleString("id-ID")}` : "-",
        ],
        [
          "Harga Toko 3",
          p.toko[2]?.harga ? `Rp ${p.toko[2].harga.toLocaleString("id-ID")}` : "-",
        ],
      ];
      // cari harga TERENDAH dari 3 toko
      const hargaList = p.toko
        .map((t, idx) => ({ idx, harga: t?.harga ?? 0 }))
        .filter((t) => t.harga > 0)
        .sort((a, b) => a.harga - b.harga);
      if (hargaList.length > 0) {
        const termurah = hargaList[0];
        const nama = p.toko[termurah.idx]?.nama || `Toko ${termurah.idx + 1}`;
        ringRows.push([
          "Rekomendasi Harga Terendah",
          `${nama} · Rp ${termurah.harga.toLocaleString("id-ID")}`,
        ]);
        ringRows.push([
          "Subtotal Estimasi (Qty × Harga Terendah)",
          `Rp ${(termurah.harga * p.qty).toLocaleString("id-ID")}`,
        ]);
      } else {
        ringRows.push(["Rekomendasi Harga", p.hargaSatuan > 0 ? `Rp ${p.hargaSatuan.toLocaleString("id-ID")}` : "-"]);
        ringRows.push([
          "Subtotal Estimasi",
          p.hargaSatuan > 0 ? `Rp ${(p.hargaSatuan * p.qty).toLocaleString("id-ID")}` : "-",
        ]);
      }
      ringRows.push(["Sumber Pendanaan", p.sumberPendanaan || "-"]);
      ringRows.push(["Catatan / Keterangan", p.kode ? `Kode Alat: ${p.kode} · Usulan ABT 2026` : "Usulan ABT Sarana SMK 2026"]);
      y = drawTable2Col(doc, ringRows, y, true, 70);
      y += 4;
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Halaman ${i} / ${pageCount}`, 297 - 14, 206, { align: "right" });
    doc.text("SARANA SMK · Direktorat SMK · Formulir Analisa Harga Pasar (3 Sumber)", 14, 206);
    doc.setTextColor(0);
  }
  const fname = `04_ANALISA_HARGA_PASAR_${filenameSafe(school)}.pdf`;
  if (mode === "download") doc.save(fname);
  return { dataUri: await blobDataUri(doc.output("blob")), filename: fname };
}
