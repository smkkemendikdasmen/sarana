"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  FileDown,
  FileText,
  Loader2,
  RefreshCw,
  Share2,
  Sparkles,
  TriangleAlert,
  Wand2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  googleDriveConfigStatusRequest,
  googleDriveCreateRpdPksRequest,
  googleDriveLinkExistingDocRequest,
  googleDriveRpdPksBySchoolRequest,
  googleDriveRpdPksExportUrl,
  googleDriveSharePublicRequest,
  type GoogleDriveRpdPksDocumentRow,
  type GoogleDriveRpdPksKind,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";

function isDocumentRow(
  v: GoogleDriveRpdPksDocumentRow | { error: string } | undefined,
): v is GoogleDriveRpdPksDocumentRow {
  return Boolean(v && typeof v === "object" && !(v as { error?: string }).error && "google_doc_id" in (v as object));
}

export function GoogleDocsRpdPksEditor({
  npsn,
  initialKind,
  schoolName,
}: {
  npsn: string;
  initialKind?: GoogleDriveRpdPksKind;
  schoolName?: string;
}) {
  const { session, hydrated, hydrate } = useAuthStore();
  const token = session?.token ?? "";
  const [activeKind, setActiveKind] = useState<GoogleDriveRpdPksKind>(initialKind ?? "RPD");
  const [configStatus, setConfigStatus] = useState<{
    configured: boolean;
    message: string;
    templates: { rpdTemplateId: string | null; pksTemplateId: string | null };
  } | null>(null);
  const [documents, setDocuments] = useState<Record<GoogleDriveRpdPksKind, GoogleDriveRpdPksDocumentRow | null>>({
    RPD: null,
    PKS: null,
  });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<GoogleDriveRpdPksKind | "BOTH" | null>(null);
  const [sharing, setSharing] = useState<GoogleDriveRpdPksKind | null>(null);
  const [linkingKind, setLinkingKind] = useState<GoogleDriveRpdPksKind | null>(null);
  const [pasteDocUrlByKind, setPasteDocUrlByKind] = useState<Record<GoogleDriveRpdPksKind, string>>({
    RPD: "",
    PKS: "",
  });
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [previewFrameKey, setPreviewFrameKey] = useState(0);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !token || !npsn) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [cfg, list] = await Promise.all([
          googleDriveConfigStatusRequest(token),
          googleDriveRpdPksBySchoolRequest(token, npsn),
        ]);
        if (cancelled) return;
        setConfigStatus(cfg);
        const map: Record<GoogleDriveRpdPksKind, GoogleDriveRpdPksDocumentRow | null> = { RPD: null, PKS: null };
        for (const r of list.rows) {
          map[r.kind] = r;
        }
        setDocuments(map);
        setErrorBanner(null);
      } catch (e) {
        if (!cancelled) {
          setErrorBanner((e as Error).message || String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, token, npsn]);

  async function handleCreate(kind: GoogleDriveRpdPksKind | "BOTH") {
    if (!token) return;
    setCreating(kind);
    setErrorBanner(null);
    try {
      const res = await googleDriveCreateRpdPksRequest(token, npsn, kind);
      const next = { ...documents };
      (Object.keys(res.result) as GoogleDriveRpdPksKind[]).forEach((k) => {
        const val = res.result[k];
        if (isDocumentRow(val)) next[k] = val;
        else if (val && "error" in val) {
          setErrorBanner((cur) => (cur ? `${cur}\n${k}: ${val.error}` : `${k}: ${val.error}`));
        }
      });
      setDocuments(next);
      setPreviewFrameKey((k) => k + 1);
    } catch (e) {
      setErrorBanner((e as Error).message || String(e));
    } finally {
      setCreating(null);
    }
  }

  async function handleShare(kind: GoogleDriveRpdPksKind) {
    if (!token) return;
    const doc = documents[kind];
    if (!doc?.id && !doc?.google_doc_id) return;
    setSharing(kind);
    setErrorBanner(null);
    try {
      await googleDriveSharePublicRequest(token, doc.google_doc_id ?? doc.id, "writer");
      setPreviewFrameKey((k) => k + 1);
    } catch (e) {
      setErrorBanner((e as Error).message || String(e));
    } finally {
      setSharing(null);
    }
  }

  function getTemplateIdForKind(kind: GoogleDriveRpdPksKind): string | null {
    if (!configStatus?.templates) return null;
    return kind === "RPD" ? configStatus.templates.rpdTemplateId : configStatus.templates.pksTemplateId;
  }

  function handleOpenTemplateCopyInNewTab(kind: GoogleDriveRpdPksKind) {
    const tplId = getTemplateIdForKind(kind);
    if (!tplId) {
      setErrorBanner(`Template ID ${kind} belum di set di env. Silakan isi GOOGLE_DRIVE_${kind}_TEMPLATE_ID.`);
      return;
    }
    const url = `https://docs.google.com/document/d/${tplId}/copy`;
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  async function handleLinkExistingDoc(kind: GoogleDriveRpdPksKind) {
    if (!token) return;
    const raw = (pasteDocUrlByKind[kind] ?? "").trim();
    if (!raw) {
      setErrorBanner(
        `Paste dulu link Google Doc ${kind} copy-an kamu di kolom 'Link Google Doc ${kind} ini'. Dapatkan dari browser setelah klik File → Make a copy.`,
      );
      return;
    }
    setLinkingKind(kind);
    setErrorBanner(null);
    try {
      const res = await googleDriveLinkExistingDocRequest(token, npsn, kind, raw);
      const next = { ...documents, [kind]: res.row };
      setDocuments(next);
      setPasteDocUrlByKind((prev) => ({ ...prev, [kind]: "" }));
      setPreviewFrameKey((k) => k + 1);
    } catch (e) {
      setErrorBanner((e as Error).message || String(e));
    } finally {
      setLinkingKind(null);
    }
  }

  async function handleRefreshPlaceholder(kind: GoogleDriveRpdPksKind) {
    if (!token) return;
    const doc = documents[kind];
    if (!doc?.google_doc_id) return;
    setLinkingKind(kind);
    setErrorBanner(null);
    try {
      const res = await googleDriveLinkExistingDocRequest(token, npsn, kind, doc.google_doc_id);
      const next = { ...documents, [kind]: res.row };
      setDocuments(next);
      setPreviewFrameKey((k) => k + 1);
    } catch (e) {
      setErrorBanner((e as Error).message || String(e));
    } finally {
      setLinkingKind(null);
    }
  }

  const tabs: Array<{ key: GoogleDriveRpdPksKind; label: string; desc: string; icon: React.ReactNode }> = [
    {
      key: "RPD",
      label: "RPD",
      desc: "Rencana Penggunaan Dana (Sarana)",
      icon: <FileText className="h-4 w-4 text-indigo-600" />,
    },
    {
      key: "PKS",
      label: "PKS",
      desc: "Perjanjian Kerja Sama Sekolah x Mitra",
      icon: <Wand2 className="h-4 w-4 text-amber-600" />,
    },
  ];

  const activeDoc = documents[activeKind];
  const activeTemplateReady =
    activeKind === "RPD" ? Boolean(configStatus?.templates.rpdTemplateId) : Boolean(configStatus?.templates.pksTemplateId);

  const embedHref = useMemo(() => {
    if (activeDoc?.embed_url) {
      const separator = activeDoc.embed_url.includes("?") ? "&" : "?";
      return `${activeDoc.embed_url}${separator}rm=minimal`;
    }
    return null;
  }, [activeDoc, previewFrameKey]);

  return (
    <Card className="border-indigo-100/60">
      <CardHeader className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              Editor Google Docs RPD &amp; PKS — {schoolName ? `${schoolName}` : `NPSN ${npsn}`}
            </CardTitle>
            <CardDescription className="text-sm text-slate-500 mt-1">
              Buat RPD dan PKS dari template Google Doc master. Placeholder seperti <code className="font-mono text-xs bg-slate-100 rounded px-1 py-0.5">{"{{nama_sekolah}}"}</code>,{" "}
              <code className="font-mono text-xs bg-slate-100 rounded px-1 py-0.5">{"{{npsn}}"}</code>, dll otomatis di inject dari database.
              Editor dokumen Google Docs yang di embed bisa diedit langsung — autosave ke Google Drive.
            </CardDescription>
          </div>
          {configStatus && (
            <Badge variant={configStatus.configured ? "success" : "warning"} className="self-start sm:self-auto">
              {configStatus.configured ? "Service Account OK" : "Google Service Account Belum Di Set"}
            </Badge>
          )}
        </div>

        {configStatus && !configStatus.configured && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm text-amber-700 flex items-start gap-2">
            <TriangleAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold">Konfigurasi Google Cloud Service Account belum lengkap:</div>
              <div className="mt-1">{configStatus.message}</div>
              <ul className="list-disc pl-5 mt-2 space-y-0.5 text-xs">
                <li>Isi <code>apps/api/.env</code> — <code>GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=...</code> (json key di encode base64)</li>
                <li>Isi <code>GOOGLE_DRIVE_RPD_TEMPLATE_ID=1xxxxxx</code> (copy dari URL template RPD: docs.google.com/document/d/ID/edit)</li>
                <li>Isi <code>GOOGLE_DRIVE_PKS_TEMPLATE_ID=1yyyyy</code></li>
                <li>Opsional: <code>GOOGLE_DRIVE_IMPERSONATE_USER_EMAIL=admin@domainkita.id</code> jika ingin doc masuk ke Drive user tertentu (bukan Service Account).</li>
              </ul>
            </div>
          </div>
        )}

        {!activeTemplateReady && configStatus?.configured && (
          <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700 flex items-start gap-2">
            <TriangleAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              Template ID untuk <strong>{activeKind}</strong> belum di set di env. Silakan set:
              <div className="font-mono text-xs mt-1 bg-white/70 rounded px-2 py-1 inline-block">
                {activeKind === "RPD" ? "GOOGLE_DRIVE_RPD_TEMPLATE_ID" : "GOOGLE_DRIVE_PKS_TEMPLATE_ID"}
              </div>
            </div>
          </div>
        )}

        {errorBanner && (
          <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-sm text-rose-700 whitespace-pre-wrap">
            {errorBanner}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg inline-flex w-full sm:w-auto shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveKind(tab.key)}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                activeKind === tab.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {documents[tab.key]?.status === "READY" && (
                <Badge variant="success" className="ml-1 text-[10px] py-0 px-1.5">
                  READY
                </Badge>
              )}
              {documents[tab.key]?.status === "FAILED" && (
                <Badge variant="danger" className="ml-1 text-[10px] py-0 px-1.5">
                  ERROR
                </Badge>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={() => handleOpenTemplateCopyInNewTab(activeKind)}
            disabled={!configStatus?.configured || !activeTemplateReady || loading}
            className="gap-1.5"
          >
            <FileText className="h-4 w-4" />
            1. Buka Template {activeKind} (Tab Baru → Make a copy)
          </Button>
          {!activeDoc?.google_doc_id ? (
            <Button
              size="sm"
              variant="default"
              onClick={() => handleLinkExistingDoc(activeKind)}
              disabled={
                !configStatus?.configured ||
                !token ||
                linkingKind !== null ||
                loading ||
                !pasteDocUrlByKind[activeKind]?.trim()
              }
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {linkingKind === activeKind ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              2. Inject Placeholder &amp; Simpan
            </Button>
          ) : (
            <Button
              size="sm"
              variant="default"
              onClick={() => handleRefreshPlaceholder(activeKind)}
              disabled={!configStatus?.configured || !token || linkingKind !== null || loading}
              className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {linkingKind === activeKind ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Refresh Placeholder {activeKind}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleShare(activeKind)}
            disabled={!activeDoc?.google_doc_id || sharing !== null}
            className="gap-1.5"
          >
            {sharing === activeKind ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            Jadikan Public / Shareable
          </Button>
          {activeDoc?.doc_url && (
            <Link href={activeDoc.doc_url} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="gap-1.5">
                <FileText className="h-4 w-4" />
                Buka di Tab Baru
              </Button>
            </Link>
          )}
          {activeDoc?.google_doc_id && token && (
            <>
              <Link
                href={googleDriveRpdPksExportUrl(token, activeDoc.google_doc_id, "pdf")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="ghost" className="gap-1.5">
                  <FileDown className="h-4 w-4" />
                  Export PDF
                </Button>
              </Link>
              <Link
                href={googleDriveRpdPksExportUrl(token, activeDoc.google_doc_id, "docx")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="ghost" className="gap-1.5">
                  <FileDown className="h-4 w-4" />
                  Export DOCX
                </Button>
              </Link>
            </>
          )}
          {activeDoc?.google_doc_id && (
            <Button size="sm" variant="ghost" onClick={() => setPreviewFrameKey((k) => k + 1)} className="gap-1.5">
              <RefreshCw className="h-4 w-4" />
              Reload Preview
            </Button>
          )}
        </div>

        {!activeDoc?.google_doc_id && (
          <div className="mt-2 flex flex-wrap items-stretch gap-2 w-full sm:max-w-3xl">
            <Input
              className="font-mono text-xs flex-1 min-w-[280px]"
              placeholder={`Paste di sini Link Google Doc ${activeKind} copy-an kamu. Contoh: https://docs.google.com/document/d/1abc.../edit`}
              value={pasteDocUrlByKind[activeKind]}
              onChange={(e) =>
                setPasteDocUrlByKind((prev) => ({ ...prev, [activeKind]: e.target.value }))
              }
            />
            {Boolean(pasteDocUrlByKind[activeKind]?.trim()) &&
              !/document\/d\/[a-zA-Z0-9_-]+/.test(pasteDocUrlByKind[activeKind]) && (
                <Badge variant="warning" className="self-center">
                  Link belum mirip Google Doc ☝️
                </Badge>
              )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-2 py-10 text-slate-500 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            Memuat status dokumen Google Drive...
          </div>
        )}
        {!loading && !activeDoc?.google_doc_id && (
          <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-14 flex flex-col items-center text-center gap-3 text-slate-500">
            <FileText className="h-12 w-12 text-slate-300" />
            <div>
              <div className="font-semibold text-slate-700 text-base">
                {activeKind} untuk sekolah ini belum di-link dengan Google Doc copy-an
              </div>
              <div className="text-sm mt-1 max-w-2xl text-left">
                <ol className="list-decimal pl-5 mt-2 space-y-1.5">
                  <li>
                    Klik tombol <span className="font-semibold text-indigo-700">1. Buka Template {activeKind} (Tab Baru → Make a copy)</span> di atas.
                    Akan terbuka halaman Google Docs — klik tombol <strong>Make a copy</strong> (hijau) agar file tersimpan ke Drive kamu.
                  </li>
                  <li>
                    Setelah file copy-an terbuka: klik tombol <strong>Share</strong> → <strong>General Access</strong>: Ubah Restricted menjadi{' '}
                    <strong>Anyone with the link</strong> → Role pilih <strong>Editor</strong> → <strong>Save</strong> → Copy URL di address bar browser.
                  </li>
                  <li>
                    Paste link Google Doc copy-an itu ke kolom di atas (yang ada placeholder text <code className="font-mono text-xs bg-white/70 rounded px-1">Paste di sini Link Google Doc ...</code>).
                  </li>
                  <li>
                    Klik tombol <span className="font-semibold text-indigo-700">2. Inject Placeholder &amp; Simpan</span>. Tunggu beberapa detik — placeholder{' '}
                    <code className="font-mono text-xs bg-white/70 rounded px-1">{"{{nama_sekolah}}"}</code>,{' '}
                    <code className="font-mono text-xs bg-white/70 rounded px-1">{"{{npsn}}"}</code>, dll akan otomatis di-replace dengan data sekolah dari DB!
                  </li>
                </ol>
              </div>
            </div>
            {activeDoc?.last_error_message && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700 max-w-xl whitespace-pre-wrap text-left">
                Last Error: {activeDoc.last_error_message}
              </div>
            )}
            <div className="text-[11px] text-slate-400 mt-2 max-w-xl">
              Placeholder yang otomatis di inject dari DB:{" "}
              <code className="font-mono bg-white/70 rounded px-1">{"{{nama_sekolah}}"}</code>,{" "}
              <code className="font-mono bg-white/70 rounded px-1">{"{{npsn}}"}</code>,{" "}
              <code className="font-mono bg-white/70 rounded px-1">{"{{nama_kepala_sekolah}}"}</code>,{" "}
              <code className="font-mono bg-white/70 rounded px-1">{"{{alamat_sekolah}}"}</code>,{" "}
              <code className="font-mono bg-white/70 rounded px-1">{"{{total_bantuan_rp}}"}</code>,{" "}
              <code className="font-mono bg-white/70 rounded px-1">{"{{konsentrasi_keahlian}}"}</code>,{" "}
              <code className="font-mono bg-white/70 rounded px-1">{"{{tanggal_hari_ini}}"}</code>, dll.
            </div>
          </div>
        )}
        {!loading && activeDoc?.google_doc_id && embedHref && (
          <div className="w-full border rounded-xl overflow-hidden bg-white shadow-inner" style={{ aspectRatio: "8.5 / 11" }}>
            <iframe
              key={previewFrameKey}
              src={embedHref}
              title={`${activeKind} Google Docs Editor - ${npsn}`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PlaceholderGoogleDocsInputLink() {
  const [val, setVal] = useState("");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tempat User Paste Link Template RPD/PKS (sementara)</CardTitle>
        <CardDescription className="text-sm text-slate-500">
          Template harus dalam format Google Doc shareable. Nanti saya extract ID dari link dan set di env.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Input
          placeholder="https://docs.google.com/document/d/1xxxxxxxxxxxxx/edit"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          className="font-mono text-xs"
        />
        {val && /docs\.google\.com\/document\/d\/([^/]+)/.test(val) && (
          <Badge variant="success" className="self-center">
            TEMPLATE_ID = {val.match(/docs\.google\.com\/document\/d\/([^/]+)/)?.[1]}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
