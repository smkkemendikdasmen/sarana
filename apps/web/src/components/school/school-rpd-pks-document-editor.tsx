"use client";

import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Calculator,
  Eye,
  FileSignature,
  FileText,
  Loader2,
  MessageSquare,
  Printer,
  Save,
  ShieldCheck,
  Star,
  Store,
  Wand2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RichTextEditor, resolvePlaceholdersHtml, type PageSetup } from "@/components/shared/rich-text-editor";
import { TipTapRpdEditor } from "@/components/shared/grapesjs-rpd-editor";
import {
  buildPlaceholderMapFromProfile,
  DEFAULT_PKS_TEMPLATE_HTML,
  DEFAULT_RPD_TEMPLATE_HTML,
  DEFAULT_IDENTITAS_TEMPLATE_HTML,
  DEFAULT_ADMINISTRASI_TEMPLATE_HTML,
  DEFAULT_SURVEY_HARGA_TEMPLATE_HTML,
  DEFAULT_RPKP_TEMPLATE_HTML,
  DEFAULT_RAB_TEMPLATE_HTML,
  RPD_PKS_PLACEHOLDER_CHEATSHEET,
} from "@/lib/rpd-pks-default-templates";
import {
  schoolInstanceGetRequest,
  schoolInstanceUpsertRequest,
  templateActiveRequest,
  type PrintTemplateKind,
  type SchoolInstanceRow,
  type SchoolProfileRecord,
} from "@/lib/api";
import { cn, angkaTerbilang } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type Kind = PrintTemplateKind;
type ModuleContext = "pra-bimtek" | "bimbingan-teknis";
type ReviewStatus = SchoolInstanceRow["review_status"];

const ALL_KINDS: readonly Kind[] = ["IDENTITAS", "ADMINISTRASI", "SURVEY_HARGA", "RPKP", "RAB", "RPD", "PKS"] as const;

const DEFAULT_HTML_BY_KIND: Record<Kind, string> = {
  IDENTITAS: DEFAULT_IDENTITAS_TEMPLATE_HTML,
  ADMINISTRASI: DEFAULT_ADMINISTRASI_TEMPLATE_HTML,
  SURVEY_HARGA: DEFAULT_SURVEY_HARGA_TEMPLATE_HTML,
  RPKP: DEFAULT_RPKP_TEMPLATE_HTML,
  RAB: DEFAULT_RAB_TEMPLATE_HTML,
  RPD: DEFAULT_RPD_TEMPLATE_HTML,
  PKS: DEFAULT_PKS_TEMPLATE_HTML,
};

const KINDS: { key: Kind; no: string; label: string; icon: typeof FileText; color: string; badgeClass: string }[] = [
  { key: "IDENTITAS", no: "①", label: "Data Sekolah (Identitas)", icon: Building2, color: "slate", badgeClass: "border-slate-200 bg-slate-50 text-slate-800" },
  { key: "ADMINISTRASI", no: "②", label: "Ceklis Administrasi", icon: ClipboardCheck, color: "sky", badgeClass: "border-sky-200 bg-sky-50 text-sky-800" },
  { key: "SURVEY_HARGA", no: "③", label: "Survey Harga Pasar", icon: Store, color: "amber", badgeClass: "border-amber-200 bg-amber-50 text-amber-800" },
  { key: "RPKP", no: "④", label: "RPKP", icon: ClipboardList, color: "indigo", badgeClass: "border-indigo-200 bg-indigo-50 text-indigo-800" },
  { key: "RAB", no: "⑤", label: "RAB", icon: Calculator, color: "emerald", badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  { key: "RPD", no: "⑥", label: "Rencana Penggunaan Dana (RPD)", icon: FileText, color: "rose", badgeClass: "border-rose-200 bg-rose-50 text-rose-800" },
  { key: "PKS", no: "⑦", label: "Perjanjian Kerja Sama (PKS)", icon: FileSignature, color: "violet", badgeClass: "border-violet-200 bg-violet-50 text-violet-800" },
];

const STATUS_STYLE: Record<ReviewStatus, { cls: string; label: string; icon: typeof Star }> = {
  DRAFT: { cls: "border-slate-300 bg-slate-50 text-slate-700", label: "DRAFT", icon: Star },
  REVIEWED: { cls: "border-sky-200 bg-sky-50 text-sky-800", label: "DI TINJAU", icon: Eye },
  APPROVED: { cls: "border-emerald-200 bg-emerald-50 text-emerald-800", label: "DISETUJUI", icon: CheckCircle2 },
  REJECTED: { cls: "border-rose-200 bg-rose-50 text-rose-800", label: "DITOLAK", icon: XCircle },
};

interface SchoolRpdPksDocumentEditorProps {
  npsn: string;
  profile: SchoolProfileRecord | null;
  moduleContext: ModuleContext;
  activeTabKind: Kind;
  onSwitchKind?: (next: Kind) => void;
  tabPrintIdMap?: Partial<Record<Kind, string>>;
  onPreviewPrint?: (printId: string) => void;
  compactHeader?: boolean;
  totalAnggaranRpNumber?: number | null;
  ppkName?: string | null;
  ppkNip?: string | null;
  fasilitatorName?: string | null;
  fasilitatorNipNik?: string | null;
  allowedKinds?: readonly Kind[];
  initialPreviewMode?: boolean;
  /** Jika true → pakai TipTap editor (Word-like). Default false = RichTextEditor lama. */
  useTipTap?: boolean;
}

function buildEmptyKindRecord<T extends Kind, V>(kinds: readonly T[], def: V): Record<T, V> {
  const rec = {} as Record<T, V>;
  for (const k of kinds) rec[k] = def;
  return rec;
}

export function SchoolRpdPksDocumentEditor({
  npsn,
  profile,
  moduleContext,
  activeTabKind,
  onSwitchKind,
  tabPrintIdMap,
  onPreviewPrint,
  compactHeader = false,
  totalAnggaranRpNumber,
  ppkName,
  ppkNip,
  fasilitatorName,
  fasilitatorNipNik,
  allowedKinds = ALL_KINDS,
  initialPreviewMode = false,
  useTipTap = false,
}: SchoolRpdPksDocumentEditorProps) {
  const { session, hydrated } = useAuthStore();
  const token = session?.token ?? "";
  const userRole = String(session?.user?.role ?? "").toUpperCase();
  const isApproverRole =
    userRole === "ADMIN" || userRole === "SUPERADMIN" || userRole === "FASILITATOR_ALAT" || userRole === "FASILITATOR_ADMINISTRASI";
  const readOnlyMode = !isApproverRole;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  const [instances, setInstances] = useState<Record<Kind, SchoolInstanceRow | null>>(() =>
    buildEmptyKindRecord(allowedKinds, null as SchoolInstanceRow | null) as Record<Kind, SchoolInstanceRow | null>,
  );
  const [bodyHtmlByKind, setBodyHtmlByKind] = useState<Record<Kind, string>>(() =>
    buildEmptyKindRecord(allowedKinds, "") as Record<Kind, string>,
  );
  const [reviewNotesByKind, setReviewNotesByKind] = useState<Record<Kind, string>>(() =>
    buildEmptyKindRecord(allowedKinds, "") as Record<Kind, string>,
  );
  const [reviewStatusByKind, setReviewStatusByKind] = useState<Record<Kind, ReviewStatus>>(() =>
    buildEmptyKindRecord(allowedKinds, "DRAFT" as ReviewStatus) as Record<Kind, ReviewStatus>,
  );
  const [previewMode, setPreviewMode] = useState<Record<Kind, boolean>>(() =>
    buildEmptyKindRecord(allowedKinds, initialPreviewMode as boolean) as Record<Kind, boolean>,
  );
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editorPageSetup, setEditorPageSetup] = useState<PageSetup>({ preset: "default" });
  const printWrapRef = useRef<HTMLDivElement | null>(null);

  const placeholderMap = useMemo<Record<string, string>>(() => {
    const base = buildPlaceholderMapFromProfile(profile ?? ({} as SchoolProfileRecord), {
      totalAnggaranRpNumber: totalAnggaranRpNumber ?? null,
      ppkName: ppkName ?? null,
      ppkNip: ppkNip ?? null,
      fasilitatorName: fasilitatorName ?? session?.user?.fullName ?? null,
      fasilitatorNipNik: fasilitatorNipNik ?? null,
    });
    const extras: Record<string, string> = { ...base } as Record<string, string>;
    if (!extras["total_anggaran_terbilang"] && Number(totalAnggaranRpNumber ?? 0) > 0) {
      extras["total_anggaran_terbilang"] = `${angkaTerbilang(Math.round(Number(totalAnggaranRpNumber) || 0)).trim()} Rupiah`;
    }
    return extras;
  }, [profile, session?.user?.fullName, totalAnggaranRpNumber, ppkName, ppkNip, fasilitatorName, fasilitatorNipNik]);

  const currentPreviewHtml = useMemo(() => {
    return resolvePlaceholdersHtml(bodyHtmlByKind[activeTabKind] ?? "", placeholderMap);
  }, [bodyHtmlByKind, activeTabKind, placeholderMap]);

  async function loadKind(kind: Kind, silent = false) {
    if (!hydrated || !token) return;
    if (!silent) setLoading(true);
    try {
      const [instRes, tmplRes] = await Promise.allSettled([
        schoolInstanceGetRequest(token, {
          schoolNpsn: npsn,
          moduleContext,
          kind,
        }),
        templateActiveRequest(token, kind),
      ]);
      const inst = instRes.status === "fulfilled" ? instRes.value.row : null;
      if (inst) {
        setInstances((s) => ({ ...s, [kind]: inst }));
        setBodyHtmlByKind((s) => ({ ...s, [kind]: inst.body_html ?? "" }));
        setReviewNotesByKind((s) => ({ ...s, [kind]: inst.review_notes ?? "" }));
        setReviewStatusByKind((s) => ({ ...s, [kind]: inst.review_status ?? "DRAFT" }));
      } else {
        let tplHtml = "";
        if (tmplRes.status === "fulfilled" && tmplRes.value.row) {
          tplHtml = tmplRes.value.row.body_html ?? "";
        }
        if (!tplHtml) {
          tplHtml = DEFAULT_HTML_BY_KIND[kind] ?? "";
        }
        setBodyHtmlByKind((s) => ({ ...s, [kind]: tplHtml }));
        setReviewStatusByKind((s) => ({ ...s, [kind]: "DRAFT" }));
      }
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : `Gagal memuat dokumen ${kind}.`,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadKind(activeTabKind);
  }, [hydrated, token, npsn, moduleContext, activeTabKind]);

  async function reloadTemplateFromMaster(kind: Kind) {
    const kindDef = KINDS.find((k) => k.key === kind);
    if (!window.confirm(`Muat ulang template ${kindDef?.label ?? kind} dari MASTER template aktif? Semua perubahan instance yang BELUM disimpan untuk sekolah ini akan hilang.`)) return;
    setTemplateLoading(true);
    try {
      let html = "";
      if (token) {
        try {
          const r = await templateActiveRequest(token, kind);
          html = r.row?.body_html ?? "";
        } catch { /* fallthrough default */ }
      }
      if (!html) html = DEFAULT_HTML_BY_KIND[kind] ?? "";
      setBodyHtmlByKind((s) => ({ ...s, [kind]: html }));
      setFeedback({ type: "success", text: `Template ${kindDef?.label ?? kind} di-reset dari template master aktif.` });
    } finally {
      setTemplateLoading(false);
    }
  }

  async function handleSave(nextStatus?: ReviewStatus) {
    if (!token) return;
    const kind = activeTabKind;
    setSaving(true);
    setFeedback(null);
    try {
      const finalStatus: ReviewStatus = nextStatus ?? reviewStatusByKind[kind];
      if (!profile?.schoolName && !instances[kind]?.school_name) {
        // ignore
      }
      const res = await schoolInstanceUpsertRequest(token, {
        id: instances[kind]?.id,
        school_npsn: npsn,
        school_name: profile?.schoolName ?? instances[kind]?.school_name ?? "",
        module_context: moduleContext,
        kind,
        template_id: instances[kind]?.template_id ?? null,
        body_html: bodyHtmlByKind[kind] ?? "",
        review_notes: reviewNotesByKind[kind]?.trim() || null,
        review_status: finalStatus,
      });
      if (res.row) {
        setInstances((s) => ({ ...s, [kind]: res.row }));
        setReviewStatusByKind((s) => ({ ...s, [kind]: res.row?.review_status ?? s[kind] }));
      }
      setFeedback({
        type: "success",
        text:
          finalStatus === "APPROVED"
            ? `Dokumen ${kind} BERHASIL DISIMPAN & DISETUJUI (${res.row?.review_status ?? finalStatus}).`
            : finalStatus === "REJECTED"
              ? `Dokumen ${kind} disimpan & status DITOLAK.`
              : finalStatus === "REVIEWED"
                ? `Dokumen ${kind} disimpan & status DITANDAI TELAH DI TINJAU.`
                : `Dokumen ${kind} tersimpan (status DRAFT).`,
      });
      void loadKind(kind, true);
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : `Gagal simpan ${kind}.`,
      });
    } finally {
      setSaving(false);
    }
  }

  const statusDef = STATUS_STYLE[reviewStatusByKind[activeTabKind]];
  const kindDef = KINDS.find((k) => k.key === activeTabKind) ?? KINDS[0]!;
  const Icon = kindDef.icon;
  const printId = tabPrintIdMap?.[activeTabKind] ?? `print-${activeTabKind.toLowerCase()}`;

  const ACTIVE_COLOR_BG: Record<string, string> = {
    slate: "bg-slate-700 hover:bg-slate-800",
    sky: "bg-sky-600 hover:bg-sky-700",
    amber: "bg-amber-600 hover:bg-amber-700",
    indigo: "bg-indigo-700 hover:bg-indigo-800",
    emerald: "bg-emerald-600 hover:bg-emerald-700",
    rose: "bg-rose-600 hover:bg-rose-700",
    violet: "bg-violet-700 hover:bg-violet-800",
  };

  return (
    <div className="space-y-4">
      {!compactHeader ? (
        <Card className="overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-5 py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className={cn(
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border shadow-sm",
                kindDef.badgeClass,
              )}>
                <Icon className="h-5 w-5"/>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Tab {kindDef.no} · {moduleContext === "pra-bimtek" ? "Pra-Bimtek" : "Bimbingan Teknis"}
                </p>
                <CardTitle className="text-lg md:text-xl text-slate-900">
                  {kindDef.label}
                </CardTitle>
              </div>
              {onSwitchKind ? (
                <div className="flex flex-wrap gap-1.5">
                  {KINDS.filter((k) => allowedKinds.includes(k.key)).map((k) => {
                    const st = STATUS_STYLE[reviewStatusByKind[k.key] ?? "DRAFT"];
                    const StIcon = st.icon;
                    return (
                      <Button
                        key={k.key}
                        type="button"
                        variant={activeTabKind === k.key ? "default" : "outline"}
                        size="sm"
                        onClick={() => onSwitchKind(k.key)}
                        className={cn(
                          "gap-1.5",
                          activeTabKind === k.key ? ACTIVE_COLOR_BG[k.color] : k.badgeClass,
                        )}
                      >
                        <k.icon className="h-4 w-4"/> {k.key}
                        <Badge variant="outline" className={cn("border ml-1 text-[10px] h-5", st.cls)}>
                          <StIcon className="h-3 w-3 mr-0.5"/> {st.label}
                        </Badge>
                      </Button>
                    );
                  })}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("border px-2.5 py-1 text-[11px]", statusDef.cls)}>
                <statusDef.icon className="mr-1 h-3.5 w-3.5"/> {statusDef.label}
              </Badge>
              {readOnlyMode ? (
                <Badge variant="outline" className="border-sky-200 bg-sky-50 text-sky-800 px-2.5 py-1 text-[11px]">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5"/> Mode Tinjau / Sekolah (Read Only)
                </Badge>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewMode((s) => ({ ...s, [activeTabKind]: !s[activeTabKind] }))}
              >
                {previewMode[activeTabKind] ? <ChevronLeft className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                {previewMode[activeTabKind] ? " Kembali Edit" : " Preview & Cetak"}
              </Button>
              {onPreviewPrint ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onPreviewPrint(printId)}
                >
                  <Printer className="h-4 w-4"/> Cetak
                </Button>
              ) : null}
              {!readOnlyMode ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
                    onClick={() => reloadTemplateFromMaster(activeTabKind)}
                    disabled={templateLoading || saving}
                  >
                    {templateLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <Wand2 className="h-4 w-4"/>}
                    Muat Ulang Template Master
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => handleSave()}
                    disabled={saving || loading}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}
                    Simpan Draf
                  </Button>
                  {isApproverRole ? (
                    <div className="flex gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                        onClick={() => handleSave("REVIEWED")}
                        disabled={saving || loading}
                      >
                        <Eye className="h-4 w-4"/> Tandai Sudah Ditinjau
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        onClick={() => handleSave("REJECTED")}
                        disabled={saving || loading}
                      >
                        <XCircle className="h-4 w-4"/> Tolak
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="bg-emerald-700 text-white hover:bg-emerald-800"
                        onClick={() => handleSave("APPROVED")}
                        disabled={saving || loading}
                      >
                        <Check className="h-4 w-4"/> <ShieldCheck className="h-4 w-4"/> Setujui
                      </Button>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-[12px] text-slate-600">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                  Sekolah
                </Badge>
                <span className="font-semibold text-slate-800">
                  {profile?.schoolName ?? instances[activeTabKind]?.school_name ?? "[Nama sekolah belum termuat]"}
                </span>
                <span className="text-slate-400">·</span>
                <span>NPSN <span className="font-mono font-semibold text-slate-800">{npsn}</span></span>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {feedback ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-3 py-1 text-[11px]",
                      feedback.type === "success"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-rose-200 bg-rose-50 text-rose-800",
                    )}
                  >
                    {feedback.text}
                  </Badge>
                ) : null}
                {loading ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin"/> Memuat dokumen {activeTabKind} sekolah...
                  </span>
                ) : null}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {previewMode[activeTabKind] || readOnlyMode ? (
        <div id={printId} ref={printWrapRef} className="print-a4-portrait">
          <Card className="rounded-[20px] border border-slate-200 print:border-none print:shadow-none">
            <CardContent className={cn(
              "p-5 md:p-8 print:!p-4 overflow-auto [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold",
              "[&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:leading-7",
              "[&_table]:border-collapse [&_table]:w-full [&_th]:border [&_th]:border-slate-300 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-slate-300 [&_td]:px-3 [&_td]:py-2",
              "[&_a]:text-indigo-700 [&_a]:underline",
            )}
            style={{ minHeight: "720px" }}
            >
              {!readOnlyMode && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] text-slate-600 print:hidden">
                  <div>
                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                      PREVIEW
                    </Badge>
                    <span className="ml-2">
                      Placeholder di bawah ini sudah di-resolve berdasarkan profil sekolah.
                    </span>
                  </div>
                  {onPreviewPrint ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onPreviewPrint(printId)}
                    >
                      <Printer className="h-4 w-4"/> Cetak Preview
                    </Button>
                  ) : null}
                </div>
              )}
              <div dangerouslySetInnerHTML={{ __html: currentPreviewHtml }} />
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-3">
          <TipTapRpdEditor
            value={bodyHtmlByKind[activeTabKind] ?? ""}
            onChange={(next) => setBodyHtmlByKind((s) => ({ ...s, [activeTabKind]: next }))}
            defaultTemplateHtml={DEFAULT_HTML_BY_KIND[activeTabKind]}
            replaceFieldMap={placeholderMap}
            placeholder={
              loading
                ? "Memuat dokumen RPD/PKS sekolah..."
                : `Isi dokumen ${activeTabKind}. Gunakan placeholder {{nama_sekolah}}, {{npsn}}, dsb. Akan diisi otomatis saat preview & cetak. ATAU klik Ribbon ➕ Sisipkan → Muat Template / Isi Placeholder.`
            }
            minHeight="720px"
            disabled={readOnlyMode || loading}
            pageSetup={editorPageSetup}
            onPageSetupChange={setEditorPageSetup}
            showDocxIoButtons={true}
          />
          {isApproverRole ? (
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5"/>
                Catatan Review (Fasilitator / Admin)
              </label>
              <Input
                value={reviewNotesByKind[activeTabKind] ?? ""}
                onChange={(e) => setReviewNotesByKind((s) => ({ ...s, [activeTabKind]: e.target.value }))}
                placeholder="Contoh: Nomor surat perlu diisi kembali. Nilai anggaran total menyesuaikan RAB final."
              />
            </div>
          ) : null}

          <details className="group rounded-[18px] border border-slate-200 bg-white">
            <summary className="flex cursor-pointer select-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-700">
              <span>
                <Wand2 className="inline h-4 w-4 mr-1.5 text-indigo-600"/>
                Daftar Placeholder {"{{kunci}}"} untuk {activeTabKind} ini
              </span>
              <Badge variant="outline" className="border-slate-200 bg-white text-slate-500 text-[11px]">
                {RPD_PKS_PLACEHOLDER_CHEATSHEET.length} kunci
              </Badge>
            </summary>
            <div className="border-t border-slate-100 px-4 py-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                {RPD_PKS_PLACEHOLDER_CHEATSHEET.map((p) => {
                  const val = placeholderMap[p.key];
                  return (
                    <div
                      key={p.key}
                      className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2"
                    >
                      <code className="block text-[12px] font-mono text-indigo-700">
                        {`{{${p.key}}}`}
                      </code>
                      <p className="mt-0.5 text-[11px] font-semibold text-slate-700">{p.label}</p>
                      <p className="text-[11px] text-slate-500">
                        Contoh: <span className="font-mono">{val || p.contoh}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
