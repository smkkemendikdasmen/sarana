"use client";

import "grapesjs/dist/css/grapes.min.css";

import grapesjs, { type Editor as GjsEditor } from "grapesjs";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
// @ts-ignore — mammoth tidak ship type untuk mammoth.browser entry, load manual.
import * as mammothLib from "mammoth/mammoth.browser";
const mammoth: any = (mammothLib as any).default ?? mammothLib;

import {
  FileDown,
  FileUp,
  RefreshCcw,
  ReplaceAll,
  FileText,
  Code2,
  Settings,
  Undo2,
  Redo2,
  XCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type PageSetup,
  type PageSetupPreset,
  resolvePageSetup,
  PAGE_SETUP_PRESETS,
  PAPER_SIZE_DIM,
} from "@/components/shared/rich-text-editor";
import { cn } from "@/lib/utils";

export interface EditorSharedProps {
  value: string;
  onChange: (nextHtml: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  minHeight?: CSSProperties["minHeight"];
  disabled?: boolean;
  showToolbar?: boolean;
  readOnly?: boolean;
  pageSetup?: PageSetupPreset | PageSetup;
  onPageSetupChange?: (next: PageSetup) => void;
  showPageSetupButton?: boolean;
  showImageUploadButton?: boolean;
  showDocxIoButtons?: boolean;
  defaultTemplateHtml?: string;
  replaceFieldMap?: Partial<Record<string, string>>;
  showHtmlSourceToggle?: boolean;
}

export type { EditorSharedProps as TipTapRpdEditorProps };

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

function _htmlIsEmpty(h: string | undefined | null): boolean {
  if (!h) return true;
  const s = String(h).replace(/&nbsp;/g, " ").replace(/<[^>]*>/g, "").trim();
  return s.length === 0;
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

const TB_BTN =
  "h-7 px-2.5 text-xs shrink-0 rounded-md border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-700 transition-all inline-flex items-center gap-1";

export function GrapesJsRpdEditor({
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
  const editorRef = useRef<GjsEditor | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastSyncRef = useRef<string>(value ?? "");
  const skipNextChangeRef = useRef(false);
  const defaultTemplateHtmlRef = useRef<string | undefined>(defaultTemplateHtml);
  const placeholdersAppliedRef = useRef(false);
  const docxImportRef = useRef<HTMLInputElement | null>(null);
  const imgImportRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvedPage = useMemo(() => resolvePageSetup(pageSetup), [pageSetup]);

  const [pageSetupOpen, setPageSetupOpen] = useState(false);
  const [pageSetupDraft, setPageSetupDraft] = useState<PageSetup>(resolvedPage);

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

  const getCanvasCurrentHtml = useCallback(() => {
    if (!editorRef.current) return "";
    const ed = editorRef.current;
    try {
      const bodyHtml = ed.getHtml();
      const cssHtml = ed.getCss();
      if (!cssHtml || cssHtml.trim().length === 0) return bodyHtml;
      if (bodyHtml.toLowerCase().includes("<style")) return bodyHtml;
      return `<style>${cssHtml}</style>${bodyHtml}`;
    } catch {
      return editorRef.current?.getHtml?.() ?? "";
    }
  }, []);

  const loadDefaultTemplateNow = useCallback(
    (applyPh = true, confirm = true) => {
      const ed = editorRef.current;
      if (!ed) return;
      const raw = defaultTemplateHtmlRef.current ?? "";
      if (!raw) return;
      if (confirm) {
        const ok = window.confirm(
          "Muat Template Default?\nKonten yang saat ini ada di kanvas akan direset ke template standar.",
        );
        if (!ok) return;
      }
      const replaced = applyPh ? _applyReplaceFieldMap(raw, replaceFieldMap) : raw;
      skipNextChangeRef.current = true;
      ed.setComponents(replaced);
      if (applyPh) placeholdersAppliedRef.current = true;
      setTimeout(() => {
        skipNextChangeRef.current = false;
        const next = getCanvasCurrentHtml();
        lastSyncRef.current = next;
        onChange(next);
      }, 80);
    },
    [replaceFieldMap, onChange, getCanvasCurrentHtml],
  );

  const applyPlaceholdersNow = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const cur = ed.getHtml();
    const replaced = _applyReplaceFieldMap(cur, replaceFieldMap);
    if (replaced === cur) {
      window.alert("Tidak ada placeholder yang cocok ditemukan di dokumen saat ini.");
      return;
    }
    skipNextChangeRef.current = true;
    ed.setComponents(replaced);
    placeholdersAppliedRef.current = true;
    setTimeout(() => {
      skipNextChangeRef.current = false;
      const next = getCanvasCurrentHtml();
      lastSyncRef.current = next;
      onChange(next);
    }, 80);
    window.alert("Placeholder berhasil diisi dengan data riil.");
  }, [replaceFieldMap, onChange, getCanvasCurrentHtml]);

  const openViewSource = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    try {
      ed.runCommand("core:open-code");
    } catch {
      const html = ed.getHtml();
      const css = ed.getCss();
      window.prompt("Source Code (copy paste untuk edit manual):", `<style>\n${css}\n</style>\n${html}`);
    }
  }, []);

  const handleImportDocx = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editorRef.current) {
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
          "Konten DOCX berhasil di-extract. Gabungkan ke kanvas sekarang?\nPilih OK: timpa seluruh konten dengan isi DOCX.\nPilih Cancel: batalkan.",
        );
        if (!ok) return;
        skipNextChangeRef.current = true;
        editorRef.current.setComponents(html);
        setTimeout(() => {
          skipNextChangeRef.current = false;
          const next = getCanvasCurrentHtml();
          lastSyncRef.current = next;
          onChange(next);
        }, 80);
      } catch (err: any) {
        window.alert("Gagal import DOCX: " + (err?.message ?? String(err)));
      } finally {
        if (docxImportRef.current) docxImportRef.current.value = "";
      }
    },
    [onChange, getCanvasCurrentHtml],
  );

  const handleExportDocx = useCallback(() => {
    const html = getCanvasCurrentHtml();
    const blob = _exportDocxBlob(html, "rpd-pks-document.doc");
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rpd-pks-${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [getCanvasCurrentHtml]);

  const savePageSetupDraft = useCallback(() => {
    onPageSetupChange?.(pageSetupDraft);
    setPageSetupOpen(false);
  }, [pageSetupDraft, onPageSetupChange]);

  useEffect(() => {
    if (!containerRef.current || editorRef.current) return;
    const el = containerRef.current;
    const ed = grapesjs.init({
      container: el,
      height: typeof minHeight === "number" ? `${minHeight}px` : String(minHeight ?? "520px"),
      width: "auto",
      fromElement: false,
      storageManager: false as any,
      plugins: [],
      pluginsOpts: {},
      deviceManager: {
        devices: [
          { name: "A4 Portrait", width: "210mm", height: "297mm", widthMedia: "800px" },
          { name: "Desktop", width: "1200px", widthMedia: "1200px" },
          { name: "Tablet", width: "768px", widthMedia: "768px" },
          { name: "Mobile", width: "375px", widthMedia: "375px" },
        ],
      } as any,
      canvas: {
        styles: [
          `body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color:#000; }
           .page-a4 { width: 210mm; min-height: 297mm; padding: 2cm; margin: 8px auto; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.1); box-sizing: border-box; }
           table { border-collapse: collapse; width: 100%; }
           table th, table td { border: 1px solid #000; padding: 4px 6px; font-size: 11pt; }
           table th { background: #f8fafc; font-weight: bold; }
           h1, h2, h3 { font-family: 'Times New Roman', Times, serif; font-weight: bold; margin-top: 0.6em; margin-bottom: 0.4em; }
           p { margin-top: 0.3em; margin-bottom: 0.3em; }
           .page-break-after { page-break-after: always; break-after: page; }`,
        ],
      },
      styleManager: {
        sectors: [
          {
            name: "Tipografi",
            open: true,
            buildProps: [
              "font-family",
              "font-size",
              "font-weight",
              "font-style",
              "text-decoration",
              "color",
              "text-align",
              "line-height",
              "letter-spacing",
            ],
            properties: [
              {
                property: "font-family",
                type: "select",
                defaults: "'Times New Roman', Times, serif",
                options: [
                  { id: "tnr", value: "'Times New Roman', Times, serif", name: "Times New Roman (Default)" },
                  { id: "arial", value: "Arial, Helvetica, sans-serif", name: "Arial" },
                  { id: "courier", value: "'Courier New', Courier, monospace", name: "Courier New" },
                  { id: "georgia", value: "Georgia, serif", name: "Georgia" },
                  { id: "verdana", value: "Verdana, Geneva, sans-serif", name: "Verdana" },
                  { id: "tahoma", value: "Tahoma, Geneva, sans-serif", name: "Tahoma" },
                ],
              },
              {
                property: "font-size",
                type: "select",
                defaults: "11pt",
                options: ["8pt", "9pt", "10pt", "11pt", "12pt", "14pt", "16pt", "18pt", "20pt", "24pt"].map((v) => ({
                  id: v,
                  value: v,
                  name: v,
                })),
              },
              {
                property: "font-weight",
                type: "select",
                defaults: "normal",
                options: [
                  { id: "normal", value: "normal", name: "Normal" },
                  { id: "bold", value: "bold", name: "Bold" },
                  { id: "600", value: "600", name: "Semi Bold" },
                ],
              },
              {
                property: "font-style",
                type: "select",
                defaults: "normal",
                options: [
                  { id: "normal", value: "normal", name: "Normal" },
                  { id: "italic", value: "italic", name: "Italic" },
                ],
              },
              {
                property: "text-decoration",
                type: "select",
                defaults: "none",
                options: [
                  { id: "none", value: "none", name: "None" },
                  { id: "underline", value: "underline", name: "Underline" },
                  { id: "linethrough", value: "line-through", name: "Strikethrough" },
                ],
              },
              {
                property: "text-align",
                type: "radio",
                defaults: "left",
                options: [
                  { id: "left", value: "left", name: "Kiri", className: "fa fa-align-left" },
                  { id: "center", value: "center", name: "Tengah", className: "fa fa-align-center" },
                  { id: "right", value: "right", name: "Kanan", className: "fa fa-align-right" },
                  { id: "justify", value: "justify", name: "Justify", className: "fa fa-align-justify" },
                ],
              },
            ],
          },
          {
            name: "Dimensi",
            open: false,
            buildProps: ["width", "height", "min-width", "min-height", "margin", "padding"],
          },
          {
            name: "Latar & Border",
            open: true,
            buildProps: ["background-color", "border", "border-radius", "border-collapse"],
            properties: [
              {
                property: "border-collapse",
                type: "select",
                defaults: "collapse",
                options: [
                  { id: "collapse", value: "collapse", name: "Collapse (rapat)" },
                  { id: "separate", value: "separate", name: "Separate (terpisah)" },
                ],
              },
            ],
          },
          {
            name: "Tata Letak",
            open: false,
            buildProps: ["display", "position", "float", "flex-direction", "justify-content", "align-items"],
          },
          {
            name: "Ekstra",
            open: false,
            buildProps: ["overflow", "opacity", "cursor", "page-break-after"],
            properties: [
              {
                property: "page-break-after",
                type: "select",
                defaults: "auto",
                options: [
                  { id: "auto", value: "auto", name: "Auto" },
                  { id: "always", value: "always", name: "Always (halaman baru)" },
                ],
              },
            ],
          },
        ] as any,
      } as any,
      blockManager: {
        appendTo: undefined as any,
        blocks: [
          {
            id: "sect-a4",
            label: `<div class="gjs-block-label">Halaman A4</div>`,
            category: "Dokumen",
            content: `<section class="page-a4"></section>`,
            attributes: { title: "Tambahkan lembar kertas A4 baru" },
          },
          {
            id: "sect-break",
            label: `<div class="gjs-block-label">Page Break</div>`,
            category: "Dokumen",
            content: `<div class="page-break-after"></div>`,
            attributes: { title: "Paksa cetak halaman baru SESUDAH elemen ini" },
          },
          {
            id: "h1",
            label: `<div class="gjs-block-label">Heading 1</div>`,
            category: "Teks",
            content: `<h1 style="font-size:18pt;font-weight:bold;margin:12pt 0 8pt 0;">Heading 1</h1>`,
            attributes: { title: "Heading 1" },
          },
          {
            id: "h2",
            label: `<div class="gjs-block-label">Heading 2</div>`,
            category: "Teks",
            content: `<h2 style="font-size:14pt;font-weight:bold;margin:10pt 0 6pt 0;">Heading 2</h2>`,
            attributes: { title: "Heading 2" },
          },
          {
            id: "h3",
            label: `<div class="gjs-block-label">Heading 3</div>`,
            category: "Teks",
            content: `<h3 style="font-size:12pt;font-weight:bold;margin:8pt 0 4pt 0;">Heading 3</h3>`,
            attributes: { title: "Heading 3" },
          },
          {
            id: "p",
            label: `<div class="gjs-block-label">Paragraf</div>`,
            category: "Teks",
            content: `<p style="font-size:11pt;margin:6pt 0;text-align:justify;">Paragraf biasa. Klik 2x untuk mengedit teks.</p>`,
            attributes: { title: "Paragraf teks" },
          },
          {
            id: "bold-line",
            label: `<div class="gjs-block-label">Garis Pemisah</div>`,
            category: "Teks",
            content: `<hr style="border-top:1.5pt solid #000;margin:12pt 0;" />`,
            attributes: { title: "Horizontal rule tebal 1.5pt" },
          },
          {
            id: "tbl-2col",
            label: `<div class="gjs-block-label">Tabel 2 Kolom</div>`,
            category: "Tabel",
            content: `<table style="border-collapse:collapse;width:100%;font-size:11pt;">
<thead><tr>
<th style="border:1pt solid #000;padding:4pt 6pt;background:#f8fafc;width:30%;">Kolom Kiri</th>
<th style="border:1pt solid #000;padding:4pt 6pt;background:#f8fafc;">Kolom Kanan</th>
</tr></thead>
<tbody><tr>
<td style="border:1pt solid #000;padding:4pt 6pt;">Label 1</td>
<td style="border:1pt solid #000;padding:4pt 6pt;">Isi 1</td>
</tr><tr>
<td style="border:1pt solid #000;padding:4pt 6pt;">Label 2</td>
<td style="border:1pt solid #000;padding:4pt 6pt;">Isi 2</td>
</tr></tbody></table>`,
            attributes: { title: "Tabel 2 kolom standar (header + 2 baris)" },
          },
          {
            id: "tbl-4col",
            label: `<div class="gjs-block-label">Tabel 4 Kolom</div>`,
            category: "Tabel",
            content: `<table style="border-collapse:collapse;width:100%;font-size:11pt;">
<thead><tr>
<th style="border:1pt solid #000;padding:4pt 6pt;background:#f8fafc;">No</th>
<th style="border:1pt solid #000;padding:4pt 6pt;background:#f8fafc;">Uraian</th>
<th style="border:1pt solid #000;padding:4pt 6pt;background:#f8fafc;">Qty</th>
<th style="border:1pt solid #000;padding:4pt 6pt;background:#f8fafc;">Total (Rp)</th>
</tr></thead>
<tbody><tr>
<td style="border:1pt solid #000;padding:4pt 6pt;text-align:center;">1</td>
<td style="border:1pt solid #000;padding:4pt 6pt;">Uraian item 1</td>
<td style="border:1pt solid #000;padding:4pt 6pt;text-align:center;">10</td>
<td style="border:1pt solid #000;padding:4pt 6pt;text-align:right;">1.500.000</td>
</tr><tr>
<td style="border:1pt solid #000;padding:4pt 6pt;text-align:center;">2</td>
<td style="border:1pt solid #000;padding:4pt 6pt;">Uraian item 2</td>
<td style="border:1pt solid #000;padding:4pt 6pt;text-align:center;">5</td>
<td style="border:1pt solid #000;padding:4pt 6pt;text-align:right;">500.000</td>
</tr></tbody></table>`,
            attributes: { title: "Tabel 4 kolom Anggaran (No/Uraian/Qty/Total)" },
          },
          {
            id: "tbl-nm",
            label: `<div class="gjs-block-label">Tabel N×M (3×3)</div>`,
            category: "Tabel",
            content: `<table style="border-collapse:collapse;width:100%;font-size:11pt;">
<tbody>
<tr>
<td style="border:1pt solid #000;padding:4pt 6pt;">A1</td>
<td style="border:1pt solid #000;padding:4pt 6pt;">B1</td>
<td style="border:1pt solid #000;padding:4pt 6pt;">C1</td>
</tr>
<tr>
<td style="border:1pt solid #000;padding:4pt 6pt;">A2</td>
<td style="border:1pt solid #000;padding:4pt 6pt;">B2</td>
<td style="border:1pt solid #000;padding:4pt 6pt;">C2</td>
</tr>
<tr>
<td style="border:1pt solid #000;padding:4pt 6pt;">A3</td>
<td style="border:1pt solid #000;padding:4pt 6pt;">B3</td>
<td style="border:1pt solid #000;padding:4pt 6pt;">C3</td>
</tr>
</tbody></table>`,
            attributes: { title: "Tabel 3×3 dasar, hapus/tambah baris kolom via Toolbar Table" },
          },
          {
            id: "img-block",
            label: `<div class="gjs-block-label">Gambar</div>`,
            category: "Media",
            content: `<img alt="gambar" style="max-width:100%;height:auto;border:1px solid #ddd;" src="https://placehold.co/600x200?text=Klik+Ganti+Gambar" />`,
            attributes: { title: "Blok gambar (double click / properties untuk ganti URL)" },
          },
          {
            id: "ul",
            label: `<div class="gjs-block-label">Daftar Bullet</div>`,
            category: "Teks",
            content: `<ul style="margin:6pt 0 6pt 24pt;font-size:11pt;"><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>`,
            attributes: { title: "Unordered list (bullet)" },
          },
          {
            id: "ol",
            label: `<div class="gjs-block-label">Daftar Nomor</div>`,
            category: "Teks",
            content: `<ol style="margin:6pt 0 6pt 24pt;font-size:11pt;"><li>Langkah 1</li><li>Langkah 2</li><li>Langkah 3</li></ol>`,
            attributes: { title: "Ordered list (angka)" },
          },
          {
            id: "ttd-block",
            label: `<div class="gjs-block-label">Blok Tanda Tangan</div>`,
            category: "Dokumen",
            content: `<table style="border-collapse:collapse;width:100%;font-size:11pt;margin-top:24pt;"><tbody><tr>
<td style="width:50%;padding:6pt;border:none;vertical-align:top;">
<div style="text-align:center;margin-bottom:48pt;">Mengetahui,</div>
<div style="text-align:center;font-weight:bold;">Nama Pejabat</div>
<div style="text-align:center;font-size:9pt;">NIP. _________________</div>
</td>
<td style="width:50%;padding:6pt;border:none;vertical-align:top;">
<div style="text-align:center;margin-bottom:48pt;">Jakarta, {{tanggal_ttd}}</div>
<div style="text-align:center;font-weight:bold;">Hormat Saya,</div>
<div style="text-align:center;font-size:9pt;">Nama Pelaksana / PPK</div>
</td></tr></tbody></table>`,
            attributes: { title: "Blok TTD kiri-kanan standar" },
          },
        ],
      } as any,
      layerManager: { appendTo: undefined as any },
      traitManager: { appendTo: undefined as any },
      selectorManager: { appendTo: undefined as any },
    } as any);

    ed.onReady(() => {
      editorRef.current = ed;
      const pn = (ed as any).Panels;
      if (pn) {
        try {
          const sm = pn.addButton("views", {
            id: "open-traits",
            command: "open-traits",
            className: "fa fa-th",
            attributes: { title: "Komponen (Blok)" },
            active: true,
          });
          if (sm) (sm as any).set && (sm as any).set("active", true);
        } catch {}
      }
      ed.on("component:update", () => {
        if (skipNextChangeRef.current) return;
        syncEditorHtml(getCanvasCurrentHtmlLocal());
      });
      ed.on("style:update", () => {
        if (skipNextChangeRef.current) return;
        syncEditorHtml(getCanvasCurrentHtmlLocal());
      });
      ed.on("load", () => {});

      const initialVal = lastSyncRef.current ?? value ?? "";
      const startEmpty = _htmlIsEmpty(initialVal);
      if (startEmpty && defaultTemplateHtmlRef.current) {
        const raw = defaultTemplateHtmlRef.current;
        const replaced = _applyReplaceFieldMap(raw, replaceFieldMap);
        skipNextChangeRef.current = true;
        ed.setComponents(replaced);
        placeholdersAppliedRef.current = true;
        setTimeout(() => {
          skipNextChangeRef.current = false;
          const next = getCanvasCurrentHtmlLocal();
          lastSyncRef.current = next;
          onChange(next);
        }, 120);
      } else if (initialVal && initialVal.length > 10) {
        skipNextChangeRef.current = true;
        ed.setComponents(initialVal);
        setTimeout(() => {
          skipNextChangeRef.current = false;
          lastSyncRef.current = initialVal;
        }, 120);
      }
      if (readOnly || disabled) {
        try {
          (ed as any).set("readOnly", true);
          (ed.Canvas as any).disable && (ed.Canvas as any).disable();
        } catch {}
      }
    });

    function getCanvasCurrentHtmlLocal(): string {
      if (!editorRef.current) return "";
      const edLocal = editorRef.current;
      try {
        const bodyHtml = edLocal.getHtml();
        const cssHtml = edLocal.getCss();
        if (!cssHtml || cssHtml.trim().length === 0) return bodyHtml;
        if (bodyHtml.toLowerCase().includes("<style")) return bodyHtml;
        return `<style>${cssHtml}</style>${bodyHtml}`;
      } catch {
        return edLocal.getHtml?.() ?? "";
      }
    }

    return () => {
      try {
        if (editorRef.current) {
          (editorRef.current as any).destroy?.();
          editorRef.current = null;
        }
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const cur = getCanvasCurrentHtml();
    const v = value ?? "";
    if (v && v !== lastSyncRef.current && v !== cur) {
      lastSyncRef.current = v;
      skipNextChangeRef.current = true;
      try {
        ed.setComponents(v);
      } catch {}
      setTimeout(() => {
        skipNextChangeRef.current = false;
      }, 100);
    }
  }, [value, getCanvasCurrentHtml]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    if (readOnly || disabled) {
      try {
        (ed as any).set("readOnly", true);
        (ed.Canvas as any).disable && (ed.Canvas as any).disable();
      } catch {}
    } else {
      try {
        (ed as any).set("readOnly", false);
        (ed.Canvas as any).enable && (ed.Canvas as any).enable();
      } catch {}
    }
  }, [readOnly, disabled]);

  const handleInsertImageClick = () => imgImportRef.current?.click();

  const handleInsertImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) {
      if (imgImportRef.current) imgImportRef.current.value = "";
      return;
    }
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        if (!editorRef.current) return;
        skipNextChangeRef.current = true;
        try {
          editorRef.current.addComponents(
            `<img alt="${file.name}" style="max-width:100%;height:auto;border:1px solid #ddd;" src="${dataUrl}" />`,
          );
        } catch {}
        setTimeout(() => {
          skipNextChangeRef.current = false;
          const next = getCanvasCurrentHtml();
          lastSyncRef.current = next;
          onChange(next);
        }, 80);
      };
      reader.readAsDataURL(file);
    } finally {
      if (imgImportRef.current) imgImportRef.current.value = "";
    }
  };

  return (
    <div className={cn("w-full flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden", className)}>
      {showToolbar && (
        <div className="w-full flex flex-col gap-1 border-b border-slate-200 bg-slate-50 p-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              type="button"
              size="sm"
              className={TB_BTN}
              onClick={() => editorRef.current?.runCommand("core:undo")}
              disabled={disabled || readOnly}
              title="Undo"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Undo</span>
            </Button>
            <Button
              type="button"
              size="sm"
              className={TB_BTN}
              onClick={() => editorRef.current?.runCommand("core:redo")}
              disabled={disabled || readOnly}
              title="Redo"
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
              className={TB_BTN}
              onClick={openViewSource}
              disabled={disabled || readOnly}
              title="Buka editor Source Code HTML + CSS (GrapesJS built-in code editor)"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>View Code</span>
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
            {showImageUploadButton && (
              <>
                <input
                  ref={imgImportRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleInsertImageFile}
                />
                <Button
                  type="button"
                  size="sm"
                  className={TB_BTN}
                  onClick={handleInsertImageClick}
                  disabled={disabled || readOnly}
                  title="Sisipkan gambar dari file lokal (convert ke base64 inline)"
                >
                  <RefreshCcw className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Sisip Gambar</span>
                </Button>
              </>
            )}
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
                  title="Import file .docx ke kanvas (Mammoth.js)"
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
            </div>
          </div>
        </div>
      )}

      <div
        className={cn(
          "w-full flex-1 bg-[#f5f5f5] overflow-hidden gjs-editor-root",
          editorClassName,
          disabled || readOnly ? "opacity-90" : "",
        )}
        style={{ minHeight: minHeight }}
      >
        <div ref={containerRef} className="w-full h-full" style={{ minHeight: minHeight }} />
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

export { GrapesJsRpdEditor as TipTapRpdEditor };
export const GrapesJSRpdEditor = GrapesJsRpdEditor;
