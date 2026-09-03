"use client";

import {
  BadgeCheck,
  Building2,
  Edit3,
  FileDown,
  FileSignature,
  FileText,
  Loader2,
  Printer,
  Save,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export type DocumentKind = "RPA_NON_PARAF" | "RPA_PARAF" | "PKS";

export interface EditableDocumentFields {
  sekolah: {
    nama: string;
    npsn: string;
    provinsi: string;
    kabKota: string;
    kecamatan?: string;
    alamat: string;
    rtRw?: string;
    kodePos?: string;
    namaKepalaSekolah: string;
    nipKepalaSekolah: string;
    pangkatGolonganKepala?: string;
  };
  ppk: {
    nama: string;
    nip: string;
    pangkatGolongan?: string;
    jabatan: string;
    unitKerja: string;
  };
  rpa: {
    nomor: string;
    tanggal: string;
    periodeTahun: string;
    judul: string;
  };
  pks: {
    nomor: string;
    tanggal: string;
    masaBerlakuMulai: string;
    masaBerlakuSelesai: string;
    judul: string;
    nilaiBantuanRp?: string;
  };
  meta: {
    kotaPembuatanSurat: string;
    tanggalHariIniTtd: string;
    namaPejabatTtdLainnya?: string;
    jabatanPejabatTtdLainnya?: string;
    nipPejabatTtdLainnya?: string;
    catatanKaki?: string;
  };
}

export const EMPTY_EDITABLE_DOCUMENT_FIELDS: EditableDocumentFields = {
  sekolah: {
    nama: "",
    npsn: "",
    provinsi: "",
    kabKota: "",
    kecamatan: "",
    alamat: "",
    rtRw: "",
    kodePos: "",
    namaKepalaSekolah: "",
    nipKepalaSekolah: "",
    pangkatGolonganKepala: "",
  },
  ppk: {
    nama: "",
    nip: "",
    pangkatGolongan: "",
    jabatan: "Pejabat Pembuat Komitmen (PPK)",
    unitKerja: "BSKAP - KEMENDIKBUDRISTEK",
  },
  rpa: {
    nomor: "",
    tanggal: "",
    periodeTahun: String(new Date().getFullYear()),
    judul: "RENCANA PENGGUNAAN ALAT (RPA)",
  },
  pks: {
    nomor: "",
    tanggal: "",
    masaBerlakuMulai: "",
    masaBerlakuSelesai: "",
    judul: "PERJANJIAN KERJA SAMA (PKS)",
    nilaiBantuanRp: "",
  },
  meta: {
    kotaPembuatanSurat: "",
    tanggalHariIniTtd: "",
    namaPejabatTtdLainnya: "",
    jabatanPejabatTtdLainnya: "",
    nipPejabatTtdLainnya: "",
    catatanKaki:
      "Dokumen ini merupakan salinan resmi yang disimpan secara digital di aplikasi SARANA SMK. Apabila terdapat perbedaan isian, silakan hubungi fasilitator pendamping sekolah.",
  },
};

const STORAGE_KEY_PREFIX = "saranasmk-docx-fields";

function buildStorageKey(schoolIdOrNpsn: string): string {
  return `${STORAGE_KEY_PREFIX}-${schoolIdOrNpsn}`;
}

function loadStoredFields(schoolKey: string): EditableDocumentFields | null {
  try {
    const raw = localStorage.getItem(buildStorageKey(schoolKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EditableDocumentFields>;
    return {
      sekolah: { ...EMPTY_EDITABLE_DOCUMENT_FIELDS.sekolah, ...(parsed.sekolah ?? {}) },
      ppk: { ...EMPTY_EDITABLE_DOCUMENT_FIELDS.ppk, ...(parsed.ppk ?? {}) },
      rpa: { ...EMPTY_EDITABLE_DOCUMENT_FIELDS.rpa, ...(parsed.rpa ?? {}) },
      pks: { ...EMPTY_EDITABLE_DOCUMENT_FIELDS.pks, ...(parsed.pks ?? {}) },
      meta: { ...EMPTY_EDITABLE_DOCUMENT_FIELDS.meta, ...(parsed.meta ?? {}) },
    };
  } catch {
    return null;
  }
}

function saveStoredFields(schoolKey: string, fields: EditableDocumentFields): void {
  try {
    localStorage.setItem(buildStorageKey(schoolKey), JSON.stringify(fields));
  } catch {
    // ignore quota errors
  }
}

function formatDateID(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  return `${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

function fieldOr(value: string | null | undefined, fallback = "—"): string {
  const v = String(value ?? "").trim();
  return v || fallback;
}

export interface DocumentEditablePreviewProps {
  schoolKey: string;
  schoolName: string;
  schoolNpsn: string;
  schoolProvince: string;
  schoolCity: string;
  schoolAddress?: string;
  kind: DocumentKind;
  readOnly?: boolean;
}

export function DocumentEditablePreview(props: DocumentEditablePreviewProps) {
  const { schoolKey, schoolName, schoolNpsn, schoolProvince, schoolCity, schoolAddress, kind, readOnly = false } = props;

  const [fields, setFields] = useState<EditableDocumentFields>(() => {
    const stored = loadStoredFields(schoolKey);
    return stored ?? structuredClone(EMPTY_EDITABLE_DOCUMENT_FIELDS);
  });

  useEffect(() => {
    setFields((prev) => {
      const stored = loadStoredFields(schoolKey);
      if (stored) return stored;
      const merged = structuredClone(prev);
      if (!merged.sekolah.nama && schoolName) merged.sekolah.nama = schoolName;
      if (!merged.sekolah.npsn && schoolNpsn) merged.sekolah.npsn = schoolNpsn;
      if (!merged.sekolah.provinsi && schoolProvince) merged.sekolah.provinsi = schoolProvince;
      if (!merged.sekolah.kabKota && schoolCity) merged.sekolah.kabKota = schoolCity;
      if (!merged.sekolah.alamat && schoolAddress) merged.sekolah.alamat = schoolAddress;
      if (!merged.meta.kotaPembuatanSurat && schoolCity) merged.meta.kotaPembuatanSurat = schoolCity;
      if (!merged.meta.tanggalHariIniTtd) {
        const today = new Date();
        const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        merged.meta.tanggalHariIniTtd = iso;
      }
      return merged;
    });
  }, [schoolKey, schoolName, schoolNpsn, schoolProvince, schoolCity, schoolAddress]);

  const [activeModal, setActiveModal] = useState<null | "DATA_SEKOLAH" | "RPA_PKS">(null);
  const [formDraft, setFormDraft] = useState<EditableDocumentFields>(structuredClone(fields));
  const [saveStatus, setSaveStatus] = useState<"" | "saving" | "saved">("");

  useEffect(() => {
    setFormDraft(structuredClone(fields));
  }, [fields, activeModal]);

  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = setTimeout(() => setSaveStatus(""), 1800);
    return () => clearTimeout(t);
  }, [saveStatus]);

  const printableRef = useRef<HTMLDivElement>(null);

  const documentLabel: string = useMemo(() => {
    switch (kind) {
      case "RPA_NON_PARAF":
        return "RPA Non Paraf - Rencana Penggunaan Alat (Draft Review)";
      case "RPA_PARAF":
        return "RPA Paraf - Rencana Penggunaan Alat (Final, ditandatangani)";
      case "PKS":
        return "PKS - Perjanjian Kerja Sama";
    }
  }, [kind]);

  const documentBadge: string = useMemo(() => {
    switch (kind) {
      case "RPA_NON_PARAF":
        return "RPA · Non Paraf";
      case "RPA_PARAF":
        return "RPA · Paraf Final";
      case "PKS":
        return "PKS";
    }
  }, [kind]);

  function handleOpenModal(type: "DATA_SEKOLAH" | "RPA_PKS") {
    setFormDraft(structuredClone(fields));
    setActiveModal(type);
  }

  function handleCloseModal() {
    setActiveModal(null);
  }

  function handleSaveDraft() {
    setSaveStatus("saving");
    saveStoredFields(schoolKey, formDraft);
    setFields(structuredClone(formDraft));
    setTimeout(() => setSaveStatus("saved"), 180);
  }

  function handlePrint() {
    if (!printableRef.current) return;
    const w = window.open("", "_blank", "noopener,width=960,height=800");
    if (!w) {
      window.print();
      return;
    }
    const html = printableRef.current.innerHTML;
    w.document.write(`<!doctype html>
<html>
<head>
  <title>${documentLabel} - ${fieldOr(fields.sekolah.nama, schoolName || "Sekolah")}</title>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
    body { font-family: 'Times New Roman', Times, serif; color: #0b1220; font-size: 11.5pt; line-height: 1.55; }
    h1,h2,h3,h4 { font-family: 'Times New Roman', Times, serif; }
    .kop-line { border-bottom: 3px double #0b1220; margin: 0 0 16px 0; padding-bottom: 10px; }
    .ttd { page-break-inside: avoid; }
    table.f { border-collapse: collapse; width: 100%; }
    table.f td { padding: 4px 8px 4px 0; vertical-align: top; border: none; }
    table.f td.label { width: 180px; white-space: nowrap; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 60px; }
    .sig-block { text-align: center; }
    .sig-name { font-weight: 700; text-decoration: underline; text-underline-offset: 2px; margin-top: 56px; }
    .catatan-kaki { margin-top: 40px; font-size: 9.5pt; color: #334155; border-top: 1px dashed #94a3b8; padding-top: 8px; }
    .nomor-surat { text-align: right; margin-bottom: 24px; }
    .judul { text-align: center; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 8px 0 4px 0; }
    .judul-line { width: 120px; border-bottom: 2px solid #0b1220; margin: 0 auto 18px auto; }
    .indent { text-indent: 36px; text-align: justify; }
    .mb-12 { margin-bottom: 12px; } .mb-24 { margin-bottom: 24px; } .mb-32 { margin-bottom: 32px; } .mt-24 { margin-top: 24px; }
  </style>
</head>
<body>${html}</body>
</html>`);
    w.document.close();
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch {
        // ignore print block
      }
    }, 250);
  }

  function handleDownloadHtml() {
    if (!printableRef.current) return;
    const nama = fieldOr(fields.sekolah.nama, schoolName || "sekolah").replace(/[^A-Za-z0-9]+/g, "-");
    const label = kind === "PKS" ? "PKS" : kind === "RPA_PARAF" ? "RPA-Paraf" : "RPA-Non-Paraf";
    const fileName = `${label}-${nama}.html`;
    const html = printableRef.current.innerHTML;
    const full = `<!doctype html><html><head><meta charset="utf-8"/><title>${label} - ${nama}</title></head><body>${html}</body></html>`;
    const blob = new Blob([full], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  const s = fields.sekolah;
  const ppk = fields.ppk;
  const rpa = fields.rpa;
  const pks = fields.pks;
  const meta = fields.meta;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
          <FileText className="h-5 w-5 text-slate-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">{documentLabel}</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Preview dokumen RPA/PKS dalam format dokumen yang dapat diedit. Klik tombol edit untuk mengubah isian sekolah, PPK,
              nomor dan tanggal dokumen. Data otomatis disimpan secara lokal per sekolah (NPSN {fieldOr(schoolNpsn, s.npsn)}).
            </p>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/15">
            {documentBadge}
          </Badge>
          {saveStatus === "saved" ? (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20">
              <BadgeCheck className="mr-1 h-3.5 w-3.5" />
              Disimpan
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {!readOnly ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => handleOpenModal("DATA_SEKOLAH")}>
                  <Building2 className="h-4 w-4" />
                  Edit Data Sekolah
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => handleOpenModal("RPA_PKS")}>
                  <FileSignature className="h-4 w-4" />
                  Edit Data RPA / PKS
                </Button>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleDownloadHtml}>
              <FileDown className="h-4 w-4" />
              Download (HTML)
            </Button>
            <Button type="button" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              Print Dokumen
            </Button>
            {saveStatus === "saving" ? (
              <span className="inline-flex items-center gap-2 text-xs text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Menyimpan...
              </span>
            ) : null}
          </div>
        </div>

        <div className="bg-slate-100 p-4 md:p-6">
          <div
            className="mx-auto w-full max-w-[1080px] overflow-hidden rounded-[20px] border border-slate-300 bg-white shadow-lg p-8 md:p-14"
            style={{
              fontFamily: "'Times New Roman', Times, serif",
              color: "#0b1220",
              fontSize: "11.5pt",
              lineHeight: 1.6,
            }}
          >
            <DocumentPrintablePreview kind={kind} fields={fields} schoolFallbackName={schoolName} printableRef={printableRef} />
          </div>
        </div>
      </Card>

      {activeModal === "DATA_SEKOLAH" ? (
        <ModalEditFields
          title="Edit Data Sekolah"
          subtitle={`Untuk ${fieldOr(fields.sekolah.nama, schoolName || "Sekolah terpilih")}`}
          onClose={handleCloseModal}
          form={formDraft}
          onChange={setFormDraft}
          variant="DATA_SEKOLAH"
          onSave={handleSaveDraft}
          saving={saveStatus === "saving"}
        />
      ) : null}

      {activeModal === "RPA_PKS" ? (
        <ModalEditFields
          title="Edit Data RPA, PKS & Pejabat"
          subtitle="Data nomor, tanggal, pejabat PPK, dan meta penandatangan surat"
          onClose={handleCloseModal}
          form={formDraft}
          onChange={setFormDraft}
          variant="RPA_PKS"
          onSave={handleSaveDraft}
          saving={saveStatus === "saving"}
        />
      ) : null}
    </div>
  );
}

/* =========================================================
 *  Document Printable Preview (HTML mimicking DOCX style)
 * ========================================================= */

function DocumentPrintablePreview({
  kind,
  fields,
  schoolFallbackName,
  printableRef,
}: {
  kind: DocumentKind;
  fields: EditableDocumentFields;
  schoolFallbackName?: string;
  printableRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const s = fields.sekolah;
  const ppk = fields.ppk;
  const rpa = fields.rpa;
  const pks = fields.pks;
  const meta = fields.meta;

  if (kind === "PKS") {
    return (
      <div ref={printableRef}>
        <KopSurat fields={fields} />

        <div className="nomor-surat">
          <div>
            <span style={{ display: "inline-block", minWidth: 120 }}>Nomor</span>
            <span>: {fieldOr(pks.nomor, "…………………………………………")}</span>
          </div>
          <div>
            <span style={{ display: "inline-block", minWidth: 120 }}>Lampiran</span>
            <span>: 1 (satu) berkas</span>
          </div>
          <div>
            <span style={{ display: "inline-block", minWidth: 120 }}>
              {fieldOr(meta.kotaPembuatanSurat || s.kabKota, "-")},{" "}
              {formatDateID(pks.tanggal) || fieldOr(meta.tanggalHariIniTtd, "………………")}
            </span>
          </div>
        </div>

        <h1 className="judul">{fieldOr(pks.judul, "PERJANJIAN KERJA SAMA (PKS)")}</h1>
        <div className="judul-line" />

        <div className="mb-24 indent">
          Pada hari ini <strong>{namaHari(pks.tanggal || meta.tanggalHariIniTtd)}</strong>, tanggal{" "}
          <strong>{formatDateID(pks.tanggal || meta.tanggalHariIniTtd) || "……………………"}</strong>, bertempat di{" "}
          <strong>{fieldOr(meta.kotaPembuatanSurat || s.kabKota || s.provinsi, "……………………")}</strong>, yang bertanda tangan di bawah ini:
        </div>

        <table className="f mb-24">
          <tbody>
            <tr>
              <td className="label">Nama</td>
              <td>: <strong>{fieldOr(ppk.nama)}</strong></td>
            </tr>
            <tr>
              <td className="label">NIP</td>
              <td>: {fieldOr(ppk.nip)}</td>
            </tr>
            <tr>
              <td className="label">Pangkat/Golongan</td>
              <td>: {fieldOr(ppk.pangkatGolongan, "-")}</td>
            </tr>
            <tr>
              <td className="label">Jabatan</td>
              <td>: {fieldOr(ppk.jabatan, "Pejabat Pembuat Komitmen (PPK)")}</td>
            </tr>
            <tr>
              <td className="label">Unit Kerja</td>
              <td>: {fieldOr(ppk.unitKerja, "BSKAP - KEMENDIKBUDRISTEK")}</td>
            </tr>
          </tbody>
        </table>

        <div className="mb-12 indent">
          Dalam hal ini bertindak untuk dan atas nama <strong>PEMERINTAH REPUBLIK INDONESIA, KEMENTERIAN PENDIDIKAN, KEBUDAYAAN, RISET, DAN TEKNOLOGI</strong>
          , selanjutnya disebut <strong>PIHAK PERTAMA</strong>.
        </div>

        <div className="mb-12 indent text-center" style={{ margin: "14px 0 14px 0", fontWeight: 700 }}>
          — DAN —
        </div>

        <table className="f mb-24">
          <tbody>
            <tr>
              <td className="label">Nama Sekolah</td>
              <td>: <strong>{fieldOr(s.nama || schoolFallbackName, "-")}</strong></td>
            </tr>
            <tr>
              <td className="label">NPSN</td>
              <td>: <span className="font-mono">{fieldOr(s.npsn)}</span></td>
            </tr>
            <tr>
              <td className="label">Alamat</td>
              <td>: {fieldOr(s.alamat)}{s.rtRw ? `, RT/RW ${s.rtRw}` : ""}{s.kecamatan ? `, Kec. ${s.kecamatan}` : ""}{s.kabKota ? `, ${s.kabKota}` : ""}{s.provinsi ? `, Prov. ${s.provinsi}` : ""}{s.kodePos ? ` — Kode Pos ${s.kodePos}` : ""}</td>
            </tr>
            <tr>
              <td className="label">Kepala Sekolah</td>
              <td>: {fieldOr(s.namaKepalaSekolah)}</td>
            </tr>
            <tr>
              <td className="label">NIP Kepala Sekolah</td>
              <td>: {fieldOr(s.nipKepalaSekolah, "-")}</td>
            </tr>
            <tr>
              <td className="label">Pangkat/Golongan</td>
              <td>: {fieldOr(s.pangkatGolonganKepala, "-")}</td>
            </tr>
          </tbody>
        </table>

        <div className="mb-12 indent">
          Dalam hal ini bertindak untuk dan atas nama <strong>{fieldOr(s.nama || schoolFallbackName, "SEKOLAH")}</strong>, selanjutnya disebut{" "}
          <strong>PIHAK KEDUA</strong>.
        </div>

        <div className="mb-24">
          <h4 style={{ fontWeight: 700, marginBottom: 6 }}>Pasal 1 — Ruang Lingkup</h4>
          <div className="indent mb-12">
            Pihak Pertama memberikan bantuan peralatan praktik kepada Pihak Kedua sesuai dengan ketentuan PERDIRJEN 33 Tahun 2025 dan PERKA BSKAP Nomor 019/F/KP/2026
            tentang Pemberian Bantuan Alat Praktik bagi SMK Penerima Program Pusat Keunggulan. Pihak Kedua menyetujui dan bersedia menerima bantuan tersebut.
          </div>
          <h4 style={{ fontWeight: 700, marginBottom: 6 }}>Pasal 2 — Nilai Bantuan</h4>
          <div className="indent mb-12">
            Nilai total bantuan yang diberikan kepada Pihak Kedua dalam perjanjian ini adalah sebesar{" "}
            <strong>
              {fieldOr(pks.nilaiBantuanRp, "……………………………………………… (…………………………………………………………………… Rupiah)")}
            </strong>
            , yang selanjutnya akan dipecah dalam Daftar Rincian Alat Praktik (RPA) sebagai lampiran tidak terpisahkan dari Perjanjian Kerja Sama ini.
          </div>
          <h4 style={{ fontWeight: 700, marginBottom: 6 }}>Pasal 3 — Masa Berlaku</h4>
          <div className="indent mb-12">
            Perjanjian ini berlaku mulai tanggal <strong>{formatDateID(pks.masaBerlakuMulai) || "……………………"}</strong> sampai dengan tanggal{" "}
            <strong>{formatDateID(pks.masaBerlakuSelesai) || "……………………"}</strong>, dan dapat diperpanjang sesuai dengan ketentuan yang berlaku.
          </div>
          <h4 style={{ fontWeight: 700, marginBottom: 6 }}>Pasal 4 — Tanggung Jawab Para Pihak</h4>
          <div className="indent mb-12">
            (1) Pihak Pertama berkewajiban menyampaikan alat praktik sesuai dengan spesifikasi yang telah ditetapkan dan menyerahkan bukti penerimaan barang kepada Pihak Kedua
            setelah barang diterima dalam kondisi baik.
          </div>
          <div className="indent mb-12">
            (2) Pihak Kedua berkewajiban untuk mengelola, memelihara, menggunakan, dan melaporkan pemanfaatan alat praktik sesuai ketentuan peraturan perundang-undangan
            yang berlaku, serta menyampaikan laporan pertanggungjawaban secara berkala kepada Pihak Pertama melalui Fasilitator Administrasi dan Fasilitator Alat pendamping.
          </div>
          <h4 style={{ fontWeight: 700, marginBottom: 6 }}>Pasal 5 — Penutup</h4>
          <div className="indent mb-12">
            Hal-hal lain yang belum diatur dalam Perjanjian Kerja Sama ini akan ditetapkan kemudian dengan surat pernyataan tambah dan merupakan bagian tidak terpisahkan
            dari PKS ini, sepanjang tidak bertentangan dengan ketentuan peraturan perundang-undangan yang berlaku.
          </div>
        </div>

        <BlokTandaTangan fields={fields} variant="PKS" />
        {meta.catatanKaki ? <div className="catatan-kaki">{meta.catatanKaki}</div> : null}
      </div>
    );
  }

  return (
    <div ref={printableRef}>
      <KopSurat fields={fields} />

      <div className="nomor-surat">
        <div>
          <span style={{ display: "inline-block", minWidth: 140 }}>Nomor RPA</span>
          <span>: {fieldOr(rpa.nomor, "…………………………………………")}</span>
        </div>
        <div>
          <span style={{ display: "inline-block", minWidth: 140 }}>
            {fieldOr(meta.kotaPembuatanSurat || s.kabKota, "-")},{" "}
            {formatDateID(rpa.tanggal) || formatDateID(meta.tanggalHariIniTtd) || "………………"}
          </span>
        </div>
        <div>
          <span style={{ display: "inline-block", minWidth: 140 }}>Periode Tahun</span>
          <span>: {fieldOr(rpa.periodeTahun, String(new Date().getFullYear()))}</span>
        </div>
        {kind === "RPA_PARAF" ? (
          <div style={{ marginTop: 6 }}>
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-800 border-emerald-500/20">
              <BadgeCheck className="mr-1 h-3.5 w-3.5" />
              DOKUMEN FINAL — TELAH DI-PARAF KEPALA SEKOLAH &amp; TIM ADMINISTRASI
            </Badge>
          </div>
        ) : (
          <div style={{ marginTop: 6 }}>
            <Badge variant="secondary" className="bg-amber-500/10 text-amber-800 border-amber-500/20">
              DRAFT — BELUM DI-PARAF (REVIEW INTERNAL)
            </Badge>
          </div>
        )}
      </div>

      <h1 className="judul">{fieldOr(rpa.judul, "RENCANA PENGGUNAAN ALAT (RPA)")}</h1>
      <div className="judul-line" />

      <div className="mb-12 indent">
        Rencana Penggunaan Alat <strong>(RPA)</strong> ini disusun oleh{" "}
        <strong>{fieldOr(s.nama || schoolFallbackName, "……………………")}</strong> (NPSN{" "}
        <span className="font-mono">{fieldOr(s.npsn, "………………")}</span>)
        , sebagai pelengkap dari Perjanjian Kerja Sama (PKS) nomor{" "}
        <strong>{fieldOr(pks.nomor, "…………………………………………")}</strong> tanggal{" "}
        <strong>{formatDateID(pks.tanggal) || "………………"}</strong>. Dokumen ini memuat rincian rencana penggunaan,
        pemeliharaan, dan pelaporan pemanfaatan alat praktik bantuan selama periode tahun{" "}
        {fieldOr(rpa.periodeTahun, String(new Date().getFullYear()))}.
      </div>

      <h4 style={{ fontWeight: 700, marginBottom: 6 }}>A. Identitas Sekolah</h4>
      <table className="f mb-24">
        <tbody>
          <tr>
            <td className="label">Nama Sekolah</td>
            <td>: <strong>{fieldOr(s.nama || schoolFallbackName, "-")}</strong></td>
          </tr>
          <tr>
            <td className="label">NPSN</td>
            <td>: <span className="font-mono">{fieldOr(s.npsn)}</span></td>
          </tr>
          <tr>
            <td className="label">Provinsi</td>
            <td>: {fieldOr(s.provinsi)}</td>
          </tr>
          <tr>
            <td className="label">Kabupaten/Kota</td>
            <td>: {fieldOr(s.kabKota)}</td>
          </tr>
          {s.kecamatan ? (
            <tr>
              <td className="label">Kecamatan</td>
              <td>: {s.kecamatan}</td>
            </tr>
          ) : null}
          <tr>
            <td className="label">Alamat Lengkap</td>
            <td>: {fieldOr(s.alamat, "-")}{s.rtRw ? `, RT/RW ${s.rtRw}` : ""}{s.kodePos ? ` — Kode Pos ${s.kodePos}` : ""}</td>
          </tr>
          <tr>
            <td className="label">Kepala Sekolah</td>
            <td>: {fieldOr(s.namaKepalaSekolah)}</td>
          </tr>
          <tr>
            <td className="label">NIP Kepala Sekolah</td>
            <td>: {fieldOr(s.nipKepalaSekolah, "-")}</td>
          </tr>
        </tbody>
      </table>

      <h4 style={{ fontWeight: 700, marginBottom: 6 }}>B. Rencana Penggunaan &amp; Pemeliharaan Alat</h4>
      <div className="indent mb-12">
        (1) Alat praktik bantuan akan dipergunakan untuk menunjang kegiatan pembelajaran praktik pada konsentrasi keahlian yang telah ditentukan
        sesuai program Pusat Keunggulan (PK) dan mengacu pada Capaian Pembelajaran Fase F sesuai KEPKA BSKAP NOMOR 046/H/KR/2025.
      </div>
      <div className="indent mb-12">
        (2) Jadwal pemeliharaan alat dilaksanakan minimal <strong>1 (satu) kali setiap bulan</strong> oleh tim bengkel/guru produktif yang ditunjuk oleh Kepala Sekolah,
        dan didokumentasikan dalam Berita Acara Pemeriksaan Alat (BAPA). Laporan pemeriksaan disampaikan kepada Fasilitator Alat pendamping selambat-lambatnya
        tanggal 10 bulan berikutnya.
      </div>
      <div className="indent mb-12">
        (3) Penggunaan alat diluar kegiatan pembelajaran (luring/luar jam sekolah) hanya dapat dilakukan dengan persetujuan tertulis dari Kepala Sekolah dan
        dilaporkan ke Fasilitator Administrasi pendamping paling lambat 7 (tujuh) hari kalender setelah kegiatan dilaksanakan.
      </div>

      <h4 style={{ fontWeight: 700, marginBottom: 6 }}>C. Pelaporan &amp; Pertanggungjawaban</h4>
      <div className="indent mb-24">
        Laporan pemanfaatan alat praktik dan realisasi Rencana Penggunaan Alat ini dilaporkan secara berkala <strong>Triwulanan (setiap 3 bulan)</strong>{" "}
        kepada BSKAP Kemendikbudristek melalui SARANA SMK, dan apabila ada ketidaksesuaian akan ditindaklanjuti melalui rapat koordinasi dengan
        Fasilitator Administrasi dan Fasilitator Alat pendamping sekolah.
      </div>

      <BlokTandaTangan fields={fields} variant={kind === "RPA_PARAF" ? "RPA_PARAF" : "RPA_NON_PARAF"} />
      {meta.catatanKaki ? <div className="catatan-kaki">{meta.catatanKaki}</div> : null}
    </div>
  );
}

/* =========================================================
 *  Kop Surat & Blok Tanda Tangan & utility helper
 * ========================================================= */

function KopSurat({ fields }: { fields: EditableDocumentFields }) {
  const s = fields.sekolah;
  return (
    <div className="kop-line">
      <table style={{ width: "100%", border: "none", borderCollapse: "collapse" }}>
        <tbody>
          <tr>
            <td style={{ width: 86, verticalAlign: "middle", paddingRight: 14 }}>
              <div
                style={{
                  width: 68,
                  height: 68,
                  margin: "0 auto",
                  background:
                    "radial-gradient(circle at center, #fef2cc 0%, #facc15 36%, #ca8a04 100%)",
                  border: "3px double #0f172a",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#0f172a",
                  fontFamily: "'Times New Roman', Times, serif",
                }}
              >
                NKRI
              </div>
            </td>
            <td style={{ textAlign: "center", verticalAlign: "middle" }}>
              <div style={{ fontSize: "12.5pt", fontWeight: 700, letterSpacing: 0.5 }}>
                KEMENTERIAN PENDIDIKAN, KEBUDAYAAN, RISET, DAN TEKNOLOGI
              </div>
              <div style={{ fontSize: "13.5pt", fontWeight: 700, marginTop: 3, textTransform: "uppercase", letterSpacing: 0.6 }}>
                {fieldOr(s.nama, "SMK NEGERI ………………………………………………")}
              </div>
              <div style={{ fontSize: "10.5pt", marginTop: 3, lineHeight: 1.45 }}>
                {fieldOr(s.alamat, "Jl. …………………………………………………")}
                {s.rtRw ? `, RT/RW ${s.rtRw}` : ""}
                {s.kecamatan ? `, Kec. ${s.kecamatan}` : ""}
                {s.kabKota ? `, ${s.kabKota}` : ""}
                {s.provinsi ? `, Prov. ${s.provinsi}` : ""}
                {s.kodePos ? ` — Kode Pos ${s.kodePos}` : ""}
              </div>
              <div style={{ fontSize: "10.5pt", marginTop: 2 }}>
                NPSN: <span className="font-mono">{fieldOr(s.npsn, "………………")}</span> · Email: …………………………………… · Telp: ……………………………………
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BlokTandaTangan({
  fields,
  variant,
}: {
  fields: EditableDocumentFields;
  variant: "RPA_NON_PARAF" | "RPA_PARAF" | "PKS";
}) {
  const s = fields.sekolah;
  const ppk = fields.ppk;
  const meta = fields.meta;
  const tempatTanggal = `${fieldOr(meta.kotaPembuatanSurat || s.kabKota, "-")}, ${formatDateID(meta.tanggalHariIniTtd) || "………………"}`;
  return (
    <div className="ttd">
      <div style={{ marginBottom: 8 }}>{tempatTanggal}</div>
      <div className="signature-grid">
        <div className="sig-block">
          <div style={{ fontWeight: 600 }}>
            {variant === "PKS" ? "PIHAK PERTAMA" : "MENGETAHUI,"}
          </div>
          <div style={{ marginTop: 2 }}>
            {variant === "PKS" ? fieldOr(ppk.jabatan, "Pejabat Pembuat Komitmen") : "Kepala Sekolah SMK Pusat Keunggulan"}
          </div>
          <div style={{ marginTop: 2 }}>
            {variant === "PKS" ? fieldOr(ppk.unitKerja, "") : fieldOr(s.nama, "")}
          </div>
          <div className="sig-name">
            {variant === "PKS" ? fieldOr(ppk.nama, "(……………………………………)") : fieldOr(s.namaKepalaSekolah, "(……………………………………)")}
          </div>
          <div style={{ marginTop: 2 }}>
            NIP: {variant === "PKS" ? fieldOr(ppk.nip, "………………") : fieldOr(s.nipKepalaSekolah, "………………")}
          </div>
          {ppk.pangkatGolongan && variant === "PKS" ? (
            <div style={{ marginTop: 2 }}>Pangkat/Gol.: {ppk.pangkatGolongan}</div>
          ) : null}
        </div>
        <div className="sig-block">
          <div style={{ fontWeight: 600 }}>
            {variant === "PKS" ? "PIHAK KEDUA" : "PEMBUAT, "}
          </div>
          <div style={{ marginTop: 2 }}>
            {variant === "PKS"
              ? `Kepala Sekolah ${fieldOr(s.nama, "")}`
              : variant === "RPA_PARAF"
                ? "Fasilitator Administrasi Pendamping"
                : "Ketua Tim Bengkel / Guru Produktif"}
          </div>
          <div style={{ marginTop: 2 }}>
            {variant === "RPA_NON_PARAF" ? "Bertanggung Jawab Alat Praktik" : ""}
          </div>
          <div className="sig-name">
            {variant === "PKS"
              ? fieldOr(s.namaKepalaSekolah, "(……………………………………)")
              : variant === "RPA_PARAF"
                ? fieldOr(meta.namaPejabatTtdLainnya, "(……………………………………)")
                : fieldOr(meta.namaPejabatTtdLainnya, "(……………………………………)")}
          </div>
          <div style={{ marginTop: 2 }}>
            NIP: {variant === "PKS" ? fieldOr(s.nipKepalaSekolah, "………………") : fieldOr(meta.nipPejabatTtdLainnya, "………………")}
          </div>
          {variant !== "PKS" && meta.jabatanPejabatTtdLainnya ? (
            <div style={{ marginTop: 2 }}>{meta.jabatanPejabatTtdLainnya}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function namaHari(dateStr: string | null | undefined): string {
  if (!dateStr) return "……………………";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return "……………………";
  return [
    "Minggu",
    "Senin",
    "Selasa",
    "Rabu",
    "Kamis",
    "Jumat",
    "Sabtu",
  ][d.getDay()];
}

/* =========================================================
 *  MODAL EDIT (native <dialog>) — Tidak bergantung ke shadcn Modal
 * ========================================================= */

function ModalEditFields({
  title,
  subtitle,
  onClose,
  form,
  onChange,
  variant,
  onSave,
  saving,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  form: EditableDocumentFields;
  onChange: (next: EditableDocumentFields) => void;
  variant: "DATA_SEKOLAH" | "RPA_PKS";
  onSave: () => void;
  saving?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (!d.open) {
      try {
        if (typeof d.showModal === "function") d.showModal();
        else d.setAttribute("open", "open");
      } catch {
        d.setAttribute("open", "open");
      }
    }
    return () => {
      if (d.open) {
        try {
          d.close();
        } catch {
          d.removeAttribute("open");
        }
      }
    };
  }, []);

  function patch<K extends keyof EditableDocumentFields>(
    groupKey: K,
    field: keyof EditableDocumentFields[K],
    value: string,
  ) {
    const next = structuredClone(form);
    (next[groupKey][field] as string) = value;
    onChange(next);
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-[20px] border border-slate-200 bg-white shadow-2xl" style={{ maxHeight: "88vh" }}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <p className="text-base font-semibold text-slate-900">{title}</p>
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Tutup form"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: "calc(88vh - 120px)" }}>
          {variant === "DATA_SEKOLAH" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nama Sekolah" className="sm:col-span-2">
                <Input value={form.sekolah.nama} onChange={(e) => patch("sekolah", "nama", e.target.value)} placeholder="SMK NEGERI 1 …………" />
              </Field>
              <Field label="NPSN">
                <Input value={form.sekolah.npsn} onChange={(e) => patch("sekolah", "npsn", e.target.value)} placeholder="8 digit NPSN" />
              </Field>
              <Field label="Provinsi">
                <Input value={form.sekolah.provinsi} onChange={(e) => patch("sekolah", "provinsi", e.target.value)} placeholder="Provinsi" />
              </Field>
              <Field label="Kabupaten / Kota">
                <Input value={form.sekolah.kabKota} onChange={(e) => patch("sekolah", "kabKota", e.target.value)} placeholder="Kab. / Kota" />
              </Field>
              <Field label="Kecamatan">
                <Input value={form.sekolah.kecamatan ?? ""} onChange={(e) => patch("sekolah", "kecamatan", e.target.value)} placeholder="Kecamatan (opsional)" />
              </Field>
              <Field label="Alamat Jalan" className="sm:col-span-2">
                <Input value={form.sekolah.alamat} onChange={(e) => patch("sekolah", "alamat", e.target.value)} placeholder="Jl. Nama Jalan, No.XX" />
              </Field>
              <Field label="RT / RW">
                <Input value={form.sekolah.rtRw ?? ""} onChange={(e) => patch("sekolah", "rtRw", e.target.value)} placeholder="001 / 002 (opsional)" />
              </Field>
              <Field label="Kode Pos">
                <Input value={form.sekolah.kodePos ?? ""} onChange={(e) => patch("sekolah", "kodePos", e.target.value)} placeholder="5 digit (opsional)" />
              </Field>
              <Field label="Nama Kepala Sekolah" className="sm:col-span-2">
                <Input value={form.sekolah.namaKepalaSekolah} onChange={(e) => patch("sekolah", "namaKepalaSekolah", e.target.value)} placeholder="Nama lengkap Kepsek" />
              </Field>
              <Field label="NIP Kepala Sekolah">
                <Input value={form.sekolah.nipKepalaSekolah} onChange={(e) => patch("sekolah", "nipKepalaSekolah", e.target.value)} placeholder="18 digit NIP" />
              </Field>
              <Field label="Pangkat / Golongan">
                <Input value={form.sekolah.pangkatGolonganKepala ?? ""} onChange={(e) => patch("sekolah", "pangkatGolonganKepala", e.target.value)} placeholder="Pembina Tk.I / IV.a (opsional)" />
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="sm:col-span-2 mb-1">
                <SectionTitle>Data Pejabat PPK (Untuk PKS)</SectionTitle>
              </section>
              <Field label="Nama PPK" className="sm:col-span-2">
                <Input value={form.ppk.nama} onChange={(e) => patch("ppk", "nama", e.target.value)} placeholder="Nama Pejabat Pembuat Komitmen" />
              </Field>
              <Field label="NIP PPK">
                <Input value={form.ppk.nip} onChange={(e) => patch("ppk", "nip", e.target.value)} placeholder="NIP PPK" />
              </Field>
              <Field label="Pangkat / Golongan">
                <Input value={form.ppk.pangkatGolongan ?? ""} onChange={(e) => patch("ppk", "pangkatGolongan", e.target.value)} placeholder="(opsional)" />
              </Field>
              <Field label="Jabatan">
                <Input value={form.ppk.jabatan} onChange={(e) => patch("ppk", "jabatan", e.target.value)} placeholder="Pejabat Pembuat Komitmen" />
              </Field>
              <Field label="Unit Kerja">
                <Input value={form.ppk.unitKerja} onChange={(e) => patch("ppk", "unitKerja", e.target.value)} placeholder="BSKAP - KEMENDIKBUDRISTEK" />
              </Field>

              <section className="sm:col-span-2 mt-2">
                <SectionTitle>Data RPA (Rencana Penggunaan Alat)</SectionTitle>
              </section>
              <Field label="Nomor RPA">
                <Input value={form.rpa.nomor} onChange={(e) => patch("rpa", "nomor", e.target.value)} placeholder="019/RPA/BSKAP/…/2026" />
              </Field>
              <Field label="Tanggal RPA">
                <Input type="date" value={form.rpa.tanggal} onChange={(e) => patch("rpa", "tanggal", e.target.value)} />
              </Field>
              <Field label="Periode Tahun">
                <Input value={form.rpa.periodeTahun} onChange={(e) => patch("rpa", "periodeTahun", e.target.value)} placeholder="2026" />
              </Field>
              <Field label="Judul Halaman">
                <Input value={form.rpa.judul} onChange={(e) => patch("rpa", "judul", e.target.value)} placeholder="RENCANA PENGGUNAAN ALAT (RPA)" />
              </Field>

              <section className="sm:col-span-2 mt-2">
                <SectionTitle>Data PKS (Perjanjian Kerja Sama)</SectionTitle>
              </section>
              <Field label="Nomor PKS">
                <Input value={form.pks.nomor} onChange={(e) => patch("pks", "nomor", e.target.value)} placeholder="020/PKS/BSKAP/…/2026" />
              </Field>
              <Field label="Tanggal PKS">
                <Input type="date" value={form.pks.tanggal} onChange={(e) => patch("pks", "tanggal", e.target.value)} />
              </Field>
              <Field label="Masa Berlaku Mulai">
                <Input type="date" value={form.pks.masaBerlakuMulai} onChange={(e) => patch("pks", "masaBerlakuMulai", e.target.value)} />
              </Field>
              <Field label="Selesai">
                <Input type="date" value={form.pks.masaBerlakuSelesai} onChange={(e) => patch("pks", "masaBerlakuSelesai", e.target.value)} />
              </Field>
              <Field label="Judul PKS" className="sm:col-span-2">
                <Input value={form.pks.judul} onChange={(e) => patch("pks", "judul", e.target.value)} placeholder="PERJANJIAN KERJA SAMA" />
              </Field>
              <Field label="Nilai Bantuan (Rp.)" className="sm:col-span-2">
                <Input value={form.pks.nilaiBantuanRp ?? ""} onChange={(e) => patch("pks", "nilaiBantuanRp", e.target.value)} placeholder="Rp. 500.000.000,00 (Lima Ratus Juta Rupiah)" />
              </Field>

              <section className="sm:col-span-2 mt-2">
                <SectionTitle>Meta Surat &amp; Penandatangan Lainnya</SectionTitle>
              </section>
              <Field label="Kota Pembuatan Surat">
                <Input value={form.meta.kotaPembuatanSurat} onChange={(e) => patch("meta", "kotaPembuatanSurat", e.target.value)} placeholder="Kab. Aceh Barat" />
              </Field>
              <Field label="Tanggal Hari Ini (TTD)">
                <Input type="date" value={form.meta.tanggalHariIniTtd} onChange={(e) => patch("meta", "tanggalHariIniTtd", e.target.value)} />
              </Field>
              <Field label="Nama Pejabat Tanda Tangan Lain" className="sm:col-span-2">
                <Input value={form.meta.namaPejabatTtdLainnya ?? ""} onChange={(e) => patch("meta", "namaPejabatTtdLainnya", e.target.value)} placeholder="Ketua Tim Bengkel / Guru Produktif" />
              </Field>
              <Field label="Jabatan Tanda Tangan Lain">
                <Input value={form.meta.jabatanPejabatTtdLainnya ?? ""} onChange={(e) => patch("meta", "jabatanPejabatTtdLainnya", e.target.value)} placeholder="(opsional)" />
              </Field>
              <Field label="NIP Tanda Tangan Lain">
                <Input value={form.meta.nipPejabatTtdLainnya ?? ""} onChange={(e) => patch("meta", "nipPejabatTtdLainnya", e.target.value)} placeholder="(opsional)" />
              </Field>
              <Field label="Catatan Kaki Surat" className="sm:col-span-2">
                <textarea
                  className="flex min-h-[80px] w-full rounded-[10px] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  value={form.meta.catatanKaki ?? ""}
                  onChange={(e) => patch("meta", "catatanKaki", e.target.value)}
                  placeholder="(opsional) catatan di paling bawah dokumen"
                />
              </Field>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
            Batal
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-primary bg-primary px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/[0.08] px-3 py-1 text-xs font-semibold text-primary">
      {children}
    </div>
  );
}
