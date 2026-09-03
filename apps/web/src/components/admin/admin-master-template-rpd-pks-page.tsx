"use client";

import dynamic from "next/dynamic";
import {
  Eye,
  FileSignature,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  RefreshCcw,
  Save,
  Sparkles,
  Star,
  Trash2,
  X,
  Building2,
  ClipboardCheck,
  Store,
  ClipboardList,
  Calculator,
  Handshake,
  Code2,
  LayoutDashboard,
  FileDown,
  FileUp,
  ClipboardCopy,
  Wand2,
  Download,
  File,
  AlertTriangle,
  FolderOpen,
  DatabaseZap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  resolvePlaceholdersHtml,
  type PageSetup,
  exportPdfFromHtml,
} from "@/components/shared/rich-text-editor";
import { GrapesJsRpdEditor, type EditorSharedProps } from "@/components/shared/grapesjs-rpd-editor";

const MonacoRpdEditor = dynamic(
  () =>
    import("@/components/shared/monaco-rpd-editor").then((mod) => mod.MonacoRpdEditor),
  {
    ssr: false,
    loading: () => (
      <div className="w-full flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-8 text-[11px] text-slate-500" style={{ minHeight: "720px" }}>
        <Loader2 className="h-4 w-4 animate-spin mr-2 text-indigo-600" />
        Memuat Monaco Editor (VS Code-like)…
      </div>
    ),
  },
);
import {
  RPD_PKS_PLACEHOLDER_CHEATSHEET,
  DEFAULT_RPD_TEMPLATE_HTML,
  DEFAULT_PKS_TEMPLATE_HTML,
  DEFAULT_IDENTITAS_TEMPLATE_HTML,
  DEFAULT_ADMINISTRASI_TEMPLATE_HTML,
  DEFAULT_SURVEY_HARGA_TEMPLATE_HTML,
  DEFAULT_RPKP_TEMPLATE_HTML,
  DEFAULT_RAB_TEMPLATE_HTML,
} from "@/lib/rpd-pks-default-templates";
import {
  templateDeleteRequest,
  templateListRequest,
  templateSetActiveRequest,
  templateUpsertRequest,
  type MasterTemplateRow,
  type PrintTemplateKind,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  loadPublicTemplateHtml,
  generateTemplateNo1Html,
  type TemplateTabNumber,
} from "@/lib/template-generators";
import { useAuthStore } from "@/store/auth-store";

type Kind = PrintTemplateKind;

const KIND_META: Record<Kind, { label: string; idx: string; badgeClass: string; iconClass: string; iconNode: ReactNode }> = {
  IDENTITAS: {
    label: "① Data Sekolah",
    idx: "1",
    badgeClass: "border-slate-200 bg-slate-50 text-slate-800",
    iconClass: "",
    iconNode: <Building2 className="mr-1 h-3.5 w-3.5" />,
  },
  ADMINISTRASI: {
    label: "② Administrasi",
    idx: "2",
    badgeClass: "border-sky-200 bg-sky-50 text-sky-800",
    iconClass: "",
    iconNode: <ClipboardCheck className="mr-1 h-3.5 w-3.5" />,
  },
  SURVEY_HARGA: {
    label: "③ Survey Harga Pasar",
    idx: "3",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
    iconClass: "",
    iconNode: <Store className="mr-1 h-3.5 w-3.5" />,
  },
  RPKP: {
    label: "④ RPKP",
    idx: "4",
    badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-800",
    iconClass: "",
    iconNode: <ClipboardList className="mr-1 h-3.5 w-3.5" />,
  },
  RAB: {
    label: "⑤ RAB",
    idx: "5",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800",
    iconClass: "",
    iconNode: <Calculator className="mr-1 h-3.5 w-3.5" />,
  },
  RPD: {
    label: "⑥ RPD",
    idx: "6",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-800",
    iconClass: "",
    iconNode: <FileText className="mr-1 h-3.5 w-3.5" />,
  },
  PKS: {
    label: "⑦ PKS",
    idx: "7",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-800",
    iconClass: "",
    iconNode: <FileSignature className="mr-1 h-4 w-4" />,
  },
};

const ALL_KINDS: readonly Kind[] = ["IDENTITAS", "ADMINISTRASI", "SURVEY_HARGA", "RPKP", "RAB", "RPD", "PKS"] as const;

const KIND_TO_TABNO: Record<Kind, TemplateTabNumber> = {
    IDENTITAS: 1,
    ADMINISTRASI: 2,
    SURVEY_HARGA: 3,
    RPKP: 4,
    RAB: 5,
    RPD: 6,
    PKS: 7,
  };
  const SAMPLE_NPSN_FOR_TEMPLATE_1 = "69909282";

const DEFAULT_HTML_BY_KIND: Record<Kind, string> = {
  IDENTITAS: DEFAULT_IDENTITAS_TEMPLATE_HTML,
  ADMINISTRASI: DEFAULT_ADMINISTRASI_TEMPLATE_HTML,
  SURVEY_HARGA: DEFAULT_SURVEY_HARGA_TEMPLATE_HTML,
  RPKP: DEFAULT_RPKP_TEMPLATE_HTML,
  RAB: DEFAULT_RAB_TEMPLATE_HTML,
  RPD: DEFAULT_RPD_TEMPLATE_HTML,
  PKS: DEFAULT_PKS_TEMPLATE_HTML,
};

const DEFAULT_TITLE_BY_KIND: Record<Kind, string> = {
  IDENTITAS: "Template 1 — Data Sekolah (Identitas)",
  ADMINISTRASI: "Template 2 — Ceklis Kelengkapan Dokumen Administrasi",
  SURVEY_HARGA: "Template 3 — Survey Harga Pasar 3 Toko",
  RPKP: "Template 4 — Rencana Pengadaan Kerja Praktek (RPKP)",
  RAB: "Template 5 — Rencana Anggaran Biaya (RAB)",
  RPD: "Template 6 — Rencana Penggunaan Dana (RPD)",
  PKS: "Template 7 — Perjanjian Kerja Sama (PKS)",
};

const CREATE_BUTTON_CLASS_BY_KIND: Record<Kind, string> = {
  IDENTITAS: "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
  ADMINISTRASI: "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100",
  SURVEY_HARGA: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
  RPKP: "border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100",
  RAB: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  RPD: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
  PKS: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100",
};

interface EditorFormState {
  id?: string;
  kind: Kind;
  version_label: string;
  tahun_ajaran: string;
  is_active: boolean;
  title: string;
  body_html: string;
  notes: string;
}

const EMPTY_FORM: EditorFormState = {
  kind: "IDENTITAS",
  version_label: "v1",
  tahun_ajaran: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
  is_active: false,
  title: "",
  body_html: "",
  notes: "",
};

type EditorMode = "monaco" | "grapesjs" | "preview" | "pdfPreview";

export function AdminMasterTemplateRpdPksPage() {
  const { session, hydrated, hydrate } = useAuthStore();
  const token = session?.token ?? "";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<MasterTemplateRow[]>([]);
  const [activeKind, setActiveKind] = useState<"ALL" | Kind>("ALL");
  const [search, setSearch] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>("monaco");
  const [form, setForm] = useState<EditorFormState>({ ...EMPTY_FORM });
  const [editorPageSetup, setEditorPageSetup] = useState<PageSetup>({ preset: "a4" });
  const [lastFeedback, setLastFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const htmlUploadRef = useRef<HTMLInputElement | null>(null);
  const lastPdfBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const loadRows = async (silent = false) => {
    if (!hydrated || !session?.token) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await templateListRequest(session.token);
      setRows(res.rows);
    } catch (err) {
      setLastFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal memuat daftar template.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, [hydrated, session?.token]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (activeKind !== "ALL" && r.kind !== activeKind) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.version_label.toLowerCase().includes(q) ||
        (r.notes ?? "").toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q)
      );
    });
  }, [rows, activeKind, search]);

  const isAdminOrSuper =
    session?.user?.role === "ADMIN" || session?.user?.role === "SUPERADMIN";

  function openCreate(kind: Kind) {
    const defaults = {
      ...EMPTY_FORM,
      kind,
      title: DEFAULT_TITLE_BY_KIND[kind],
      body_html: DEFAULT_HTML_BY_KIND[kind],
      version_label: "default-v1",
    };
    setForm(defaults);
    setEditorMode("monaco");
    setEditorOpen(true);
    setLastFeedback(null);
    if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }
    lastPdfBlobRef.current = null;
  }

  function openEdit(r: MasterTemplateRow) {
    setForm({
      id: r.id,
      kind: r.kind,
      version_label: r.version_label,
      tahun_ajaran: r.tahun_ajaran,
      is_active: Number(r.is_active) === 1,
      title: r.title,
      body_html: r.body_html,
      notes: r.notes ?? "",
    });
    setEditorMode("monaco");
    setEditorOpen(true);
    setLastFeedback(null);
    if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }
    lastPdfBlobRef.current = null;
  }

  async function handleSave() {
    if (!session?.token) return;
    if (!isAdminOrSuper) return;
    if (!form.title.trim()) {
      setLastFeedback({ type: "error", text: "Judul template wajib diisi." });
      return;
    }
    setSaving(true);
    setLastFeedback(null);
    try {
      const snapshotHtml = form.body_html;
      if (!snapshotHtml || snapshotHtml.replace(/<[^>]+>/g, "").trim().length < 10) {
        throw new Error("Isi template (body) minimal memiliki teks berarti. Gunakan tombol \"Muat Template\" di Ribbon ➕ Sisipkan jika lupa mulai dari mana.");
      }
      const res = await templateUpsertRequest(session.token, {
        id: form.id,
        kind: form.kind,
        version_label: form.version_label,
        tahun_ajaran: form.tahun_ajaran,
        is_active: form.is_active ? 1 : 0,
        title: form.title.trim(),
        body_html: snapshotHtml,
        notes: form.notes.trim() || null,
      });
      setLastFeedback({
        type: "success",
        text: form.id
          ? "Template berhasil di-update."
          : `Template ${res.row?.kind ?? form.kind} baru berhasil disimpan.`,
      });
      setForm((f) => ({
        ...f,
        id: res.row?.id ?? f.id,
        version_label: res.row?.version_label ?? f.version_label,
        is_active: Number(res.row?.is_active ?? (f.is_active ? 1 : 0)) === 1,
      }));
      void loadRows(true);
    } catch (err) {
      setLastFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal simpan template.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSetActive(r: MasterTemplateRow) {
    if (!session?.token || !isAdminOrSuper) return;
    if (!window.confirm(`Aktifkan template "${r.title}" (${r.kind}) sebagai template aktif? Semua aktif sebelumnya untuk ${r.kind} akan dinonaktifkan otomatis.`)) return;
    try {
      await templateSetActiveRequest(session.token, r.id, r.kind);
      setLastFeedback({ type: "success", text: `Template ${r.kind} aktif di-set ke "${r.title}".` });
      void loadRows(true);
    } catch (err) {
      setLastFeedback({ type: "error", text: err instanceof Error ? err.message : "Gagal aktifkan template." });
    }
  }

  async function handleDelete(r: MasterTemplateRow) {
    if (!session?.token || !isAdminOrSuper) return;
    if (!window.confirm(`Hapus template "${r.title}" (${r.kind}) — TINDAKAN INI TIDAK DAPAT DI BATALKAN. Lanjutkan?`)) return;
    try {
      await templateDeleteRequest(session.token, r.id);
      setLastFeedback({ type: "success", text: `Template "${r.title}" dihapus.` });
      void loadRows(true);
      if (form.id === r.id) setEditorOpen(false);
    } catch (err) {
      setLastFeedback({ type: "error", text: err instanceof Error ? err.message : "Gagal hapus template." });
    }
  }

  const DEMO_SAMPLE_MAP: Record<string, string> = useMemo(() => ({
    nama_sekolah: "SMKS CONTOH NEGERI 1",
    npsn: "20102900",
    alamat_sekolah: "Jl. Pendidikan No. 12, RT 001 RW 005",
    alamat_jalan: "Jl. Pendidikan No. 12, RT 001 / RW 005",
    kecamatan: "Kecamatan Cilandak",
    kab_kota_sekolah: "Kota Administrasi Jakarta Selatan",
    kab_kota: "Kota Administrasi Jakarta Selatan",
    provinsi_sekolah: "DKI Jakarta",
    provinsi: "DKI Jakarta",
    kode_pos_sekolah: "12540",
    kode_pos: "12540",
    tempat_tanggal_buat: "Jakarta",
    kota_pembuatan_surat: "Jakarta",
    kab_kota_ttd: "Jakarta",
    kepala_sekolah_nama: "Dra. Hj. Siti Rahmawati, M.Pd.",
    kepala_sekolah_nip: "196805121990032001",
    kepala_sekolah_hp: "0812 3456 7890",
    wakasek_sarana_nama: "Bpk. Drs. Sutrisno, M.M.",
    wakasek_sarana_hp: "0813 9876 5432",
    bendahara_sekolah_nama: "Ibu Dra. Nurhayati, S.E.",
    bendahara_sekolah_nip: "197206121998122001",
    nama_fasilitator: "Bpk. Aditya Pratama, S.Pd.",
    nip_fasilitator: "198102032010011005",
    nama_fasilitator_adm: "Ibu Desi Permatasari, S.Sos.",
    nip_fasilitator_adm: "198505202010022001",
    nama_fasilitator_alat: "Bpk. Hendri Simanjuntak, S.T.",
    nip_fasilitator_alat: "198312152008011005",
    tanggal_sekarang: new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }),
    tahun_anggaran: String(new Date().getFullYear()),
    tahun_ajaran: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    nama_ppk: "Dr. Rina Kusumawardani, S.Si., M.T.",
    nip_ppk: "197510102005012003",
    nomor_rpd: "001/RPD-SMK/BSKAP/2026",
    nomor_pks: "001/PKS-SMK/DUDI/2026",
    total_anggaran_rp: "Rp 842.500.000,00",
    total_anggaran_terbilang: "Delapan Ratus Empat Puluh Dua Juta Lima Ratus Ribu Rupiah",
    sumber_dana: "DAK Fisik Bidang SMK Tahun Anggaran 2026",
    konsentrasi_keahlian_list:
      "<li>Teknik Kendaraan Ringan Otomotif (TKRO)</li><li>Teknik dan Bisnis Sepeda Motor (TBSM)</li><li>Teknik Komputer dan Jaringan (TKJ)</li>",
    konsentrasi_keahlian_uraian: "Teknik Kendaraan Ringan Otomotif, Teknik Sepeda Motor, dan Teknik Komputer Jaringan.",
    progress_dok_adm_pct: "85",
    dok_adm_sudah_upload: "11",
    dok_adm_total: "13",
    dok_adm_tabel_body_rows: `
      <tr><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">1</td><td style="padding:8px 10px;border:1px solid #0f172a;">Surat Permohonan Bantuan dari Kepala Sekolah</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#059669;font-weight:700;">✅</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#059669;font-weight:700;">SESUAI</td><td style="padding:8px 10px;border:1px solid #0f172a;">Lengkap &amp; sesuai format</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">2</td><td style="padding:8px 10px;border:1px solid #0f172a;">SK Kepala Sekolah + NIP</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#059669;font-weight:700;">✅</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#059669;font-weight:700;">SESUAI</td><td style="padding:8px 10px;border:1px solid #0f172a;">-</td></tr>
      <tr><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">3</td><td style="padding:8px 10px;border:1px solid #0f172a;">Rekap Data Pokok Pendidikan (Dapodik)</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#059669;font-weight:700;">✅</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#059669;font-weight:700;">SESUAI</td><td style="padding:8px 10px;border:1px solid #0f172a;">-</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">4</td><td style="padding:8px 10px;border:1px solid #0f172a;">Proposal Pengajuan Bantuan + Rincian Anggaran</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#059669;font-weight:700;">✅</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#059669;font-weight:700;">SESUAI</td><td style="padding:8px 10px;border:1px solid #0f172a;">-</td></tr>
      <tr><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">5</td><td style="padding:8px 10px;border:1px solid #0f172a;">Akreditasi SMK (Sertifikat BAN-PT)</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#059669;font-weight:700;">✅</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#059669;font-weight:700;">SESUAI</td><td style="padding:8px 10px;border:1px solid #0f172a;">Akreditasi B (Baik)</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">6</td><td style="padding:8px 10px;border:1px solid #0f172a;">PI Bantuan Pemerintah yang Disahkan Dirjen (SK Dirjen)</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#dc2626;font-weight:700;">❌</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#dc2626;font-weight:700;">BELUM</td><td style="padding:8px 10px;border:1px solid #0f172a;">Perlu kirim ulang PI dari CD-2 Pusat</td></tr>
      <tr><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">7</td><td style="padding:8px 10px;border:1px solid #0f172a;">RPD &amp; RAB + Lampiran Harga (3 Toko)</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#059669;font-weight:700;">✅</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;color:#059669;font-weight:700;">SESUAI</td><td style="padding:8px 10px;border:1px solid #0f172a;">-</td></tr>
    `,
    survey_harga_tabel_body_rows: `
      <tr><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">1</td><td style="padding:8px 10px;border:1px solid #0f172a;">Laptop Trainer Pemrograman PLC</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">9</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp10.650.000</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp10.890.000</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp10.545.000</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;font-weight:700;">Rp94.905.000</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">2</td><td style="padding:8px 10px;border:1px solid #0f172a;">PLC Training Set Analog + Digital</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">6</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp67.150.000</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp66.875.000</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp66.203.131</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;font-weight:700;">Rp397.218.786</td></tr>
    `,
    grand_total_survey_rp: "Rp 492.123.786,00",
    rpkp_tabel_body_rows: `
      <tr><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">1</td><td style="padding:8px 10px;border:1px solid #0f172a;">Laptop Trainer Pemrograman PLC (Core i5 Gen 13 / 16 GB)</td><td style="padding:8px 10px;border:1px solid #0f172a;">ASUS ExpertBook B1400</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">UNIT</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">9</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp10.545.000</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp94.905.000</td><td style="padding:8px 10px;border:1px solid #0f172a;">Tinggi</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">2</td><td style="padding:8px 10px;border:1px solid #0f172a;">PLC Training Set Compact + Modul I/O + HMI 7"</td><td style="padding:8px 10px;border:1px solid #0f172a;">Mitsubishi FX5U-32MR + HMI GOT2000</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">SET</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:center;">6</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp66.203.131</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp397.218.786</td><td style="padding:8px 10px;border:1px solid #0f172a;">Tinggi</td></tr>
    `,
    total_rpkp_rp: "Rp 492.123.786,00",
    total_rpkp_terbilang: "Empat Ratus Sembilan Puluh Dua Juta Seratus Dua Puluh Tiga Ribu Tujuh Ratus Delapan Puluh Enam Rupiah",
    rab_kelompok_a_body_rows: `
      <tr><td style="padding:8px 10px;border:1px solid #0f172a;">Biaya Verifikasi Administrasi &amp; Validasi Lapangan (Tim Sekolah)</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp 15.000.000</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 10px;border:1px solid #0f172a;">Biaya Rapat Koordinasi &amp; Penyusunan Proposal &amp; Bimtek Internal</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp 8.000.000</td></tr>
    `,
    rab_subtotal_a_rp: "Rp 23.000.000,00",
    rab_kelompok_b_body_rows: `
      <tr><td style="padding:8px 10px;border:1px solid #0f172a;">RPKP: Pengadaan Laptop Trainer Pemrograman (9 Unit)</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp 94.905.000</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 10px;border:1px solid #0f172a;">RPKP: PLC Training Set Compact + HMI (6 Set)</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp 397.218.786</td></tr>
    `,
    rab_subtotal_b_rp: "Rp 492.123.786,00",
    rab_kelompok_c_body_rows: `
      <tr><td style="padding:8px 10px;border:1px solid #0f172a;">Bimbingan Teknis Guru Produktif + TOT Lab (Offline 2 hari × 30 orang)</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp 40.000.000</td></tr>
      <tr style="background:#f8fafc;"><td style="padding:8px 10px;border:1px solid #0f172a;">Honor Narasumber, Konsumsi, Souvenir, dan Modul Pelatihan</td><td style="padding:8px 10px;border:1px solid #0f172a;text-align:right;font-family:monospace;">Rp 18.000.000</td></tr>
    `,
    rab_subtotal_c_rp: "Rp 58.000.000,00",
    grand_total_rab_rp: "Rp 573.123.786,00",
    grand_total_rab_terbilang: "Lima Ratus Tujuh Puluh Tiga Juta Seratus Dua Puluh Tiga Ribu Tujuh Ratus Delapan Puluh Enam Rupiah",
    tahap1_70_rp: "Rp 401.186.650,00",
    tahap2_30_rp: "Rp 171.937.136,00",
    mitra_nama: "PT. Industri Otomotif Nusantara",
    mitra_alamat: "Jl. Industri Raya Blok A-12 Kawasan MM2100",
    mitra_kota: "Kota Bekasi, Jawa Barat",
    mitra_npwp: "01.234.567.8-912.000",
    mitra_direktur_nama: "Bpk. Hendrawan Susilo, S.E., M.M.",
    mitra_direktur_nik: "3174051709850001",
    masa_berlaku_mulai: "1 September 2026",
    masa_berlaku_selesai: "31 Agustus 2027",
    ruang_lingkup:
      "Pengadaan alat praktik untuk 3 program keahlian, Bimbingan Teknis (Bimtek) guru produktif, dan Praktik Kerja Lapangan (PKL) siswa kelas XI dan XII ke mitra DUDI.",
  }), []);

  const previewHtml = useMemo(() => {
    return resolvePlaceholdersHtml(form.body_html ?? "", DEMO_SAMPLE_MAP);
  }, [form.body_html, DEMO_SAMPLE_MAP]);

  const _filenameSafe = `${form.kind.toLowerCase()}-${(form.version_label || "v1").replace(/[^a-z0-9-]/gi, "")}`;

  const handleCopySource = useCallback(async () => {
    const src = form.body_html ?? "";
    try {
      await navigator.clipboard.writeText(src);
      setLastFeedback({ type: "success", text: `Source HTML (${src.length.toLocaleString("id-ID")} karakter) berhasil di-copy ke clipboard.` });
    } catch {
      const ta = document.createElement("textarea");
      ta.value = src;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
      setLastFeedback({ type: "success", text: "Source HTML di-copy via fallback (clipboard API blocked)." });
    }
  }, [form.body_html]);

  const handleDownloadHtml = useCallback(() => {
    const src = form.body_html ?? "";
    const blob = new Blob([`<!DOCTYPE html>\n<html lang="id">\n<head><meta charset="utf-8"><title>${form.title || "Template"}</title></head>\n<body>\n${src}\n</body>\n</html>`], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-${_filenameSafe}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [form.body_html, form.title, _filenameSafe]);

  const handleUploadHtmlClick = () => htmlUploadRef.current?.click();

  const handleUploadHtmlFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const text = await f.text();
      let src = text;
      const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch && bodyMatch[1]) src = bodyMatch[1];
      if (!window.confirm(`File ${f.name} berhasil dibaca (${src.length.toLocaleString("id-ID")} karakter). Timpa konten editor sekarang?\nOK: timpa\nCancel: batalkan`)) return;
      setForm((prev) => ({ ...prev, body_html: src }));
    } catch (err: any) {
      setLastFeedback({ type: "error", text: "Gagal baca file HTML: " + (err?.message ?? String(err)) });
    } finally {
      if (htmlUploadRef.current) htmlUploadRef.current.value = "";
    }
  }, []);

  const handleInjectSamplePermanent = useCallback(() => {
    const ok = window.confirm(
      "Inject data sample PERMANEN ke source HTML?\nSemua placeholder {{kunci}} di source code akan diganti dengan nilai riil SMKS CONTOH NEGERI 1 (perubahan permanen, tidak bisa di-undo kecuali reset template).\n\nPilih OK: lanjut inject\nPilih Cancel: hanya lihat preview (tab Preview) tanpa rubah source",
    );
    if (!ok) return;
    const nextHtml = resolvePlaceholdersHtml(form.body_html ?? "", DEMO_SAMPLE_MAP);
    if (nextHtml === (form.body_html ?? "")) {
      setLastFeedback({ type: "error", text: "Tidak ada placeholder yang diganti (semua sudah terisi atau placeholder tidak ditemukan di source)." });
      return;
    }
    setForm((prev) => ({ ...prev, body_html: nextHtml }));
    setLastFeedback({ type: "success", text: "Placeholders di-replace PERMANEN dengan sample data SMKS CONTOH NEGERI 1." });
  }, [form.body_html, DEMO_SAMPLE_MAP]);

  const handlePreviewPdf = useCallback(async () => {
    try {
      setPdfGenerating(true);
      setLastFeedback(null);
      const blob = await exportPdfFromHtml(form.body_html ?? "", editorPageSetup, DEMO_SAMPLE_MAP);
      lastPdfBlobRef.current = blob;
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      setEditorMode("pdfPreview");
    } catch (err: any) {
      setLastFeedback({ type: "error", text: "Gagal generate preview PDF: " + (err?.message ?? String(err)) });
    } finally {
      setPdfGenerating(false);
    }
  }, [form.body_html, editorPageSetup, DEMO_SAMPLE_MAP, pdfBlobUrl]);

  const handleExportPdf = useCallback(async () => {
    try {
      setPdfGenerating(true);
      setLastFeedback(null);
      const filename = `template-${_filenameSafe}-${new Date().toISOString().slice(0, 10)}.pdf`;
      const blob = await exportPdfFromHtml(form.body_html ?? "", editorPageSetup, DEMO_SAMPLE_MAP, filename);
      lastPdfBlobRef.current = blob;
    } catch (err: any) {
      setLastFeedback({ type: "error", text: "Gagal export PDF: " + (err?.message ?? String(err)) });
    } finally {
      setPdfGenerating(false);
    }
  }, [form.body_html, editorPageSetup, DEMO_SAMPLE_MAP, _filenameSafe]);

  const handleResetEditor = useCallback(() => {
    const ok = window.confirm("Reset konten editor ke template default " + form.kind + "? Semua perubahan saat ini akan hilang (kecuali sudah disimpan).");
    if (!ok) return;
    setForm((prev) => ({
      ...prev,
      body_html: DEFAULT_HTML_BY_KIND[prev.kind],
      title: DEFAULT_TITLE_BY_KIND[prev.kind] || prev.title,
    }));
    if (pdfBlobUrl) { URL.revokeObjectURL(pdfBlobUrl); setPdfBlobUrl(null); }
    lastPdfBlobRef.current = null;
  }, [form.kind, pdfBlobUrl]);

  const handleLoadTemplateFromDisk = useCallback(async () => {
    if (typeof window === "undefined") return;
    const tab = KIND_TO_TABNO[form.kind];
    try {
      setLastFeedback(null);
      const html = await loadPublicTemplateHtml(tab);
      if (!html.trim()) {
        setLastFeedback({ type: "error", text: `Gagal load template dari /public/templates/${tab}_* (empty). Fallback ke in-memory DEFAULT.` });
        return;
      }
      const ok = window.confirm(
        `Template Tab ${tab} (${form.kind}) berhasil dibaca dari /public/templates (${html.length.toLocaleString("id-ID")} karakter). Timpa konten editor sekarang?\nOK: timpa\nCancel: batal`,
      );
      if (!ok) return;
      setForm((prev) => ({ ...prev, body_html: html }));
      setLastFeedback({ type: "success", text: `Template Tab ${tab} dimuat dari /public/templates (${html.length.toLocaleString("id-ID")} karakter) + CSS inline-otomatis.` });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      setLastFeedback({ type: "error", text: "Gagal load template dari disk: " + msg });
      console.error("[admin-master-template] handleLoadTemplateFromDisk error:", err);
    }
  }, [form.kind]);

  const handleInjectTemplateNo1FromDb = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      setLastFeedback(null);
      if (!token) {
        setLastFeedback({ type: "error", text: "Token auth tidak tersedia (belum login). Silakan login ulang." });
        return;
      }
      const useMe = window.confirm(
        `Generate Template #1 (Identitas) dengan data riil dari database.\n\nPilih OK = Ambil data SEKOLAH LOGIN SAAT INI (school-profile/me — hanya berlaku jika role SEKOLAH).\n\nPilih Cancel = Gunakan sample NPSN ${SAMPLE_NPSN_FOR_TEMPLATE_1} (SMKS MUTIARA — role ADMIN bisa pilih ini).`,
      );
      setLastFeedback({ type: "success", text: `Memuat data Template #1 dari database (${useMe ? "useMe /me" : `NPSN ${SAMPLE_NPSN_FOR_TEMPLATE_1} /by-npsn`}) — harap tunggu…` });
      const result = await generateTemplateNo1Html({
        useMe,
        npsn: useMe ? undefined : SAMPLE_NPSN_FOR_TEMPLATE_1,
        token,
        fallbackTemplateHtml: DEFAULT_HTML_BY_KIND.IDENTITAS,
      });
      const filledCount = Object.keys(result.placeholders).filter((k) => {
        const v = (result.placeholders as Record<string, string | undefined>)[k];
        return typeof v === "string" && v.trim() !== "";
      }).length;
      const namaSkl = result.placeholders.nama_sekolah || "(KOSONG)";
      const npsnSkl = result.placeholders.npsn || "(KOSONG)";
      const kotaSkl = result.placeholders.kab_kota || "(KOSONG)";
      const charCount = result.htmlInjected.length.toLocaleString("id-ID");
      const ok = window.confirm(
        "Template #1 selesai di-generate (source=" + result.templateSource + " — " + charCount + " karakter dengan " + filledCount + " placeholder terisi). Timpa konten editor sekarang?\n\nContoh:\n- nama_sekolah = " + namaSkl + "\n- NPSN = " + npsnSkl + "\n- Kab/Kota = " + kotaSkl + "\n\nOK: timpa ke editor\nCancel: hanya tampilkan di Preview tab tanpa rubah source",
      );
      if (ok) {
        setForm((prev) => ({
          ...prev,
          kind: "IDENTITAS" as Kind,
          title: DEFAULT_TITLE_BY_KIND.IDENTITAS,
          body_html: result.htmlInjected,
        }));
      }
      setEditorMode("preview");
      setLastFeedback({
        type: "success",
        text: "Template #1 berhasil di-generate dari DB (" + namaSkl + " · NPSN " + (npsnSkl) + " · " + filledCount + " field terisi). Tab Preview aktif untuk melihat hasilnya.",
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error("[admin-master-template] handleInjectTemplateNo1FromDb error:", err);
      if (/Not Found|404|tidak ditemukan|NOT_FOUND|npsn/i.test(msg)) {
        setLastFeedback({
          type: "error",
          text: `NPSN ${SAMPLE_NPSN_FOR_TEMPLATE_1} TIDAK ADA di database LOKAL (error 404). Silakan: (a) pilih OK di prompt untuk pakai AKUN SEKOLAH LOGIN SAAT INI, atau (b) masukkan sekolah contoh ke DB lokal terlebih dahulu. Fallback ke sample SMKS CONTOH NEGERI 1 statis. Detail: ${msg}`,
        });
      } else {
        setLastFeedback({ type: "error", text: "Gagal generate Template #1 dari DB: " + msg });
      }
    }
  }, [token]);

  if (!hydrated) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Menyiapkan workspace...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden rounded-[20px] border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-white">
        <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-100/70 bg-indigo-50/60 px-4 py-2.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-indigo-200 bg-white text-indigo-700 shadow-sm">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-800">
                Master Data
              </p>
              <h1 className="text-[15px] font-semibold text-slate-900 md:text-base">
                Template Print (7 Dokumen FA Bimtek Detail: ①→⑦)
              </h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              className="h-7 px-2.5 text-xs gap-1"
              onClick={() => void loadRows(true)}
              disabled={refreshing || loading}
            >
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <RefreshCw className="h-3.5 w-3.5"/>}
              Muat Ulang
            </Button>
            {ALL_KINDS.map((k) => (
              <Button
                key={k}
                type="button"
                variant="outline"
                className={cn(CREATE_BUTTON_CLASS_BY_KIND[k], "h-7 px-2.5 text-xs gap-1")}
                onClick={() => openCreate(k)}
                disabled={!isAdminOrSuper}
                title={`Buat template baru jenis ${KIND_META[k].label}`}
              >
                <Plus className="h-3 w-3"/>
                {KIND_META[k].iconNode}
                <span className="hidden md:inline">{KIND_META[k].label}</span>
                <span className="inline md:hidden">{KIND_META[k].idx}</span>
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {lastFeedback ? (
            <div className={cn(
              "mx-4 mt-3 mb-1 rounded-lg border px-4 py-2.5 text-sm",
              lastFeedback.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-rose-200 bg-rose-50 text-rose-800",
            )}>
              {lastFeedback.text}
            </div>
          ) : null}

          <div className="p-4">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin"/> Memuat daftar template...
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="space-y-3 rounded-[18px] border border-dashed border-slate-300 bg-slate-50/40 p-10 text-center">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-slate-300"/>
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    Belum ada template {activeKind === "ALL" ? "1→7" : KIND_META[activeKind as Kind].label}.
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                    Buat template baru di tombol header untuk mengisi template aktif. Sekolah binaan dan fasilitator di halaman
                    Bimbingan Teknis akan otomatis menggunakan template aktif (is_active=1) untuk Preview &amp; Print di 7 card Tab masing-masing (1→7).
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRows.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "group flex flex-wrap items-start justify-between gap-4 rounded-[18px] border bg-white px-5 py-4 transition",
                      Number(r.is_active) === 1
                        ? "border-indigo-200 shadow-[0_2px_14px_rgba(99,102,241,0.10)]"
                        : "border-slate-200 hover:border-slate-300",
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={cn(
                            "border",
                            KIND_META[r.kind].badgeClass
                          )}
                          variant="outline"
                        >
                          {KIND_META[r.kind].iconNode}
                          {KIND_META[r.kind].label}
                        </Badge>
                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                          {r.version_label}
                        </Badge>
                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                          TA {r.tahun_ajaran}
                        </Badge>
                        {Number(r.is_active) === 1 ? (
                          <Badge className="border border-amber-200 bg-amber-50 text-amber-800">
                            <Star className="mr-1 h-3.5 w-3.5"/> AKTIF
                          </Badge>
                        ) : null}
                      </div>
                      <h3 className="truncate text-base font-semibold text-slate-900">
                        {r.title}
                      </h3>
                      {r.notes ? (
                        <p className="line-clamp-2 text-xs text-slate-600">{r.notes}</p>
                      ) : null}
                      <p className="text-[11px] text-slate-400">
                        ID template: <span className="font-mono">{r.id}</span> · Diperbarui{" "}
                        {new Date(r.updated_at).toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="h-4 w-4"/> Edit
                      </Button>
                      {Number(r.is_active) !== 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          className="bg-amber-600 text-white hover:bg-amber-700"
                          onClick={() => handleSetActive(r)}
                          disabled={!isAdminOrSuper}
                        >
                          <Star className="h-4 w-4"/> Aktifkan
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          disabled
                        >
                          <Star className="h-4 w-4"/> Sudah Aktif
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        onClick={() => handleDelete(r)}
                        disabled={!isAdminOrSuper}
                      >
                        <Trash2 className="h-4 w-4"/> Hapus
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {editorOpen ? (
        <Card className="overflow-hidden rounded-[20px] border border-slate-200">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-slate-200 bg-white text-slate-700 shadow-sm">
                {(() => {
                  if (form.kind === "IDENTITAS") return <Building2 className="h-4 w-4"/>;
                  if (form.kind === "ADMINISTRASI") return <ClipboardCheck className="h-4 w-4"/>;
                  if (form.kind === "SURVEY_HARGA") return <Store className="h-4 w-4"/>;
                  if (form.kind === "RPKP") return <ClipboardList className="h-4 w-4"/>;
                  if (form.kind === "RAB") return <Calculator className="h-4 w-4"/>;
                  if (form.kind === "RPD") return <FileText className="h-4 w-4"/>;
                  return <FileSignature className="h-4 w-4"/>;
                })()}
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Editor {KIND_META[form.kind].label}
                </p>
                <h2 className="text-[15px] font-semibold text-slate-900">
                  {form.id ? "Ubah Template" : "Buat Template Baru"}
                </h2>
              </div>
              <Badge variant="outline" className={cn(
                "border text-xs",
                KIND_META[form.kind].badgeClass
              )}>
                {KIND_META[form.kind].iconNode}
                {form.kind}
              </Badge>
              {form.is_active ? (
                <Badge className="border border-amber-200 bg-amber-50 text-amber-800 text-xs">
                  <Star className="mr-1 h-3 w-3"/> AKTIF
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1 border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
                onClick={handleResetEditor}
              >
                <Sparkles className="h-3.5 w-3.5"/> Reset ke Default
              </Button>
              <Button
                type="button"
                className="h-7 px-2.5 text-xs gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleSave}
                disabled={saving || !isAdminOrSuper}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : <Save className="h-3.5 w-3.5"/>}
                Simpan
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-7 px-2.5 text-xs gap-1"
                onClick={() => {
                  if (!window.confirm("Tutup editor? Perubahan yang belum disimpan akan hilang.")) return;
                  setEditorOpen(false);
                }}
              >
                <X className="h-3.5 w-3.5"/> Tutup
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="space-y-1 md:col-span-5">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Judul Template
                </label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Contoh: Template RPD DAK Fisik Bidang SMK 2026"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Versi
                </label>
                <Input
                  value={form.version_label}
                  onChange={(e) => setForm((f) => ({ ...f, version_label: e.target.value }))}
                  placeholder="v1.0"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Tahun Ajaran
                </label>
                <Input
                  value={form.tahun_ajaran}
                  onChange={(e) => setForm((f) => ({ ...f, tahun_ajaran: e.target.value }))}
                  placeholder="2026/2027"
                />
              </div>
              <div className="space-y-1 md:col-span-3">
                <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 invisible md:visible">
                  Opsional
                </label>
                <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  />
                  <span className="text-slate-700">
                    Setelan <b>is_active = 1</b> simpan
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Catatan / Deskripsi Template (opsional)
              </label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Misal: Digunakan untuk SMK mitra PT. Industri Otomotif Nusantara"
              />
            </div>

            <div className="rounded-[18px] border border-slate-200 bg-slate-50/40 p-3 md:p-4 space-y-3">
              <input
                ref={htmlUploadRef}
                type="file"
                accept=".html,.htm,.docx"
                className="hidden"
                onChange={handleUploadHtmlFile}
              />

              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-1.5 rounded-[12px] border border-slate-200 bg-white p-1 shadow-sm">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editorMode === "monaco"}
                    onClick={() => setEditorMode("monaco")}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-[11.5px] font-semibold transition-all",
                      editorMode === "monaco"
                        ? "bg-indigo-600 text-white shadow-inner"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    Monaco
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editorMode === "grapesjs"}
                    onClick={() => setEditorMode("grapesjs")}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-[11.5px] font-semibold transition-all",
                      editorMode === "grapesjs"
                        ? "bg-violet-600 text-white shadow-inner"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    Visual
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editorMode === "preview"}
                    onClick={() => setEditorMode("preview")}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-[11.5px] font-semibold transition-all",
                      editorMode === "preview"
                        ? "bg-emerald-600 text-white shadow-inner"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={editorMode === "pdfPreview"}
                    onClick={() => handlePreviewPdf()}
                    disabled={pdfGenerating}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-7 px-3 rounded-[8px] text-[11.5px] font-semibold transition-all disabled:opacity-60 disabled:cursor-wait",
                      editorMode === "pdfPreview"
                        ? "bg-rose-600 text-white shadow-inner"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    )}
                  >
                    {pdfGenerating ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5" />
                    )}
                    {pdfGenerating ? "Generate…" : "PDF"}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  {editorMode === "monaco" && (
                    <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-800">
                      <Code2 className="mr-1 h-3 w-3" /> POWER USER · VS Code-like
                    </Badge>
                  )}
                  {editorMode === "grapesjs" && (
                    <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-800">
                      <LayoutDashboard className="mr-1 h-3 w-3" /> DRAG-DROP VISUAL
                    </Badge>
                  )}
                  {editorMode === "preview" && (
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                      <Eye className="mr-1 h-3 w-3" /> PREVIEW + SAMPLE DATA
                    </Badge>
                  )}
                  {editorMode === "pdfPreview" && (
                    <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-800">
                      <FileDown className="mr-1 h-3 w-3" /> PREVIEW PDF A4
                    </Badge>
                  )}
                  <Badge variant="outline" className="border-slate-200 bg-white text-slate-600 font-mono">
                    {(form.body_html?.length ?? 0).toLocaleString("id-ID")} chars
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 rounded-[14px] border border-slate-200 bg-white/70 px-2 py-1.5 shadow-sm">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] gap-1 border-slate-200 bg-white hover:bg-slate-50"
                  onClick={handleCopySource}
                  title="Copy seluruh source code HTML ke clipboard"
                >
                  <ClipboardCopy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] gap-1 border-slate-200 bg-white hover:bg-slate-50"
                  onClick={handleDownloadHtml}
                  title="Download source sebagai template-.html"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">.html</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] gap-1 border-slate-200 bg-white hover:bg-slate-50"
                  onClick={handleUploadHtmlClick}
                  title="Upload file .html / .docx untuk replace konten"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Upload</span>
                </Button>
                <div className="w-px h-5 bg-slate-200 mx-0.5" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] gap-1 border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900"
                  onClick={handleInjectSamplePermanent}
                  title="Replace {{kunci}} PERMANEN dengan sample SMKS CONTOH NEGERI 1 di source code"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Inject Sample</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] gap-1 border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-900"
                  onClick={handleResetEditor}
                  title="Reset konten ke template default per-KIND"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] gap-1 border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-900"
                  onClick={handleLoadTemplateFromDisk}
                  title="Muat template dari /public/templates/... sesuai Tab yang aktif (mirror file HTML di disk Pinegrow / Monaco)"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Muat dr Disk</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-7 px-2.5 text-[11px] gap-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  onClick={handleInjectTemplateNo1FromDb}
                  title="⚡ Generate Template #1 Identitas dengan DATA RIIL SEKOLAH dari database (bukan sample statis). Pilihan: sekolah login saat ini / NPSN 10100617."
                >
                  <DatabaseZap className="h-3.5 w-3.5" />
                  <span>Gen #1 dari DB</span>
                </Button>
                <div className="w-px h-5 bg-slate-200 mx-0.5" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] gap-1 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900"
                  onClick={handlePreviewPdf}
                  disabled={pdfGenerating}
                  title="Generate PDF + buka Tab Preview (A4 210×297 mm)"
                >
                  {pdfGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <File className="h-3.5 w-3.5" />}
                  <span>{pdfGenerating ? "Render PDF…" : "Preview PDF"}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="h-7 px-2.5 text-[11px] gap-1 bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                  onClick={handleExportPdf}
                  disabled={pdfGenerating}
                  title="⬇ Export langsung ke file PDF (download)"
                >
                  {pdfGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                  <span>Export PDF</span>
                </Button>
                <div className="ml-auto flex items-center gap-1.5 pr-1">
                  <span className="text-[10.5px] uppercase tracking-[0.16em] text-slate-400 font-semibold hidden xl:inline">
                    {form.kind} · {form.version_label}
                  </span>
                </div>
              </div>

              {editorMode === "monaco" && (
                <MonacoRpdEditor
                  value={form.body_html}
                  onChange={(next) => setForm((f) => ({ ...f, body_html: next }))}
                  defaultTemplateHtml={DEFAULT_HTML_BY_KIND[form.kind]}
                  placeholder="Tulis template RPD/PKS disini. Gunakan placeholder {{nama_sekolah}}, {{npsn}}, dll. untuk diisi otomatis per sekolah. ATAU klik Ribbon ➕ Sisipkan → Muat Template (struktur tabel + heading SIAP PAKAI)."
                  minHeight="720px"
                  pageSetup={editorPageSetup}
                  onPageSetupChange={setEditorPageSetup}
                  showDocxIoButtons={true}
                />
              )}

              {editorMode === "grapesjs" && (
                <GrapesJsRpdEditor
                  value={form.body_html}
                  onChange={(next) => setForm((f) => ({ ...f, body_html: next }))}
                  defaultTemplateHtml={DEFAULT_HTML_BY_KIND[form.kind]}
                  placeholder="Tulis template RPD/PKS disini. Gunakan placeholder {{nama_sekolah}}, {{npsn}}, dll. untuk diisi otomatis per sekolah. ATAU klik Ribbon ➕ Sisipkan → Muat Template (struktur tabel + heading SIAP PAKAI)."
                  minHeight="720px"
                  pageSetup={editorPageSetup}
                  onPageSetupChange={setEditorPageSetup}
                  showDocxIoButtons={true}
                />
              )}

              {editorMode === "preview" && (
                <div className="rounded-[14px] border border-slate-200 bg-slate-100/60 p-3 sm:p-6 overflow-auto">
                  <div
                    className={cn(
                      "rounded-[14px] border border-slate-200 bg-white p-5 md:p-8 overflow-auto prose prose-slate max-w-none mx-auto shadow-sm",
                      "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:font-serif [&_h2]:text-xl [&_h2]:font-bold [&_h2]:font-serif [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:font-serif",
                      "[&_table]:border-collapse [&_table]:w-full [&_th]:border [&_th]:border-slate-400 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-slate-400 [&_td]:px-3 [&_td]:py-2",
                      "[&_p]:my-2 [&_p]:font-serif [&_p]:text-[13.5px]",
                    )}
                    style={{
                      minHeight: "640px",
                      width: "210mm",
                      maxWidth: "100%",
                      fontFamily: "'Times New Roman', Times, serif",
                    }}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                </div>
              )}

              {editorMode === "pdfPreview" && (
                <div className="rounded-[14px] border border-slate-200 bg-slate-900/[0.03] p-3 sm:p-4 space-y-3">
                  {!pdfBlobUrl && !pdfGenerating && (
                    <div className="w-full flex flex-col items-center justify-center rounded-[14px] border border-dashed border-slate-300 bg-white p-16 text-center">
                      <AlertTriangle className="h-10 w-10 mb-3 text-amber-500" />
                      <p className="text-sm font-semibold text-slate-700 mb-1">
                        Belum ada PDF yang digenerate
                      </p>
                      <p className="text-[11.5px] text-slate-500 mb-4 max-w-md">
                        Klik tombol <strong>Preview PDF</strong> atau <strong>Export PDF</strong> di toolbar di atas untuk merender HTML template ke file PDF A4.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[11.5px]"
                          onClick={handlePreviewPdf}
                        >
                          <File className="h-3.5 w-3.5 mr-1.5" />
                          Generate Preview PDF
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 bg-rose-600 hover:bg-rose-700 text-white text-[11.5px]"
                          onClick={handleExportPdf}
                        >
                          <FileDown className="h-3.5 w-3.5 mr-1.5" />
                          Langsung Download
                        </Button>
                      </div>
                    </div>
                  )}
                  {pdfBlobUrl && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 shadow-sm">
                        <div className="flex items-center gap-2 text-[11.5px] text-slate-600">
                          <Badge variant="outline" className="border-rose-200 bg-rose-50 text-rose-800 font-mono">
                            A4 · 210×297 mm
                          </Badge>
                          <span className="font-mono">
                            {lastPdfBlobRef.current
                              ? `${(lastPdfBlobRef.current.size / 1024).toFixed(1)} KB`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-[11px] gap-1 border-slate-200 bg-white hover:bg-slate-50"
                            onClick={handlePreviewPdf}
                            disabled={pdfGenerating}
                          >
                            {pdfGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
                            Re-generate
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="h-7 px-2.5 text-[11px] gap-1 bg-slate-900 hover:bg-slate-800 text-white"
                            onClick={() => {
                              if (!lastPdfBlobRef.current) return;
                              const url = URL.createObjectURL(lastPdfBlobRef.current);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `template-${_filenameSafe}-${new Date().toISOString().slice(0, 10)}.pdf`;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                              setTimeout(() => URL.revokeObjectURL(url), 1000);
                            }}
                            disabled={!lastPdfBlobRef.current}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </Button>
                        </div>
                      </div>
                      <div className="rounded-[14px] overflow-hidden border border-slate-200 bg-slate-900 shadow-inner">
                        <iframe
                          src={pdfBlobUrl}
                          title="PDF Preview Template RPD PKS"
                          width="100%"
                          height="960px"
                          className="block w-full bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <details className="group rounded-[18px] border border-slate-200 bg-white">
              <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700">
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600"/>
                  Daftar Placeholder {"{{kunci}}"} yang Didukung
                </span>
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-500 text-[11px]">
                  {RPD_PKS_PLACEHOLDER_CHEATSHEET.length} kunci
                </Badge>
              </summary>
              <div className="border-t border-slate-100 px-4 py-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                  {RPD_PKS_PLACEHOLDER_CHEATSHEET.map((p) => (
                    <div
                      key={p.key}
                      className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2"
                    >
                      <code className="block text-[12px] font-mono text-indigo-700">
                        {`{{${p.key}}}`}
                      </code>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-700">{p.label}</p>
                      <p className="text-[11px] text-slate-500">Contoh: {p.contoh}</p>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
