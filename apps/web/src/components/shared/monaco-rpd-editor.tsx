"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// @ts-ignore — mammoth tidak ship type untuk mammoth.browser entry
import * as mammothLib from "mammoth/mammoth.browser";
const mammoth: any = (mammothLib as any).default ?? mammothLib;

import Editor, { type OnMount, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import type { editor as MonacoEditorNS } from "monaco-editor";

import {
  Code2,
  FileDown,
  FileUp,
  FileText,
  RefreshCcw,
  ReplaceAll,
  Settings,
  Undo2,
  Redo2,
  XCircle,
  CheckCircle2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type PageSetup,
  type PageSetupPreset,
  resolvePageSetup,
  PAGE_SETUP_PRESETS,
  PAPER_SIZE_DIM,
} from "@/components/shared/rich-text-editor";
import { RPD_PKS_PLACEHOLDER_CHEATSHEET } from "@/lib/rpd-pks-default-templates";
import { cn } from "@/lib/utils";
import type { EditorSharedProps } from "@/components/shared/grapesjs-rpd-editor";

loader.config({ monaco });

const TB_BTN =
  "h-7 px-2.5 text-xs shrink-0 rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition-all inline-flex items-center gap-1";

function _applyReplaceFieldMap(htmlIn: string, map: Partial<Record<string, string>> | undefined): string {
  if (!htmlIn || !map) return htmlIn ?? "";
  let out = htmlIn;
  for (const [k, vRaw] of Object.entries(map)) {
    const v = String(vRaw ?? "");
    const safeV = v.replace(/\$/g, "$$$$");
    const re = new RegExp(`\\{\\{\\s*${k.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*\\}\\}`, "g");
    out = out.replace(re, safeV);
  }
  return out;
}

function _exportDocxBlob(htmlIn: string, filename = "document.doc"): Blob {
  const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Document</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>
    @page { size: 21cm 29.7cm; margin: 2cm; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; }
    table { border-collapse: collapse; }
    table td, table th { border: 1pt solid #000; padding: 4pt 6pt; }
  </style></head><body>`;
  const footer = "</body></html>";
  const src = header + (htmlIn ?? "") + footer;
  const blob = new Blob(["\ufeff", src], { type: "application/msword" });
  return blob;
}

function _prettyFormatHtml(raw: string): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const div = document.createElement("div");
  try {
    div.innerHTML = s;
  } catch {
    return raw;
  }
  const pad = (level: number) => "  ".repeat(level);
  let out = "";
  let level = 0;
  const voidTags = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
  const tokenRe = /<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)\s*>/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(s)) !== null) {
    const before = s.slice(lastIndex, m.index);
    const textBefore = before.replace(/\s+/g, " ").trim();
    if (textBefore) {
      out += pad(level) + textBefore + "\n";
    }
    const isClose = m[1] === "/";
    const tagName = (m[2] || "").toLowerCase();
    const attrs = m[3] || "";
    const isSelfClose = m[4] === "/" || voidTags.has(tagName);
    const tagFull = m[0];
    if (isClose) {
      level = Math.max(0, level - 1);
      out += pad(level) + tagFull + "\n";
    } else if (isSelfClose) {
      out += pad(level) + tagFull + "\n";
    } else {
      out += pad(level) + tagFull + "\n";
      level++;
    }
    lastIndex = m.index + m[0].length;
  }
  const tail = s.slice(lastIndex).replace(/\s+/g, " ").trim();
  if (tail) out += pad(level) + tail + "\n";
  return out.trim();
}

const PH_MAP = new Map(RPD_PKS_PLACEHOLDER_CHEATSHEET.map((x) => [x.key, x]));

export function MonacoRpdEditor({
  value,
  onChange,
  placeholder,
  className,
  editorClassName,
  minHeight = "520px",
  disabled = false,
  showToolbar = true,
  readOnly = false,
  pageSetup,
  onPageSetupChange,
  showPageSetupButton = true,
  showImageUploadButton = true,
  showDocxIoButtons = false,
  showHtmlSourceToggle = true,
  defaultTemplateHtml,
  replaceFieldMap,
}: EditorSharedProps) {
  const editorRef = useRef<MonacoEditorNS.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const lastSyncRef = useRef<string>(value ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const defaultTemplateHtmlRef = useRef<string | undefined>(defaultTemplateHtml);
  const docxImportRef = useRef<HTMLInputElement | null>(null);
  const resolvedPage = useMemo(() => resolvePageSetup(pageSetup), [pageSetup]);

  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [pageSetupDraft, setPageSetupDraft] = useState<PageSetup>(resolvedPage);
  const [hoverRegistered, setHoverRegistered] = useState(false);

  useEffect(() => {
    defaultTemplateHtmlRef.current = defaultTemplateHtml;
  }, [defaultTemplateHtml]);

  useEffect(() => {
    setPageSetupDraft(resolvedPage);
  }, [resolvedPage]);

  const syncEditorHtml = useCallback(
    (nextHtml: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const clean = nextHtml ?? "";
        if (lastSyncRef.current !== clean) {
          lastSyncRef.current = clean;
          onChange(clean);
        }
      }, 250);
    },
    [onChange],
  );

  const applyPlaceholdersNow = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const cur = ed.getValue();
    const replaced = _applyReplaceFieldMap(cur, replaceFieldMap);
    if (replaced === cur) {
      window.alert("Tidak ada placeholder yang cocok ditemukan di dokumen saat ini.");
      return;
    }
    ed.executeEdits("replace-map", [
      { range: ed.getModel()!.getFullModelRange(), text: replaced },
    ]);
    lastSyncRef.current = replaced;
    onChange(replaced);
    window.alert("Placeholder berhasil diisi dengan data riil.");
  }, [replaceFieldMap, onChange]);

  const loadDefaultTemplateNow = useCallback(
    (applyPh = true, confirm = true) => {
      const ed = editorRef.current;
      if (!ed) return;
      const raw = defaultTemplateHtmlRef.current ?? "";
      if (!raw) return;
      if (confirm) {
        const ok = window.confirm(
          "Muat Template Default?\nKonten yang saat ini ada di editor akan direset ke template standar.",
        );
        if (!ok) return;
      }
      const replaced = applyPh ? _applyReplaceFieldMap(raw, replaceFieldMap) : raw;
      ed.executeEdits("load-default", [
        { range: ed.getModel()!.getFullModelRange(), text: replaced },
      ]);
      lastSyncRef.current = replaced;
      onChange(replaced);
    },
    [replaceFieldMap, onChange],
  );

  const prettyFormatNow = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    try {
      const formatted = _prettyFormatHtml(ed.getValue());
      ed.executeEdits("pretty", [
        { range: ed.getModel()!.getFullModelRange(), text: formatted },
      ]);
    } catch (err: any) {
      window.alert("Gagal format HTML: " + (err?.message ?? String(err)));
    }
  }, []);

  const handleExportDocx = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const html = ed.getValue();
    const blob = _exportDocxBlob(html, "rpd-pks-document.doc");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rpd-pks-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportDocx = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const ed = editorRef.current;
      if (!file || !ed) {
        if (docxImportRef.current) docxImportRef.current.value = "";
        return;
      }
      try {
        const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
        const html: string = result.value ?? "";
        if (!html) {
          window.alert("File DOCX tidak bisa dikonversi (kosong).");
          return;
        }
        const ok = window.confirm(
          "Konten DOCX berhasil di-extract. Timpa seluruh konten editor sekarang?\nPilih OK: timpa.\nPilih Cancel: batalkan.",
        );
        if (!ok) return;
        ed.executeEdits("import-docx", [
          { range: ed.getModel()!.getFullModelRange(), text: html },
        ]);
        lastSyncRef.current = html;
        onChange(html);
      } catch (err: any) {
        window.alert("Gagal import DOCX: " + (err?.message ?? String(err)));
      } finally {
        if (docxImportRef.current) docxImportRef.current.value = "";
      }
    },
    [onChange],
  );

  const savePageSetupDraft = useCallback(() => {
    onPageSetupChange?.(pageSetupDraft);
    setPageSetupOpen(false);
  }, [pageSetupDraft, onPageSetupChange]);

  const handleMount: OnMount = (ed, mn) => {
    editorRef.current = ed;
    monacoRef.current = mn;

    if (mn && !hoverRegistered) {
      try {
        mn.languages.registerHoverProvider("html", {
          provideHover: (model: MonacoEditorNS.ITextModel, position: monaco.IPosition) => {
            const wordInfo = model.getWordUntilPosition(position);
            const range = new mn.Range(
              position.lineNumber,
              Math.max(1, wordInfo.startColumn - 2),
              position.lineNumber,
              wordInfo.endColumn + 2,
            );
            const around = model.getValueInRange(range) ?? "";
            const phMatch = around.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/);
            if (!phMatch) return null;
            const key = phMatch[1];
            const info = PH_MAP.get(key as any);
            const contents: monaco.IMarkdownString[] = [];
            if (info) {
              contents.push({
                value: `**\`{{${info.key}}}\`** — ${info.label}  \n**Contoh:** \`${info.contoh}\``,
                isTrusted: true,
              });
            } else {
              contents.push({
                value: `⚠️ **Placeholder tidak dikenal:** \`{{${key}}}\`  \nKunci ini TIDAK ADA di daftar 84 placeholder standar, tidak akan diganti saat Preview/Export PDF.`,
                isTrusted: true,
              });
            }
            return {
              range: new mn.Range(
                position.lineNumber,
                wordInfo.startColumn,
                position.lineNumber,
                wordInfo.endColumn,
              ),
              contents,
            };
          },
        });
        setHoverRegistered(true);
      } catch {}
    }

    const initialVal = lastSyncRef.current ?? value ?? "";
    if (initialVal && initialVal.length > 0) {
      ed.setValue(initialVal);
    } else if (defaultTemplateHtmlRef.current) {
      const raw = defaultTemplateHtmlRef.current;
      const replaced = _applyReplaceFieldMap(raw, replaceFieldMap);
      ed.setValue(replaced);
      lastSyncRef.current = replaced;
      setTimeout(() => onChange(replaced), 50);
    }
    ed.onDidChangeModelContent(() => {
      const v = ed.getValue();
      syncEditorHtml(v);
    });
    if (readOnly || disabled) {
      ed.updateOptions({ readOnly: true, domReadOnly: true });
    }
  };

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const cur = ed.getValue();
    const v = value ?? "";
    if (v && v !== lastSyncRef.current && v !== cur) {
      lastSyncRef.current = v;
      ed.executeEdits("external-update", [
        { range: ed.getModel()!.getFullModelRange(), text: v },
      ]);
    }
  }, [value]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.updateOptions({
      readOnly: !!(readOnly || disabled),
      domReadOnly: !!(readOnly || disabled),
    });
  }, [readOnly, disabled]);

  return (
    <div className={cn("w-full flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden", className)}>
      {showToolbar && (
        <div className="w-full flex flex-col gap-1 border-b border-slate-200 bg-slate-50 p-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              type="button"
              size="sm"
              className={TB_BTN}
              onClick={() => editorRef.current?.trigger("undo", "undo", null)}
              disabled={disabled || readOnly}
              title="Undo (Monaco)"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Undo</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className={TB_BTN}
              onClick={() => editorRef.current?.trigger("redo", "redo", null)}
              disabled={disabled || readOnly}
              title="Redo (Monaco)"
            >
              <Redo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Redo</span>
            </Button>
            <div className="w-px h-5 bg-slate-200 mx-0.5" />
            <Button
              type="button"
              size="sm"
              className={cn(TB_BTN, "!bg-indigo-50 !text-indigo-700 !border-indigo-200 hover:!bg-indigo-100")}
              onClick={() => loadDefaultTemplateNow(true, true)}
              disabled={disabled || readOnly}
              title="Muat template standar sesuai Tab aktif"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Muat Template</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn(TB_BTN, "!bg-emerald-50 !text-emerald-700 !border-emerald-200 hover:!bg-emerald-100")}
              onClick={applyPlaceholdersNow}
              disabled={disabled || readOnly}
              title="Isi placeholder {{key}} dengan data riil dari profil sekolah"
            >
              <ReplaceAll className="h-3.5 w-3.5" />
              <span>Isi Placeholder</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className={cn(TB_BTN, "!bg-violet-50 !text-violet-700 !border-violet-200 hover:!bg-violet-100")}
              onClick={prettyFormatNow}
              disabled={disabled || readOnly}
              title="Pretty indent HTML (rapikan struktur 2 spasi)"
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>Format</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className={TB_BTN}
              onClick={() => editorRef.current?.getAction("editor.action.formatDocument")?.run()}
              disabled={disabled || readOnly}
              title="Format Document (Monaco built-in)"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Fmt Doc</span>
            </Button>
            {showPageSetupButton && (
              <Button
                type="button"
                size="sm"
                className={TB_BTN}
                onClick={() => {
                  setPageSetupDraft(resolvedPage);
                  setPageSetupOpen(true);
                }}
                title="Atur ukuran kertas & margin (Page Setup)"
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Page Setup</span>
              </Button>
            )}
            <div className="w-px h-5 bg-slate-200 mx-0.5" />
            {showDocxIoButtons && (
              <>
                <input
                  ref={docxImportRef}
                  type="file"
                  accept=".docx,.doc"
                  className="hidden"
                  onChange={handleImportDocx}
                />
                <Button
                  type="button"
                  size="sm"
                  className={TB_BTN}
                  onClick={() => docxImportRef.current?.click()}
                  disabled={disabled || readOnly}
                  title="Import file .docx ke editor (Mammoth.js)"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  <span>Import DOCX</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className={cn(TB_BTN, "!bg-sky-50 !text-sky-700 !border-sky-200 hover:!bg-sky-100")}
                  onClick={handleExportDocx}
                  disabled={readOnly}
                  title="Export ke .doc (bisa dibuka MS Word)"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  <span>Export DOCX</span>
                </Button>
              </>
            )}
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[11px] text-slate-500 hidden lg:inline pr-1">
                {PAGE_SETUP_PRESETS[resolvedPage.preset]?.label ?? "A4"} · Mm{" "}
                {resolvedPage.marginLeftMm ?? "-"}/{resolvedPage.marginTopMm ?? "-"}/
                {resolvedPage.marginRightMm ?? "-"}/{resolvedPage.marginBottomMm ?? "-"}
              </span>
              <span className="text-[11px] text-slate-400 font-mono hidden xl:inline">
                Monaco · HTML
              </span>
            </div>
          </div>
        </div>
      )}

      <div
        className={cn(
          "w-full flex-1 bg-white overflow-hidden border-t border-slate-200",
          editorClassName,
          disabled || readOnly ? "opacity-90" : "",
        )}
        style={{ minHeight: minHeight }}
      >
        <Editor
          height={typeof minHeight === "number" ? `${minHeight}px` : String(minHeight ?? "520px")}
          defaultLanguage="html"
          theme="vs-light"
          value={lastSyncRef.current ?? value ?? ""}
          onMount={handleMount}
          options={{
            minimap: { enabled: true, renderCharacters: false, maxColumn: 80 },
            wordWrap: "on",
            fontSize: 13,
            lineNumbers: "on",
            automaticLayout: true,
            tabSize: 2,
            formatOnPaste: true,
            renderWhitespace: "selection",
            scrollBeyondLastLine: false,
            readOnly: !!(disabled || readOnly),
            domReadOnly: !!(disabled || readOnly),
            padding: { top: 12, bottom: 12 },
            smoothScrolling: true,
            cursorBlinking: "phase",
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
            hover: { enabled: "on", sticky: true },
          }}
        />
      </div>

      {pageSetupOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Page Setup (Setup Halaman)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ukuran kertas & margin untuk keperluan layout preview & cetak.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setPageSetupOpen(false)}
              >
                <XCircle className="h-4 w-4 text-slate-500" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="col-span-2">
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Ukuran Kertas (Preset)</label>
                <select
                  className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs"
                  value={pageSetupDraft.preset ?? "a4"}
                  onChange={(e) => {
                    const p = e.target.value as PageSetupPreset;
                    const preset = Object.values(PAGE_SETUP_PRESETS).find((x) => x.preset === p);
                    if (preset) {
                      let paperKey: keyof typeof PAPER_SIZE_DIM = "a4";
                      for (const k of Object.keys(PAPER_SIZE_DIM) as (keyof typeof PAPER_SIZE_DIM)[]) {
                        if (k === "custom") continue;
                        const dim = PAPER_SIZE_DIM[k];
                        if (
                          Math.abs((preset.widthMm ?? 210) - dim.w) < 0.5 &&
                          Math.abs((preset.heightMm ?? 297) - dim.h) < 0.5
                        ) {
                          paperKey = k;
                          break;
                        }
                      }
                      const dim = PAPER_SIZE_DIM[paperKey];
                      setPageSetupDraft({
                        preset: p,
                        orientation: preset.orientation,
                        marginTopMm: preset.marginTopMm ?? 12,
                        marginBottomMm: preset.marginBottomMm ?? 12,
                        marginLeftMm: preset.marginLeftMm ?? 12,
                        marginRightMm: preset.marginRightMm ?? 12,
                        widthMm: preset.widthMm ?? dim.w,
                        heightMm: preset.heightMm ?? dim.h,
                        paddingMm: preset.paddingMm,
                        paperShadow: preset.paperShadow,
                        marginYAuto: preset.marginYAuto,
                        pageBg: preset.pageBg,
                      });
                    }
                  }}
                >
                  {(Object.entries(PAGE_SETUP_PRESETS) as [PageSetupPreset, (typeof PAGE_SETUP_PRESETS)[PageSetupPreset]][]).map(
                    ([id, p]) => (
                      <option key={id} value={id}>
                        {p.label}
                      </option>
                    ),
                  )}
                </select>
              </div>
              {(
                [
                  ["marginTopMm", "Margin Atas (mm)"],
                  ["marginBottomMm", "Margin Bawah (mm)"],
                  ["marginLeftMm", "Margin Kiri (mm)"],
                  ["marginRightMm", "Margin Kanan (mm)"],
                ] as const
              ).map(([k, label]) => (
                <div key={k}>
                  <label className="text-[11px] font-medium text-slate-700 block mb-1">{label}</label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    step={1}
                    className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs"
                    value={Number(pageSetupDraft[k] ?? 12)}
                    onChange={(e) =>
                      setPageSetupDraft({ ...pageSetupDraft, [k]: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-[11px] font-medium text-slate-700 block mb-1">Orientasi</label>
                <select
                  className="w-full h-9 rounded-md border border-slate-300 px-2 text-xs"
                  value={pageSetupDraft.orientation ?? "portrait"}
                  onChange={(e) =>
                    setPageSetupDraft({
                      ...pageSetupDraft,
                      orientation: e.target.value as "portrait" | "landscape",
                    })
                  }
                >
                  <option value="portrait">Portrait (Tegak)</option>
                  <option value="landscape">Landscape (Mendatar)</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setPageSetupOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white inline-flex items-center gap-1"
                onClick={savePageSetupDraft}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Terapkan
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MonacoRpdEditor;
