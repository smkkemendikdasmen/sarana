"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";
import Dropcursor from "@tiptap/extension-dropcursor";
import Gapcursor from "@tiptap/extension-gapcursor";
import HardBreak from "@tiptap/extension-hard-break";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
// @ts-ignore — mammoth tidak ship type untuk mammoth.browser entry, load manual.
import * as mammothLib from "mammoth/mammoth.browser";
const mammoth: any = (mammothLib as any).default ?? mammothLib;

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignJustify,
  Bold,
  Eraser,
  FileImage,
  FileUp,
  FileDown,
  Heading1,
  Heading2,
  Heading3,
  Home,
  ImageIcon,
  Italic,
  LayoutGrid,
  Link2,
  List,
  ListOrdered,
  LayoutDashboard,
  Plus,
  PlusSquare,
  SplitSquareVertical,
  Table as TableIcon,
  Underline as UnderlineIcon,
  Unlink,
  Settings,
  Trash2,
  RotateCcw,
  X,
  ListTodo,
  Undo2,
  Redo2,
  Palette,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  type PageSetup,
  type PageSetupPreset,
  PAGE_SETUP_PRESETS,
  PAPER_SIZE_DIM,
  resolvePageSetup,
} from "@/components/shared/rich-text-editor";
import { cn } from "@/lib/utils";

/* =========================================================================
 *  TIPTAP RPD EDITOR — WRAPPER VANILLA STABLE (Backward Compatible)
 *  Interface props SAMA PENUH dengan RichTextEditor, jadi parent component
 *  TIDAK USAH DIUBAH SATUPUN (cuma ganti import).
 *
 *  Fitur Stabil dipertahankan (100% native TipTap):
 *    - 📥 Import .docx (mammoth) upload file Word otomatis convert ke HTML
 *    - 📤 Export .docx (download blob .doc dari HTML via header ms-word)
 *    - ↶↷ Undo / Redo history Andal (TipTap Transaction Based)
 *    - Paste from Word auto clean (mammoth / TipTap pasteRules)
 *    - Table addRow / addCol / delete via toolbar (TipTap Table vanilla)
 *    - Color text + highlight + font family dropdown
 *    - Task list checkbox (checklist per-item)
 *    - ⚙️ Page Setup Modal (A4/A5/Folio/F4/Legal + orientation + 4 margin mm)
 *    - Image upload (drag & drop) + double-click prompt atur lebar px
 * ========================================================================= */

const Tb = ({
  children,
  onClick,
  active,
  title,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
  disabled?: boolean;
  className?: string;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    title={title}
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "h-8 w-8 shrink-0 rounded-md border border-transparent",
      active
        ? "bg-primary/10 text-primary border-primary/20"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      disabled ? "opacity-40 pointer-events-none" : "",
      className,
    )}
  >
    {children}
  </Button>
);

interface TipTapRpdEditorProps {
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

function _htmlPrettyPrint(html: string): string {
  if (!html) return "";
  const INDENT = "  ";
  let indentLevel = 0;
  const voidTags = new Set(["br", "img", "hr", "input", "meta", "link"]);
  let result = "";
  const tokens = html.split(/(<[^>]*>)/g).filter((t) => t.length > 0);
  let lastWasText = false;
  for (const tok of tokens) {
    if (!tok.startsWith("<")) {
      const trimmed = tok.trim();
      if (trimmed) {
        if (lastWasText === false) result += INDENT.repeat(indentLevel);
        result += trimmed.replace(/\s+/g, " ");
        lastWasText = true;
      }
      continue;
    }
    const tagMatch = tok.match(/^<\/?([a-zA-Z0-9-]+)/);
    const tagName = tagMatch?.[1]?.toLowerCase() ?? "";
    const isClosing = tok.startsWith("</");
    const isSelfClosing = tok.endsWith("/>") || voidTags.has(tagName);
    if (isClosing) {
      indentLevel = Math.max(0, indentLevel - 1);
      if (!lastWasText) result += INDENT.repeat(indentLevel);
      result += tok;
    } else if (isSelfClosing) {
      result += INDENT.repeat(indentLevel) + tok;
    } else {
      result += INDENT.repeat(indentLevel) + tok;
      indentLevel += 1;
    }
    if (result.length > 0 && !result.endsWith("\n")) result += "\n";
    lastWasText = false;
  }
  return result.trimEnd() + "\n";
}

function _applyReplaceFieldMap(htmlIn: string, map: Partial<Record<string, string>> | undefined): string {
  if (!htmlIn || !map) return htmlIn ?? "";
  let out = htmlIn;
  for (const [k, vRaw] of Object.entries(map)) {
    const v = String(vRaw ?? "");
    const safeV = v.replace(/\$/g, "$$$$");
    const re = new RegExp(`\\{\\{\\s*${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`, "g");
    out = out.replace(re, safeV);
  }
  return out;
}

function _htmlIsEmpty(h: string | undefined | null): boolean {
  if (!h) return true;
  const s = String(h).replace(/&nbsp;/g, " ").replace(/<[^>]*>/g, "").trim();
  return s.length === 0;
}

export function TipTapRpdEditor({
  value,
  onChange,
  placeholder,
  className,
  editorClassName,
  minHeight = "420px",
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
}: TipTapRpdEditorProps) {
  const defaultTemplateHtmlRef = useRef<string | undefined>(defaultTemplateHtml);
  const placeholdersAppliedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const docxImportRef = useRef<HTMLInputElement | null>(null);
  const paperWrapperRef = useRef<HTMLDivElement | null>(null);
  const resolvedPage = useMemo(() => resolvePageSetup(pageSetup), [pageSetup]);
  const lastSyncRef = useRef<string>(value ?? "");

  const [activeRibbon, setActiveRibbon] = useState<"home" | "insert" | "layout">("home");
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceHtml, setSourceHtml] = useState<string>(value ?? "");

  // ========= TABLE NODE DIY: Insert Grid Popover + Context Bar (mirip TableTriggerButton + TableExtend official)
  const [tableGridOpen, setTableGridOpen] = useState(false);
  const [tableGridHovered, setTableGridHovered] = useState<{ r: number; c: number } | null>(null);
  const [tableContextVisible, setTableContextVisible] = useState(false);
  const [tableContextPos, setTableContextPos] = useState<{ top: number; left: number; maxW: number } | null>(null);

  // ===== TABLE EDITOR ADVANCED: Row/Col Visual Handles (user request: PILIH delete row/col mana!) + BORDER TOGGLE tebal/tipis/tanpa
  const hoveredCellRef = useRef<{
    tableEl: HTMLTableElement;
    cellEl: HTMLTableCellElement;
    rowIdx: number;
    colIdx: number;
    totalRows: number;
    totalCols: number;
  } | null>(null);
  const [, setCellTick] = useState(0);
  const activeTableElRef = useRef<HTMLTableElement | null>(null);
  const [tableBorderPreset, setTableBorderPreset] = useState<0 | 1 | 2 | 3>(1);
  const COL_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // ========= BUBBLE MENU GAMBAR — STABLE 100% click-based (NO GLOBAL DRAG LISTENER) ========
  const [imgBubbleVisible, setImgBubbleVisible] = useState(false);
  const [imgBubblePos, setImgBubblePos] = useState<{ top: number; left: number; maxLeft: number } | null>(null);
  const selectedImgElRef = useRef<HTMLImageElement | null>(null);

  const applyImgStyle = useCallback((opts: { widthPct?: number; align?: "left" | "center" | "right" | "none"; del?: boolean; widthPx?: number }) => {
    const el = selectedImgElRef.current;
    if (!el) return;
    if (opts.del) {
      el.remove();
      setImgBubbleVisible(false);
      selectedImgElRef.current = null;
      setTimeout(() => fireOnChangeRef.current(), 0);
      return;
    }
    if (opts.widthPct != null || opts.widthPx != null) {
      const parent = el.parentElement;
      const parentW = parent?.clientWidth ?? (paperWrapperRef.current?.clientWidth ?? 720);
      let wPx = opts.widthPx ?? 0;
      if (opts.widthPct != null) {
        wPx = Math.max(80, Math.round((parentW - 48) * opts.widthPct));
      }
      if (wPx >= 80) {
        el.style.width = `${wPx}px`;
        el.style.height = "auto";
        el.style.maxWidth = "100%";
      }
    }
    if (opts.align != null) {
      el.style.display = "block";
      if (opts.align === "center") {
        el.style.cssFloat = "none";
        el.style.marginLeft = "auto";
        el.style.marginRight = "auto";
        el.setAttribute("data-align", "center");
      } else if (opts.align === "left") {
        el.style.cssFloat = "left";
        el.style.marginLeft = "0";
        el.style.marginRight = "16px";
        el.setAttribute("data-align", "left");
      } else if (opts.align === "right") {
        el.style.cssFloat = "right";
        el.style.marginLeft = "16px";
        el.style.marginRight = "0";
        el.setAttribute("data-align", "right");
      } else {
        el.style.cssFloat = "none";
        el.style.marginLeft = "0";
        el.style.marginRight = "0";
        el.removeAttribute("data-align");
      }
    }
    setTimeout(() => fireOnChangeRef.current(), 0);
  }, []);

  // ==================== STATE PAGE SETUP MODAL (COPY RTE existing) ====================
  const [pageSetupModalOpen, setPageSetupModalOpen] = useState(false);
  const [draftPaperKey, setDraftPaperKey] = useState<keyof typeof PAPER_SIZE_DIM>("a4");
  const [draftWidthMm, setDraftWidthMm] = useState<number>(210);
  const [draftHeightMm, setDraftHeightMm] = useState<number>(297);
  const [draftOrientation, setDraftOrientation] = useState<"portrait" | "landscape">("portrait");
  const [draftPaddingMm, setDraftPaddingMm] = useState<number>(14);
  const [draftMarginTMm, setDraftMarginTMm] = useState<number>(12);
  const [draftMarginBMm, setDraftMarginBMm] = useState<number>(14);
  const [draftMarginLMm, setDraftMarginLMm] = useState<number>(12);
  const [draftMarginRMm, setDraftMarginRMm] = useState<number>(12);
  const [draftShadow, setDraftShadow] = useState<boolean>(true);
  const [draftMarginCenter, setDraftMarginCenter] = useState<boolean>(true);
  const [draftBg, setDraftBg] = useState<string>("#ffffff");

  // ====== COLOR PICKER STATE ======
  const [textColorOpen, setTextColorOpen] = useState(false);

  const paperSizeLabel = useMemo(() => {
    if (resolvedPage.preset === "default") return "Default";
    const orientation = resolvedPage.orientation === "landscape" ? " — Landscape" : "";
    return `${(resolvedPage.widthMm ?? 210).toFixed(0)}×${(resolvedPage.heightMm ?? 297).toFixed(0)}mm${orientation}`;
  }, [resolvedPage]);

  const pageContainerStyle: CSSProperties = useMemo(() => {
    const p = resolvedPage;
    if (p.preset === "default" || !p.widthMm || p.widthMm <= 0) return {};
    return {
      width: `${p.widthMm}mm`,
      maxWidth: "100%",
      minHeight: p.heightMm ? `${p.heightMm}mm` : undefined,
      padding: `${p.paddingMm}mm`,
      background: p.pageBg || "#ffffff",
      boxShadow: p.paperShadow
        ? "0 10px 30px rgba(15,23,42,0.08), 0 2px 8px rgba(15,23,42,0.05)"
        : undefined,
      borderRadius: "6px",
      margin: p.marginYAuto ? "20px auto" : undefined,
      overflowX: "hidden",
    };
  }, [resolvedPage]);

  const wrapperBgStyle: CSSProperties = useMemo(() => {
    if (resolvedPage.preset === "default") return {};
    return { background: "#eef2f7" };
  }, [resolvedPage.preset]);

  // ========= SYNC DRAFT MODAL SAAT BUKA =========
  useEffect(() => {
    if (!pageSetupModalOpen) return;
    const p = resolvedPage;
    let keyMatched: keyof typeof PAPER_SIZE_DIM = "custom";
    for (const k of Object.keys(PAPER_SIZE_DIM) as (keyof typeof PAPER_SIZE_DIM)[]) {
      if (k === "custom") continue;
      const { w, h } = PAPER_SIZE_DIM[k];
      const wp = p.widthMm ?? 0;
      const hp = p.heightMm ?? 0;
      if (
        (Math.abs(wp - w) < 0.3 && Math.abs(hp - h) < 0.3) ||
        (Math.abs(wp - h) < 0.3 && Math.abs(hp - w) < 0.3)
      ) {
        keyMatched = k;
        break;
      }
    }
    const o =
      p.orientation ??
      ((p.widthMm ?? 210) > (p.heightMm ?? 297) ? "landscape" : "portrait");
    setDraftPaperKey(keyMatched);
    setDraftWidthMm(Math.round((p.widthMm ?? 210) * 10) / 10);
    setDraftHeightMm(Math.round((p.heightMm ?? 297) * 10) / 10);
    setDraftOrientation(o);
    setDraftPaddingMm(Math.round((p.paddingMm ?? 14) * 10) / 10);
    setDraftMarginTMm(Math.round((p.marginTopMm ?? 12) * 10) / 10);
    setDraftMarginBMm(Math.round((p.marginBottomMm ?? 14) * 10) / 10);
    setDraftMarginLMm(Math.round((p.marginLeftMm ?? 12) * 10) / 10);
    setDraftMarginRMm(Math.round((p.marginRightMm ?? 12) * 10) / 10);
    setDraftShadow(Boolean(p.paperShadow));
    setDraftMarginCenter(Boolean(p.marginYAuto));
    setDraftBg(p.pageBg || "#ffffff");
  }, [pageSetupModalOpen, resolvedPage]);

  // ===========================
  //   INIT TIPTAP EDITOR (VANILLA STABLE)
  // ===========================
  const fireOnChangeRef = useRef<() => void>(() => {});
  const [, setTick] = useState(0);

  const editor: Editor | null = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
      }),
      Underline,
      Placeholder.configure({
        placeholder: ({ node }: any) => {
          if (node.type.name === "heading" && node.attrs.level === 1) return "Heading 1…";
          if (node.type.name === "heading" && node.attrs.level === 2) return "Heading 2…";
          if (node.type.name === "heading" && node.attrs.level === 3) return "Heading 3…";
          if (node.type.name === "codeBlock") return "Tulis kode…";
          return placeholder ?? "Tulis atau tempel konten di sini, pakai {{nama_sekolah}} untuk placeholder…";
        },
      }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      FontFamily,
      TextAlign.configure({ types: ["heading", "paragraph", "list_item", "taskItem"] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        HTMLAttributes: { class: "text-primary underline break-all" },
      }),
      // === Image with OFFICIAL data-align attribute (mirip Tiptap UI Component ImageAlignButton)
      // Pakai extend() karena configure() ImageOptions tidak expose addAttributes di TipTap v3
      Image.extend({
        addAttributes() {
          return {
            ...(this.parent ? (this.parent() as Record<string, any>) : {}),
            align: {
              default: null,
              parseHTML: (element: HTMLElement) =>
                element.getAttribute("data-align") ??
                ((element as HTMLElement).style?.cssFloat === "left"
                  ? "left"
                  : (element as HTMLElement).style?.cssFloat === "right"
                    ? "right"
                    : (element as HTMLElement).style?.marginLeft === "auto" &&
                        (element as HTMLElement).style?.marginRight === "auto"
                      ? "center"
                      : null),
              renderHTML: (attrs: any) => {
                if (!attrs?.align) return {};
                return { "data-align": attrs.align };
              },
            },
          };
        },
      }).configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class:
            "max-w-full h-auto rounded-md shadow-sm my-3 border border-slate-200/70 cursor-pointer",
        },
      }),
      Table.configure({
        resizable: true,
        allowTableNodeSelection: true,
        HTMLAttributes: {
          class:
            "border-collapse w-full my-3 [&_th]:border [&_th]:border-slate-300 [&_th]:px-3 [&_th]:py-2 [&_th]:bg-slate-50 [&_td]:border [&_td]:border-slate-300 [&_td]:px-3 [&_td]:py-2",
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount.configure({ limit: 999999 }),
      Dropcursor.configure({ width: 2, class: "ProseMirror-dropcursor border-primary" }),
      Gapcursor,
      HardBreak.configure({ keepMarks: true }),
      HorizontalRule,
    ],
    content: value ?? "",
    editable: !disabled && !readOnly,
    onCreate: ({ editor: ed }) => {
      setTimeout(() => {
        if (!ed || ed.isDestroyed) return;
        const cur = ed.getHTML() ?? "";
        const tplRaw = defaultTemplateHtmlRef.current ?? defaultTemplateHtml ?? "";
        if (tplRaw && _htmlIsEmpty(cur)) {
          const replaced = _applyReplaceFieldMap(tplRaw, replaceFieldMap);
          ed.commands.setContent(replaced, { emitUpdate: false });
          placeholdersAppliedRef.current = true;
          setTimeout(() => fireOnChangeRef.current?.(), 0);
        } else if (replaceFieldMap && Object.keys(replaceFieldMap).length > 0) {
          const replaced = _applyReplaceFieldMap(cur, replaceFieldMap);
          if (replaced !== cur) {
            ed.commands.setContent(replaced, { emitUpdate: false });
            placeholdersAppliedRef.current = true;
            setTimeout(() => fireOnChangeRef.current?.(), 0);
          } else {
            placeholdersAppliedRef.current = true;
          }
        } else {
          placeholdersAppliedRef.current = true;
        }
      }, 0);
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-slate max-w-none px-4 py-3 text-[14.5px] leading-7 text-slate-800 outline-none focus:outline-none",
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2",
          "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2",
          "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5",
          "[&_p]:my-2",
          "[&_ul]:list-disc [&_ul]:pl-6",
          "[&_ol]:list-decimal [&_ol]:pl-6",
          "[&_blockquote]:border-l-4 [&_blockquote]:border-indigo-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-600 [&_blockquote]:my-3",
          "[&_img]:cursor-pointer [&_img]:transition-shadow hover:[&_img]:shadow-md",
          "[&_hr]:border-t [&_hr]:border-slate-300 [&_hr]:my-4",
          "[&_mark]:bg-yellow-200 [&_mark]:px-1 [&_mark]:rounded",
          editorClassName,
        ),
      } as any,
      handleClickOn: ((view: any, pos: number, node: any, nodePos: number, event: MouseEvent) => {
        if (node.type.name === "image") {
          const target = event.target as HTMLImageElement | null;
          if (!target || target.nodeName !== "IMG") return false;
          if (event.detail === 2) {
            // DOUBLE CLICK — PROMPT LEBAR CUSTOM (px)
            const curW =
              parseInt(target.style.width || String(target.clientWidth || 480), 10) || 480;
            const next = window.prompt(
              `Atur LEBAR gambar (px). Minimum 80, kosongkan untuk batalkan.\nLebar saat ini: ${curW}px`,
              String(curW),
            );
            if (next == null) return true;
            const w = Math.max(80, parseInt(next.trim() || "0", 10) || 0);
            if (!w || Number.isNaN(w)) return true;
            try {
              target.style.width = `${w}px`;
              target.style.height = "auto";
              target.style.maxWidth = "100%";
              setTimeout(() => fireOnChangeRef.current(), 0);
            } catch {}
            return true;
          }
          // SINGLE CLICK (detail === 1) — TAMPILKAN BUBBLE MENU PRESET WIDTH + ALIGN + DELETE
          selectedImgElRef.current = target;
          const wrapperRect = paperWrapperRef.current?.getBoundingClientRect();
          const imgRect = target.getBoundingClientRect();
          const wrapTop = wrapperRect?.top ?? 0;
          const wrapLeft = wrapperRect?.left ?? 0;
          const bubbleH = 48;
          let topPx = imgRect.top - wrapTop - bubbleH - 6;
          if (topPx < 4) topPx = imgRect.bottom - wrapTop + 6;
          const leftPx = Math.max(4, imgRect.left - wrapLeft);
          const maxLeftPx = (wrapperRect?.width ?? 800) - 520;
          setImgBubblePos({ top: topPx, left: Math.min(leftPx, Math.max(4, maxLeftPx)), maxLeft: (wrapperRect?.width ?? 800) });
          setImgBubbleVisible(true);
          return true;
        }
        return false;
      }) as any,
      handleDrop: ((view: any, event: DragEvent, slice: any) => {
        const hasFiles =
          event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0;
        if (!hasFiles) return false;
        const files = Array.from(event.dataTransfer!.files) as File[];
        let handled = false;
        files.forEach((f: File) => {
          if (/^image\//i.test(f.type)) {
            handled = true;
            const reader = new FileReader();
            reader.onload = () => {
              const data = String(reader.result ?? "");
              if (!data) return;
              setTimeout(() => {
                if (!editor?.commands) return;
                editor
                  .chain()
                  .focus()
                  .setImage({ src: data, alt: f.name })
                  .run();
                fireOnChangeRef.current();
              }, 10);
            };
            reader.readAsDataURL(f);
          }
        });
        return handled;
      }) as any,
      handlePaste: ((view: any, event: ClipboardEvent) => {
        const htmlPaste = event.clipboardData?.getData("text/html");
        if (htmlPaste && /worddocument|mso-/i.test(htmlPaste)) return false;
        return false;
      }) as any,
    } as any,
    onUpdate: () => fireOnChangeRef.current(),
    onSelectionUpdate: () => {
      setTick((v) => (v + 1) % 1_000_000);
    },
  });

  // Sync value dari LUAR (parent state) ke TipTap hanya jika benar2 beda
  useEffect(() => {
    if (!editor) return;
    const v = value ?? "";
    if (v !== lastSyncRef.current && v !== editor.getHTML()) {
      lastSyncRef.current = v;
      editor.commands.setContent(v, { emitUpdate: false });
    }
  }, [value, editor]);

  // Sync editable mode
  useEffect(() => {
    if (!editor) return;
    if (editor.isEditable !== (!disabled && !readOnly)) {
      editor.setEditable(!disabled && !readOnly);
    }
  }, [disabled, readOnly, editor]);

  const fireOnChange = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    lastSyncRef.current = html;
    if (html !== value) onChange(html);
  }, [editor, onChange, value]);

  fireOnChangeRef.current = fireOnChange;

  useEffect(() => () => { editor?.destroy(); }, [editor]);

  // ========= SOURCE HTML MODE: ENTER / EXIT SYNC =========
  const enterSourceMode = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const raw = editor.getHTML() ?? value ?? "";
    setSourceHtml(_htmlPrettyPrint(raw));
    setSourceMode(true);
    setImgBubbleVisible(false);
    setTableContextVisible(false);
  }, [editor, value]);

  const applySourceToEditor = useCallback((skipAlert = false): { ok: boolean } => {
    const text = sourceHtml ?? "";
    try {
      const doc = new DOMParser().parseFromString(`<!doctype html><html><body>${text}</body></html>`, "text/html");
      const parseErr = doc.querySelector("parsererror");
      if (parseErr) {
        const msg = `⚠️ HTML sumber tidak valid (parse error).\n\n${parseErr.textContent?.slice(0, 240) ?? ""}\n\nPerbaiki tag yang kurang tutup / tidak berpasangan.`;
        if (!skipAlert) window.alert(msg);
        return { ok: false };
      }
      const clean = doc.body.innerHTML;
      if (editor && !editor.isDestroyed) {
        editor.commands.setContent(clean, { emitUpdate: false });
      }
      lastSyncRef.current = clean;
      onChange(clean);
      return { ok: true };
    } catch (e: any) {
      const msg = `⚠️ Gagal terapkan HTML ke editor:\n${String(e?.message ?? e).slice(0, 200)}`;
      if (!skipAlert) window.alert(msg);
      return { ok: false };
    }
  }, [editor, sourceHtml, onChange]);

  const exitSourceMode = useCallback((discard = false) => {
    if (!discard) {
      const r = applySourceToEditor(false);
      if (!r.ok) return;
    }
    setSourceMode(false);
  }, [applySourceToEditor]);

  const formatSourceHtmlNow = useCallback(() => {
    setSourceHtml((s) => _htmlPrettyPrint(s ?? ""));
  }, []);

  const loadDefaultTemplate = useCallback(() => {
    const tplRaw = defaultTemplateHtmlRef.current ?? defaultTemplateHtml ?? "";
    if (!tplRaw) return;
    const ok = window.confirm("Muat ulang template default?\n\nKonten yang sedang diedit AKAN TERGANTI dan tidak bisa di-undonya. Pastikan sudah simpan perubahan jika ingin menyimpan data saat ini.");
    if (!ok) return;
    const replaced = _applyReplaceFieldMap(tplRaw, replaceFieldMap);
    if (sourceMode) {
      setSourceHtml(_htmlPrettyPrint(replaced));
      onChange(replaced);
      lastSyncRef.current = replaced;
      return;
    }
    if (!editor || editor.isDestroyed) return;
    editor.commands.setContent(replaced, { emitUpdate: false });
    placeholdersAppliedRef.current = true;
    setTimeout(() => fireOnChangeRef.current(), 0);
  }, [editor, defaultTemplateHtml, replaceFieldMap, sourceMode, onChange]);

  const applyPlaceholdersNow = useCallback(() => {
    const html = sourceMode ? sourceHtml : (editor && !editor.isDestroyed ? editor.getHTML() ?? "" : "") ?? "";
    const replaced = _applyReplaceFieldMap(html, replaceFieldMap);
    if (replaced === html) return;
    if (sourceMode) {
      setSourceHtml(_htmlPrettyPrint(replaced));
      onChange(replaced);
      lastSyncRef.current = replaced;
      return;
    }
    if (!editor || editor.isDestroyed) return;
    editor.commands.setContent(replaced, { emitUpdate: false });
    placeholdersAppliedRef.current = true;
    setTimeout(() => fireOnChangeRef.current(), 0);
  }, [editor, replaceFieldMap, sourceMode, sourceHtml, onChange]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !replaceFieldMap) return;
    if (Object.keys(replaceFieldMap).length === 0) return;
    if (placeholdersAppliedRef.current) return;
    const tm = setTimeout(() => {
      if (editor.isDestroyed) return;
      applyPlaceholdersNow();
    }, 120);
    return () => clearTimeout(tm);
  }, [editor, replaceFieldMap, applyPlaceholdersNow]);

  useEffect(() => {
    defaultTemplateHtmlRef.current = defaultTemplateHtml;
  }, [defaultTemplateHtml]);

  // AUTO-HIDE BUBBLE MENU ketika klik LUAR gambar / scroll
  useEffect(() => {
    if (!imgBubbleVisible) return;
    const onDocMouseDown = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      if (t.nodeName === "IMG") return;
      if (t.closest?.("[data-img-bubble-root]")) return;
      setImgBubbleVisible(false);
      selectedImgElRef.current = null;
    };
    const onScroll = () => {
      setImgBubbleVisible(false);
      selectedImgElRef.current = null;
    };
    document.addEventListener("mousedown", onDocMouseDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [imgBubbleVisible]);

  // KEYBOARD SHORTCUT OFFICIAL IMAGE ALIGN BUTTON (Alt + Shift + L / E / R)
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!ev.altKey || !ev.shiftKey) return;
      if (!editor || !selectedImgElRef.current) return;
      const k = ev.key.toLowerCase();
      if (k === "l") { ev.preventDefault(); applyImgAlignByEl("left", selectedImgElRef.current); }
      else if (k === "e") { ev.preventDefault(); applyImgAlignByEl("center", selectedImgElRef.current); }
      else if (k === "r") { ev.preventDefault(); applyImgAlignByEl("right", selectedImgElRef.current); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editor]);

  // RENDER/UPDATE POSISI TABLE CONTEXT BAR saat selection inside TABLE
  useEffect(() => {
    if (!editor || !paperWrapperRef.current) return;
    const update = () => {
      if (!editor?.isActive("table")) {
        if (tableContextVisible) setTableContextVisible(false);
        return;
      }
      const from = editor.state.selection.from;
      let dom: any;
      try { dom = editor.view.domAtPos?.(from) ?? null; } catch {}
      let tableEl: HTMLTableElement | null = null;
      let el = dom?.node ?? (dom?.node as HTMLElement | null)?.parentElement ?? null;
      for (let i = 0; i < 8 && el; i++, el = el.parentElement) {
        if ((el as HTMLElement).tagName === "TABLE") { tableEl = el as HTMLTableElement; break; }
      }
      if (!tableEl) { if (tableContextVisible) setTableContextVisible(false); return; }
      const wrapRect = paperWrapperRef.current!.getBoundingClientRect();
      const tr = tableEl.getBoundingClientRect();
      const top = tr.bottom - wrapRect.top + 10;
      const left = Math.max(4, tr.left - wrapRect.left);
      const maxW = Math.min(wrapRect.width - 8, tr.width);
      setTableContextPos({ top, left, maxW });
      if (!tableContextVisible) setTableContextVisible(true);
    };
    editor.on("selectionUpdate", update);
    editor.on("update", update);
    // Delay awal 1x trigger untuk mount
    const t = setTimeout(update, 80);
    return () => {
      editor.off?.("selectionUpdate", update);
      editor.off?.("update", update);
      clearTimeout(t);
    };
  }, [editor, tableContextVisible]);

  // Close Grid Popover table ketika klik LUAR
  useEffect(() => {
    if (!tableGridOpen) return;
    const onDoc = (ev: MouseEvent) => {
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.("[data-table-grid-popover]")) return;
      setTableGridOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [tableGridOpen]);

  // ROW HANDLE + COL HANDLE HOVER DETECTION (Visual Handle PILIH Hapus Row/Col MANA)
  useEffect(() => {
    const wrapper = paperWrapperRef.current;
    if (!wrapper) return;
    let tickTimer: any = null;
    const fireTickSoon = () => {
      if (tickTimer) return;
      tickTimer = setTimeout(() => {
        tickTimer = null;
        setCellTick((x) => x + 1);
      }, 15);
    };
    const onMove = (ev: MouseEvent) => {
      if (!paperWrapperRef.current) return;
      const t = ev.target as HTMLElement | null;
      if (!t) return;
      if (t.closest?.("[data-row-handle-root], [data-col-handle-root], [data-table-context-root], [data-img-bubble-root]")) {
        return;
      }
      // Cari parent TABLE
      let cellEl: HTMLTableCellElement | null = null;
      let tableEl: HTMLTableElement | null = null;
      let cur: HTMLElement | null = t as HTMLElement;
      for (let i = 0; i < 12 && cur; i++, cur = cur.parentElement as any) {
        if (!cellEl && (cur.tagName === "TD" || cur.tagName === "TH")) {
          cellEl = cur as HTMLTableCellElement;
        }
        if (cur.tagName === "TABLE") {
          tableEl = cur as HTMLTableElement;
          break;
        }
      }
      if (!tableEl || !cellEl) {
        if (hoveredCellRef.current != null) {
          hoveredCellRef.current = null;
          fireTickSoon();
        }
        return;
      }
      activeTableElRef.current = tableEl;
      const rowEl = cellEl.parentElement as HTMLTableRowElement;
      const rowIdx = rowEl?.rowIndex ?? -1;
      const colIdx = cellEl?.cellIndex ?? -1;
      if (rowIdx < 0 || colIdx < 0) return;
      const totalRows = tableEl.rows.length;
      const totalCols = Math.max(
        1,
        ...Array.from(tableEl.rows).map((r) => r.cells.length),
      );
      const prev = hoveredCellRef.current;
      if (!prev || prev.rowIdx !== rowIdx || prev.colIdx !== colIdx || prev.tableEl !== tableEl) {
        hoveredCellRef.current = { tableEl, cellEl, rowIdx, colIdx, totalRows, totalCols };
        fireTickSoon();
      }
    };
    const onLeave = () => {
      if (hoveredCellRef.current != null) {
        hoveredCellRef.current = null;
        setCellTick((x) => x + 1);
      }
    };
    wrapper.addEventListener("mousemove", onMove, true);
    wrapper.addEventListener("mouseleave", onLeave, true);
    return () => {
      wrapper.removeEventListener("mousemove", onMove, true);
      wrapper.removeEventListener("mouseleave", onLeave, true);
      clearTimeout(tickTimer);
    };
  }, [paperWrapperRef]);

  const applyImgAlignByEl = useCallback((align: "left" | "center" | "right", el: HTMLImageElement) => {
    selectedImgElRef.current = el;
    applyImgStyle({ align });
  }, [applyImgStyle]);

  // ===========================
  // HELPER ACTIONS TOOLBAR
  // ===========================
  const triggerUploadImage = () => fileInputRef.current?.click();
  const triggerImportDocx = () => docxImportRef.current?.click();

  const insertPageBreak = () => {
    if (!editor) return;
    editor.chain().focus().insertContent(`<hr class="manual-page-break" data-page-break="true" contenteditable="false">`).run();
    setTimeout(() => fireOnChangeRef.current(), 0);
  };

  const insertHardBreak = () => {
    if (!editor) return;
    editor.chain().focus().setHardBreak().run();
    setTimeout(() => fireOnChangeRef.current(), 0);
  };

  // ========= DIY TABLE NODE REPLIKA =========
  const insertTableGrid = (rows: number, cols: number) => {
    if (!editor || rows <= 0 || cols <= 0) return;
    try {
      editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    } catch (err) {
      console.warn("Insert table fallback:", err);
      const ths = `<tr>${Array.from({ length: cols }).map(() => "<th>&nbsp;</th>").join("")}</tr>`;
      const tdrs = Array.from({ length: Math.max(0, rows - 1) }).map(
        () => `<tr>${Array.from({ length: cols }).map(() => "<td>&nbsp;</td>").join("")}</tr>`,
      ).join("");
      const html = `<table><thead>${ths}</thead><tbody>${tdrs}</tbody></table>`;
      editor.chain().focus().insertContent(html).run();
    }
    setTableGridOpen(false);
    setTableGridHovered(null);
    setTimeout(() => fireOnChangeRef.current(), 0);
  };

  const toggleTableHeaderRow = () => {
    if (!editor) return;
    try {
      if (editor.can().toggleHeaderRow()) editor.chain().focus().toggleHeaderRow().run();
    } catch {}
    setTimeout(() => fireOnChangeRef.current(), 0);
  };

  const mergeCurrentCells = () => {
    if (!editor) return;
    try { if (editor.can().mergeCells()) editor.chain().focus().mergeCells().run(); } catch {}
    setTimeout(() => fireOnChangeRef.current(), 0);
  };

  const splitCurrentCell = () => {
    if (!editor) return;
    try { if (editor.can().splitCell()) editor.chain().focus().splitCell().run(); } catch {}
    setTimeout(() => fireOnChangeRef.current(), 0);
  };

  const isImgAlignActive = (align: "left" | "center" | "right"): boolean => {
    const el = selectedImgElRef.current;
    if (!el) return false;
    const a = el.getAttribute("data-align");
    if (a) return a === align;
    if (align === "center") return el.style.marginLeft === "auto" && el.style.marginRight === "auto";
    if (align === "left") return el.style.cssFloat === "left";
    if (align === "right") return el.style.cssFloat === "right";
    return false;
  };

  // ========= TABLE EDITOR ADVANCED: BORDER STYLE / CELL BG / COL WIDTH / DELETE via INDEX (Visual Handle)
  const BORDER_COLOR_DEFAULT = "#cbd5e1"; // slate-300
  const applyTableBorderStyle = (preset: 0 | 1 | 2 | 3) => {
    const t = activeTableElRef.current;
    if (!t) return;
    const w = preset === 0 ? 0 : preset;
    const color = preset === 0 ? "transparent" : BORDER_COLOR_DEFAULT;
    const styleDecl = preset === 0 ? "none" : `${w}px solid ${color}`;
    const cells = t.querySelectorAll("td,th");
    cells.forEach((c) => {
      const el = c as HTMLElement;
      el.style.border = styleDecl;
      if (preset > 0) { el.style.borderWidth = `${w}px`; el.style.borderColor = color; el.style.borderStyle = "solid"; }
    });
    t.style.borderCollapse = "collapse";
    setTableBorderPreset(preset);
    setTimeout(() => fireOnChangeRef.current(), 0);
  };

  const applyCurrentCellBg = (color: string) => {
    if (!editor) return;
    const hc = hoveredCellRef.current;
    try {
      // Setiap sel set attribute data-bg (jika possible) atau set via inline style backgroundColor
      // Pakai setCellAttribute (jika command ada), jika tidak fallback style via DOM
      if ((editor.chain().focus() as any).setCellAttribute) {
        (editor.chain().focus() as any).setCellAttribute("backgroundColor", color).run();
      }
    } catch {}
    // DOM fallback (selalu apply, pasti work)
    const targetCell = hc?.cellEl ?? findActiveCellDom();
    if (targetCell) {
      if (color === "transparent" || color === "white" || color === "#ffffff") {
        targetCell.style.backgroundColor = "";
      } else {
        targetCell.style.backgroundColor = color;
      }
      setTimeout(() => fireOnChangeRef.current(), 0);
    }
  };

  const findActiveCellDom = (): HTMLTableCellElement | null => {
    if (!editor) return null;
    const from = editor.state.selection.from;
    try {
      const r: any = editor.view.domAtPos?.(from) ?? null;
      let el = r?.node as HTMLElement | null;
      if (el && (el as any).nodeType === 3) el = (el as any).parentElement;
      for (let i = 0; i < 10 && el; i++, el = el.parentElement) {
        if (el.tagName === "TD" || el.tagName === "TH") return el as HTMLTableCellElement;
      }
    } catch {}
    return hoveredCellRef.current?.cellEl ?? null;
  };

  const setColWidthPctByActiveTable = (pct: number | "auto") => {
    const hc = hoveredCellRef.current;
    if (!hc) return;
    const t = hc.tableEl;
    activeTableElRef.current = t;
    const tr = t.rows;
    if (!tr || !tr.length) return;
    const firstRow = tr[0];
    const totalCols = hc.totalCols;
    let base = pct === "auto" ? 0 : Math.round(pct * 10000) / 100;
    for (let i = 0; i < firstRow.cells.length; i++) {
      const c = firstRow.cells[i];
      if (pct === "auto") {
        c.style.width = "";
        c.style.minWidth = "";
      } else {
        if (i === hc.colIdx) {
          c.style.width = `${base}%`;
        } else if (hc.colIdx >= 0) {
          // Set sisa kolom merata jika belum punya width
          if (!c.style.width && totalCols > 1) {
            const rem = Math.round(((100 - base) / Math.max(1, totalCols - 1)) * 100) / 100;
            c.style.width = `${rem}%`;
          }
        }
      }
    }
    setTimeout(() => fireOnChangeRef.current(), 0);
  };

  const deleteRowByHandleIdx = (rowIdx: number) => {
    if (!editor || !activeTableElRef.current) return;
    try {
      // Set selection ke sel baris rowIdx, col 0 → panggil deleteRow()
      const t = activeTableElRef.current;
      const tr = t.rows[rowIdx];
      if (tr && tr.cells[0]) {
        // cara cepat: loop 30x triggger up/down tidak stabil.
        // PAKAI POS PROSEMIRROR: cari offset mulai cell di doc
        // Fallback andal: DOM tr.innerHTML = ""; kosongkan + set cursor before → addRowBefore → deleteRow berulang 2x.
        // Lebih mudah dan stabil: jika user klik handle DELETE di handle → tr.remove() + re-set content (TAPI RAPIH trigger undo).
        // Pilihan terbaik: set cell selection pada row target, lalu deleteRow command:
        const c0 = tr.cells[0] as HTMLElement;
        const pm = editor.view.posAtDOM?.(c0, 0) ?? 0;
        if (pm) {
          const tr_chain = editor.chain().focus(pm);
          if ((tr_chain as any).setCellSelection) (tr_chain as any).setCellSelection({ anchorCell: pm, headCell: pm });
          tr_chain.deleteRow().run();
        } else {
          editor.chain().focus().deleteRow().run();
        }
      }
    } catch {
      // Ultimate fallback DOM removal
      try {
        const t = activeTableElRef.current;
        if (t && t.rows[rowIdx]) t.rows[rowIdx].remove();
      } catch {}
    }
    setTimeout(() => fireOnChangeRef.current(), 0);
  };

  const deleteColByHandleIdx = (colIdx: number) => {
    if (!editor || !activeTableElRef.current) return;
    try {
      const t = activeTableElRef.current;
      const tr0 = t.rows[0];
      if (tr0 && tr0.cells[colIdx]) {
        const c0 = tr0.cells[colIdx] as HTMLElement;
        const pm = editor.view.posAtDOM?.(c0, 0) ?? 0;
        if (pm) {
          const tr_chain = editor.chain().focus(pm);
          if ((tr_chain as any).setCellSelection) (tr_chain as any).setCellSelection({ anchorCell: pm, headCell: pm });
          tr_chain.deleteColumn().run();
        } else {
          editor.chain().focus().deleteColumn().run();
        }
      }
    } catch {
      try {
        const t = activeTableElRef.current;
        if (!t) return;
        for (let r = 0; r < t.rows.length; r++) {
          if (t.rows[r].cells[colIdx]) t.rows[r].cells[colIdx].remove();
        }
      } catch {}
    }
    setTimeout(() => fireOnChangeRef.current(), 0);
  };

  const onFileImageChanged = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []) as File[];
    if (!files.length || !editor) return;
    files.forEach((f: File) => {
      if (!/^image\//i.test(f.type)) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result ?? "");
        if (!data) return;
        editor.chain().focus().setImage({ src: data, alt: f.name }).run();
        fireOnChange();
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const onDocxImportChanged = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !editor) return;
    try {
      const buf = await f.arrayBuffer();
      const res = await mammoth.convertToHtml(
        { arrayBuffer: buf },
        {
          styleMap: [
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Subtitle'] => h2:fresh",
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "r[style-name='Strong'] => strong",
            "r[style-name='Emphasis'] => em",
          ],
          convertImage: mammoth.images.imgElement((img: any) =>
            img.readAsDataUri().then((dataUri: any) => ({ src: dataUri })),
          ),
        },
      );
      const html =
        (res.value ?? "") +
        (res.messages?.length
          ? `<!-- mammoth: ${res.messages.map((m: any) => m.message).join(" | ")} -->`
          : "");
      editor.commands.setContent(html, { emitUpdate: false });
      fireOnChange();
      alert(`✅ Berhasil import ${f.name} — ${Math.round((f.size ?? 0) / 1024)}KB`);
    } catch (err) {
      console.error(err);
      alert(
        "❌ Gagal import .docx. File mungkin corrupt. Coba copy paste dari Word secara manual.",
      );
    }
  };

  const exportAsDocx = () => {
    if (!editor) return;
    const html = editor.getHTML();
    const dateStr = new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14);
    // Cara termudah export docx GRATIS tanpa library tambahan:
    // Bungkus HTML dengan MSO header → browser simpan sebagai .doc (bisa dibuka Word / WPS / LibreOffice).
    const blobHtml = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Export RPD PKS</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #0f172a; line-height: 1.5; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid #475569; padding: 6px 8px; }
  th { background: #f1f5f9; }
  img { max-width: 100%; }
  h1,h2,h3 { margin-top: 18px; margin-bottom: 8px; }
  h1 { font-size: 20pt; } h2 { 16pt; } h3 { 13pt; }
  mark { background: #fef08a !important; }
</style></head>
<body>${html}</body></html>`;
    const blob = new Blob(["\ufeff", blobHtml], {
      type: "application/msword",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dokumen-rpd-pks-${dateStr}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // ===========================
  //  PAGE SETUP MODAL HELPERS (COPY RTE existing)
  // ===========================
  const applyPresetQuick = (preset: PageSetupPreset) => {
    const p = PAGE_SETUP_PRESETS[preset];
    setDraftPaperKey(preset === "a4-landscape" ? "a4" : preset === "default" ? "custom" : "a4");
    setDraftWidthMm(Math.round((p.widthMm ?? 210) * 10) / 10);
    setDraftHeightMm(Math.round((p.heightMm ?? 297) * 10) / 10);
    setDraftOrientation(p.orientation ?? (preset === "a4-landscape" ? "landscape" : "portrait"));
    setDraftPaddingMm(Math.round((p.paddingMm ?? 14) * 10) / 10);
    setDraftMarginTMm(Math.round((p.marginTopMm ?? 12) * 10) / 10);
    setDraftMarginBMm(Math.round((p.marginBottomMm ?? 14) * 10) / 10);
    setDraftMarginLMm(Math.round((p.marginLeftMm ?? 12) * 10) / 10);
    setDraftMarginRMm(Math.round((p.marginRightMm ?? 12) * 10) / 10);
    setDraftShadow(Boolean(p.paperShadow));
    setDraftMarginCenter(Boolean(p.marginYAuto));
    setDraftBg(p.pageBg || "#ffffff");
  };

  const applyPaperSize = (
    key: keyof typeof PAPER_SIZE_DIM,
    orien: "portrait" | "landscape",
  ) => {
    setDraftPaperKey(key);
    const ps = PAPER_SIZE_DIM[key];
    if (key === "custom") {
      setDraftOrientation(orien);
      return;
    }
    let w = ps.w;
    let h = ps.h;
    if (orien === "landscape") {
      const tmp = w;
      w = h;
      h = tmp;
    }
    setDraftWidthMm(Math.round(w * 10) / 10);
    setDraftHeightMm(Math.round(h * 10) / 10);
    setDraftOrientation(orien);
  };

  const toggleOrientation = () => {
    setDraftOrientation((o) => {
      const next = o === "portrait" ? "landscape" : "portrait";
      setDraftWidthMm((curW) => {
        setDraftHeightMm(curW);
        return draftHeightMm;
      });
      return next;
    });
  };

  const applyPageSetupDraft = () => {
    const w = Math.max(30, Number(draftWidthMm) || 210);
    const h = Math.max(30, Number(draftHeightMm) || 297);
    const next: PageSetup = {
      preset: "custom" as PageSetupPreset,
      widthMm: w,
      heightMm: h,
      paddingMm: Math.max(0, Number(draftPaddingMm) || 0),
      paperShadow: draftShadow,
      marginYAuto: draftMarginCenter,
      pageBg: draftBg || "#ffffff",
      marginTopMm: Math.max(0, Number(draftMarginTMm) || 0),
      marginBottomMm: Math.max(0, Number(draftMarginBMm) || 0),
      marginLeftMm: Math.max(0, Number(draftMarginLMm) || 0),
      marginRightMm: Math.max(0, Number(draftMarginRMm) || 0),
      orientation: draftOrientation,
    };
    const candidates = PAGE_SETUP_PRESETS;
    for (const key of Object.keys(candidates) as PageSetupPreset[]) {
      if (key === "default") continue;
      const c = candidates[key];
      const near =
        Math.abs((c.widthMm ?? 0) - w) < 0.5 &&
        Math.abs((c.heightMm ?? 0) - h) < 0.5 &&
        Math.abs((c.paddingMm ?? 0) - next.paddingMm!) < 0.5 &&
        Boolean(c.paperShadow) === draftShadow &&
        Boolean(c.marginYAuto) === draftMarginCenter;
      if (near) {
        next.preset = key;
        break;
      }
    }
    onPageSetupChange?.(next);
    setPageSetupModalOpen(false);
  };

  const resetPageSetupDefault = () => onPageSetupChange?.({ preset: "default" });

  // =========================================================================
  //  RENDER TOOLBAR
  // =========================================================================
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {showToolbar && !readOnly ? (
        <div
          role="toolbar"
          aria-orientation="horizontal"
          className={cn(
            "flex flex-col border-b border-slate-200 bg-white",
            disabled ? "opacity-60 pointer-events-none" : "",
          )}
        >
          {/* ========= RIBBON TAB SWITCHER (WORD STYLE) ========= */}
          <div className="flex items-center gap-1 px-3 pt-2 border-b border-slate-200 bg-slate-50/60">
            {([
              { key: "home", label: "🏠 Beranda", tip: "Format teks, heading, paragraf, daftar" },
              { key: "insert", label: "➕ Sisipkan", tip: "Tautan, gambar, tabel, pemisah, page break" },
              { key: "layout", label: "⚙️ Tata Letak & File", tip: "Pengaturan halaman, Import/Export Word" },
            ] as const).map((t) => (
              <button
                key={t.key}
                type="button"
                title={t.tip}
                onClick={() => setActiveRibbon(t.key)}
                className={cn(
                  "px-3 h-8 rounded-t-md text-xs font-medium border-x border-t border-transparent transition",
                  activeRibbon === t.key
                    ? "bg-white border-slate-200 text-slate-900 shadow-[0_1px_0_0_#fff_inset] -mb-px"
                    : "text-slate-600 hover:bg-white/50 hover:text-slate-800",
                )}
              >
                {t.label}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2 pr-1 pb-1">
              <span className="text-[11px] text-slate-500 italic">
                Tips: <code className="font-mono text-[10px] bg-white rounded border border-slate-200 px-1">{`{{nama_sekolah}}`}</code>
              </span>
            </div>
          </div>

          {/* ========= RIBBON CONTENT ========= */}
          <div className="flex flex-wrap items-center gap-1 px-2 py-2 bg-white min-h-[52px]">
            {activeRibbon === "home" ? (
              <>
                {/* HOME GROUP 0: UNDO / REDO / MODE TOGGLE */}
                <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
                  <Tb title="Undo (Ctrl+Z)" onClick={() => { editor?.chain().focus().undo().run(); }} disabled={!editor?.can().undo() || sourceMode}>
                    <Undo2 className="h-4 w-4" />
                  </Tb>
                  <Tb title="Redo (Ctrl+Shift+Z)" onClick={() => { editor?.chain().focus().redo().run(); }} disabled={!editor?.can().redo() || sourceMode}>
                    <Redo2 className="h-4 w-4" />
                  </Tb>
                  {showHtmlSourceToggle && !readOnly ? (
                    <>
                      <div className="w-px h-5 bg-slate-200 mx-0.5" />
                      {sourceMode ? (
                        <>
                          <Tb onClick={() => exitSourceMode(false)} title="✅ Terapkan & Keluar: simpan perubahan HTML ke editor visual (validasi tag otomatis)" className="!text-emerald-700 !bg-emerald-50/70 !font-bold">
                            ✅ Terapkan HTML
                          </Tb>
                          <Tb onClick={formatSourceHtmlNow} title="🎨 Format Rapi: indentasi tag HTML agar mudah dibaca">
                            🎨 Format
                          </Tb>
                          <Tb onClick={() => exitSourceMode(true)} title="❌ Batal: buang semua perubahan di sumber HTML, kembali ke editor visual" className="!text-rose-700 !bg-rose-50/60">
                            ❌ Batal
                          </Tb>
                        </>
                      ) : (
                        <Tb onClick={enterSourceMode} title="🔄 Lihat & Edit Sumber HTML/CSS Mentah — cocok untuk edit tabel kompleks / styling inline yang susah pakai toolbar" className="!text-indigo-700 !bg-indigo-50/60 !font-semibold">
                          🔄 Sumber HTML
                        </Tb>
                      )}
                    </>
                  ) : null}
                </div>
                {/* HOME GROUP 1: HEADINGS + PARAGRAPH */}
                <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
                  <Tb title="Heading 1" onClick={() => { editor?.chain().focus().toggleHeading({ level: 1 }).run(); }} active={editor?.isActive("heading", { level: 1 }) ?? false}>
                    <Heading1 className="h-4 w-4" />
                  </Tb>
                  <Tb title="Heading 2" onClick={() => { editor?.chain().focus().toggleHeading({ level: 2 }).run(); }} active={editor?.isActive("heading", { level: 2 }) ?? false}>
                    <Heading2 className="h-4 w-4" />
                  </Tb>
                  <Tb title="Heading 3" onClick={() => { editor?.chain().focus().toggleHeading({ level: 3 }).run(); }} active={editor?.isActive("heading", { level: 3 }) ?? false}>
                    <Heading3 className="h-4 w-4" />
                  </Tb>
                  <Tb title="Paragraph Biasa" onClick={() => { editor?.chain().focus().setParagraph().run(); }} active={(editor?.isActive("paragraph") && !(editor?.isActive("heading") ?? false)) ?? false}>
                    <span className="text-[11px] font-bold">¶</span>
                  </Tb>
                </div>
                {/* HOME GROUP 2: INLINE STYLE + HIGHLIGHT + COLOR */}
                <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
                  <Tb title="Tebal (Ctrl+B)" onClick={() => { editor?.chain().focus().toggleBold().run(); }} active={editor?.isActive("bold") ?? false}>
                    <Bold className="h-4 w-4" />
                  </Tb>
                  <Tb title="Miring (Ctrl+I)" onClick={() => { editor?.chain().focus().toggleItalic().run(); }} active={editor?.isActive("italic") ?? false}>
                    <Italic className="h-4 w-4" />
                  </Tb>
                  <Tb title="Garis bawah (Ctrl+U)" onClick={() => { editor?.chain().focus().toggleUnderline().run(); }} active={editor?.isActive("underline") ?? false}>
                    <UnderlineIcon className="h-4 w-4" />
                  </Tb>
                  <Tb title="Strikethrough" onClick={() => { editor?.chain().focus().toggleStrike().run(); }} active={editor?.isActive("strike") ?? false}>
                    <span className="text-[11px] font-bold line-through">S</span>
                  </Tb>
                  <Tb title="Highlight Kuning" onClick={() => { editor?.chain().focus().toggleHighlight({ color: "#fef08a" }).run(); }} active={editor?.isActive("highlight") ?? false}>
                    <Palette className="h-4 w-4" />
                  </Tb>
                  {/* Inline Color Picker */}
                  <div className="relative">
                    <Tb title="Warna Teks (klik buka palet)" onClick={() => setTextColorOpen((v) => !v)} active={editor?.isActive("textStyle") ?? false}>
                      <span className="h-4 w-4 inline-block rounded border border-slate-300 bg-gradient-to-br from-rose-500 via-emerald-500 to-indigo-600" />
                    </Tb>
                    {textColorOpen ? (
                      <div className="absolute left-0 top-9 z-30 rounded-xl border border-slate-200 bg-white p-2 shadow-xl grid grid-cols-5 gap-1.5 w-[210px]">
                        {[
                          "#0f172a", "#334155", "#64748b", "#ef4444", "#dc2626",
                          "#f97316", "#f59e0b", "#eab308", "#84cc16", "#22c55e",
                          "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
                          "#6366f1", "#8b5cf6", "#d946ef", "#ec4899", "#ffffff",
                        ].map((c) => (
                          <button
                            key={c}
                            type="button"
                            title={c}
                            onClick={() => {
                              editor?.chain().focus().setColor(c).run();
                              setTextColorOpen(false);
                            }}
                            className="h-7 w-7 rounded-md border border-slate-200 shadow-sm hover:scale-105 transition"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <button
                          type="button"
                          className="col-span-5 h-7 rounded-md border border-slate-200 text-[11px] text-slate-600 hover:bg-slate-50"
                          onClick={() => { editor?.chain().focus().unsetColor().run(); setTextColorOpen(false); }}
                        >
                          Hapus Warna
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <Tb title="Hapus Format (Clear)" onClick={() => { editor?.chain().focus().unsetAllMarks().clearNodes().run(); }}>
                    <Eraser className="h-4 w-4" />
                  </Tb>
                </div>
                {/* HOME GROUP 3: ALIGN (4 arah) */}
                <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
                  <Tb title="Rata kiri" onClick={() => { editor?.chain().focus().setTextAlign("left").run(); }} active={editor?.isActive({ textAlign: "left" }) ?? false}>
                    <AlignLeft className="h-4 w-4" />
                  </Tb>
                  <Tb title="Rata tengah" onClick={() => { editor?.chain().focus().setTextAlign("center").run(); }} active={editor?.isActive({ textAlign: "center" }) ?? false}>
                    <AlignCenter className="h-4 w-4" />
                  </Tb>
                  <Tb title="Rata kanan" onClick={() => { editor?.chain().focus().setTextAlign("right").run(); }} active={editor?.isActive({ textAlign: "right" }) ?? false}>
                    <AlignRight className="h-4 w-4" />
                  </Tb>
                  <Tb title="Rata kanan-kiri (Justify)" onClick={() => { editor?.chain().focus().setTextAlign("justify").run(); }} active={editor?.isActive({ textAlign: "justify" }) ?? false}>
                    <AlignJustify className="h-4 w-4" />
                  </Tb>
                </div>
                {/* HOME GROUP 4: LIST + TASK */}
                <div className="flex items-center gap-0.5">
                  <Tb title="Daftar bullet" onClick={() => { editor?.chain().focus().toggleBulletList().run(); }} active={editor?.isActive("bulletList") ?? false}>
                    <List className="h-4 w-4" />
                  </Tb>
                  <Tb title="Daftar nomor" onClick={() => { editor?.chain().focus().toggleOrderedList().run(); }} active={editor?.isActive("orderedList") ?? false}>
                    <ListOrdered className="h-4 w-4" />
                  </Tb>
                  <Tb title="Task List (Checklist)" onClick={() => { editor?.chain().focus().toggleTaskList().run(); }} active={editor?.isActive("taskList") ?? false}>
                    <ListTodo className="h-4 w-4" />
                  </Tb>
                </div>
              </>
            ) : activeRibbon === "insert" ? (
              <>
                {/* INSERT GROUP -1: TEMPLATE DEFAULT (solve: user ga bisa bikin tabel/gambar dr nol) */}
                <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
                  {defaultTemplateHtml ? (
                    <Tb
                      title="📄 Muat Template Default (TABEL, HEADING, DAN PLACEHOLDER SIAP PAKAI! — Tidak perlu bikin tabel / gambar dari nol)"
                      onClick={loadDefaultTemplate}
                      className="!h-8 !w-auto !px-2.5 !text-xs !font-bold !text-indigo-700 !bg-indigo-50/60 !border-indigo-200/80 hover:!bg-indigo-100"
                    >
                      <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                      Muat Template
                    </Tb>
                  ) : null}
                  {replaceFieldMap && Object.keys(replaceFieldMap).length > 0 ? (
                    <Tb
                      title="🔁 Terapkan Placeholder Sekarang (isi {{nama_sekolah}} dll otomatis)"
                      onClick={applyPlaceholdersNow}
                      className="!h-8 !w-auto !px-2 !text-[11px] !font-semibold !text-emerald-700 !bg-emerald-50/70 !border-emerald-200/80 hover:!bg-emerald-100"
                    >
                      🔁 Isi Placeholder
                    </Tb>
                  ) : null}
                </div>
                {/* INSERT GROUP 0: LINK */}
                <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
                  <Tb title="Sisipkan tautan (Link)" onClick={() => {
                    const prev = editor?.getAttributes("link").href as string | undefined;
                    const url =
                      window.prompt("Masukkan URL tautan:", prev ?? "https://")?.trim() ?? "";
                    if (!url) return;
                    editor
                      ?.chain()
                      .focus()
                      .extendMarkRange("link")
                      .setLink({ href: url, target: "_blank", rel: "noopener noreferrer" })
                      .run();
                  }} active={editor?.isActive("link") ?? false}>
                    <Link2 className="h-4 w-4" />
                  </Tb>
                  <Tb title="Hapus tautan" onClick={() => { editor?.chain().focus().unsetLink().run(); }}>
                    <Unlink className="h-4 w-4" />
                  </Tb>
                </div>
                {/* INSERT GROUP 1: IMAGE */}
                <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
                  {showImageUploadButton ? (
                    <Tb title="Upload & sisipkan gambar (JPG/PNG/WebP) — BISA DRAG & DROP langsung ke editor! DOUBLE KLIK gambar untuk atur lebar px." onClick={triggerUploadImage}>
                      <ImageIcon className="h-4 w-4" />
                    </Tb>
                  ) : null}
                  <Tb title="Ganti baris (Shift+Enter)" onClick={insertHardBreak}>
                    <span className="text-[11px] font-bold leading-none">↩</span>
                  </Tb>
                </div>
                {/* INSERT GROUP 2: HR + PAGE BREAK */}
                <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
                  <Tb title="Sisipkan Garis Pemisah (Horizontal Rule)" onClick={() => { editor?.chain().focus().setHorizontalRule().run(); }}>
                    <PlusSquare className="h-4 w-4" />
                  </Tb>
                  <Tb title="SISIPKAN PEMISAH HALAMAN (Page Break) — di saat print, konten setelah ini PINDAH HALAMAN BARU" onClick={insertPageBreak}>
                    <SplitSquareVertical className="h-4 w-4 text-indigo-700" />
                  </Tb>
                </div>
                {/* INSERT GROUP 3: TABLE — GRID INSERT POPOVER (mirip Tiptap TableTriggerButton UI Component) + TABLE OPS CURSOR DI DALAM TABEL */}
                <div className="flex items-center gap-0.5 pr-1.5 mr-1 relative">
                  {/* Trigger Table Grid Popover */}
                  <div className="relative inline-block" data-table-grid-popover>
                    <Tb
                      title="Sisipkan tabel — geser untuk pilih N baris × N kolom (max 8x8)"
                      onClick={() => setTableGridOpen((o) => !o)}
                      active={(editor?.isActive("table") ?? false) || tableGridOpen}
                    >
                      <TableIcon className="h-4 w-4" />
                    </Tb>
                    {tableGridOpen ? (
                      <div className="absolute z-40 left-0 top-full mt-2 rounded-lg border border-slate-200 bg-white shadow-xl p-3 w-[258px]">
                        <div className="text-[11.5px] font-semibold text-slate-600 mb-2 pl-1.5">
                          {tableGridHovered
                            ? `${tableGridHovered.r} baris × ${tableGridHovered.c} kolom — klik untuk insert`
                            : "Pilih ukuran tabel 8×8 (klik untuk insert)"}
                        </div>
                        <div className="grid grid-cols-8 gap-1.5 pl-1 pr-1">
                          {Array.from({ length: 8 * 8 }).map((_, i) => {
                            const row = Math.floor(i / 8) + 1;
                            const col = (i % 8) + 1;
                            const hovered = tableGridHovered;
                            const selected = hovered && row <= hovered.r && col <= hovered.c;
                            return (
                              <div
                                key={`${row}-${col}`}
                                role="button"
                                tabIndex={0}
                                onMouseEnter={() => setTableGridHovered({ r: row, c: col })}
                                onClick={() => insertTableGrid(row, col)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") insertTableGrid(row, col);
                                }}
                                className={cn(
                                  "h-5 w-5 rounded-[3px] border transition-all cursor-pointer",
                                  selected
                                    ? "bg-indigo-500 border-indigo-600 shadow-[0_0_0_1px_#a5b4fc_inset]"
                                    : "bg-white border-slate-300 hover:border-indigo-400 hover:bg-indigo-50",
                                )}
                              />
                            );
                          })}
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between pl-1 pr-1">
                          <span className="text-[10.5px] text-slate-500">Atau: Cepat 3×3 dengan header</span>
                          <button
                            type="button"
                            className="rounded px-2 h-7 text-[11px] font-medium border border-slate-200 hover:bg-slate-50"
                            onClick={() => insertTableGrid(3, 3)}
                          >
                            3×3 Cepat
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {/* CURSOR INSIDE TABLE CONTEXT BUTTONS */}
                  {editor?.isActive("table") ? (
                    <>
                      <Tb title="Tambah baris di ATAS cursor" onClick={() => editor.chain().focus().addRowBefore().run()}>
                        <span className="text-[10px] font-bold leading-none">⬆R</span>
                      </Tb>
                      <Tb title="Tambah baris DI BAWAH cursor" onClick={() => editor.chain().focus().addRowAfter().run()}>
                        <span className="text-[10px] font-bold leading-none">R⬇</span>
                      </Tb>
                      <Tb title="Tambah kolom KIRI cursor" onClick={() => editor.chain().focus().addColumnBefore().run()}>
                        <span className="text-[10px] font-bold leading-none">⬅C</span>
                      </Tb>
                      <Tb title="Tambah kolom KANAN cursor" onClick={() => editor.chain().focus().addColumnAfter().run()}>
                        <span className="text-[10px] font-bold leading-none">C➡</span>
                      </Tb>
                      <Tb title="Gabungkan sel yang di-select (Merge cells)" onClick={mergeCurrentCells}>
                        <span className="text-[10px] font-semibold leading-none text-indigo-700">M✳</span>
                      </Tb>
                      <Tb title="Pisahkan sel yang digabung (Split cell)" onClick={splitCurrentCell}>
                        <span className="text-[10px] font-semibold leading-none text-indigo-600">✂⧈</span>
                      </Tb>
                      <Tb title="TOGGLE baris pertama jadi HEADER / bukan" onClick={toggleTableHeaderRow} active={false}>
                        <span className="text-[10px] font-bold leading-none">🟦H</span>
                      </Tb>
                      <Tb title="Hapus BARIS ini" onClick={() => editor.chain().focus().deleteRow().run()}>
                        <span className="text-[10px] font-bold text-rose-600 leading-none">R-</span>
                      </Tb>
                      <Tb title="Hapus KOLOM ini" onClick={() => editor.chain().focus().deleteColumn().run()}>
                        <span className="text-[10px] font-bold text-rose-600 leading-none">C-</span>
                      </Tb>
                      <Tb title="HAPUS SELURUH TABEL" onClick={() => editor.chain().focus().deleteTable().run()}>
                        <Trash2 className="h-4 w-4 text-rose-600" />
                      </Tb>
                    </>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                {/* LAYOUT GROUP 0: UNDO / REDO (always accessible) */}
                <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
                  <Tb title="Undo (Ctrl+Z)" onClick={() => { editor?.chain().focus().undo().run(); }} disabled={!editor?.can().undo()}>
                    <Undo2 className="h-4 w-4" />
                  </Tb>
                  <Tb title="Redo (Ctrl+Shift+Z)" onClick={() => { editor?.chain().focus().redo().run(); }} disabled={!editor?.can().redo()}>
                    <Redo2 className="h-4 w-4" />
                  </Tb>
                </div>
                {/* LAYOUT GROUP 1: PAGE SETUP */}
                <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
                  {showPageSetupButton && onPageSetupChange ? (
                    <>
                      <Tb title={`Buka Pengaturan Halaman (Page Setup): ${paperSizeLabel}`} onClick={() => setPageSetupModalOpen(true)} active={resolvedPage.preset !== "default"}>
                        <Settings className="h-4 w-4" />
                      </Tb>
                      {resolvedPage.preset !== "default" ? (
                        <Tb title="Kembalikan ke Default (tanpa kertas)" onClick={resetPageSetupDefault}>
                          <RotateCcw className="h-4 w-4" />
                        </Tb>
                      ) : null}
                    </>
                  ) : null}
                  {showPageSetupButton ? (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded border px-2 py-1 text-[10.5px] cursor-pointer select-none h-8",
                        resolvedPage.preset === "default"
                          ? "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                          : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
                      )}
                      onClick={() => onPageSetupChange ? setPageSetupModalOpen(true) : undefined}
                      title={`Page layout: ${paperSizeLabel} — klik untuk buka modal custom`}
                    >
                      <LayoutDashboard className="h-3 w-3" />
                      {resolvedPage.preset === "default" ? "Default" : paperSizeLabel}
                    </span>
                  ) : null}
                </div>
                {/* LAYOUT GROUP 2: IMPORT / EXPORT DOCX */}
                <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
                  {showDocxIoButtons ? (
                    <>
                      <Tb title="📥 Import .docx (Unggah file Word -> convert ke HTML otomatis) (PKS 21 halaman AMAN)" onClick={triggerImportDocx}>
                        <FileUp className="h-4 w-4 text-indigo-700" />
                      </Tb>
                      <Tb title="📤 Export .doc (Download file Word untuk print / edit offline)" onClick={exportAsDocx}>
                        <FileDown className="h-4 w-4 text-emerald-700" />
                      </Tb>
                    </>
                  ) : null}
                  {showImageUploadButton ? (
                    <label
                      className="inline-flex items-center gap-1 text-[11px] text-slate-600 h-8 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer"
                      title="Upload gambar (klik untuk pilih file)"
                    >
                      <FileImage className="h-3.5 w-3.5" />
                      <span>Gambar</span>
                    </label>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* CONTENT WRAPPER PAPER + SCROLLABLE WORK SURFACE (WORD-LIKE VISUAL PAGINATION) */}
      <div
        ref={paperWrapperRef}
        style={wrapperBgStyle}
        className={cn(
          "relative w-full",
          resolvedPage.preset !== "default"
            ? "tpt-paper-surface bg-[#e5e9f0] border-t border-slate-200 overflow-y-auto max-h-[82vh]"
            : "bg-white",
        )}
      >
        <div className={cn(resolvedPage.preset !== "default" ? "px-3 py-5 sm:px-6 sm:py-6 md:px-10" : "")}>
          <div
            style={pageContainerStyle}
            className={cn(
              resolvedPage.preset !== "default"
                ? "border border-slate-300/80 relative tpt-a4-page mx-auto"
                : "relative",
            )}
          >
            {sourceMode ? (
              <div className="relative w-full">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-[#0f172a]/90 text-[11px] text-slate-200 rounded-t-md -mx-2 -mt-2 mb-2 w-[calc(100%+1rem)]">
                  <span className="font-semibold uppercase tracking-wider text-emerald-300">Mode: Sumber HTML/CSS Mentah</span>
                  <span className="text-slate-400">•</span>
                  <span>Semua perubahan disimpan ke body_html (sama dengan editor visual). Tag <code className="font-mono bg-slate-700 px-1 rounded">style=""</code> inline akan otomatis ter-apply.</span>
                  <span className="ml-auto text-slate-300">
                    Panjang: <code className="font-mono">{(sourceHtml ?? "").length}</code> karakter
                  </span>
                </div>
                <textarea
                  value={sourceHtml}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSourceHtml(v);
                    if (onChange) onChange(v);
                  }}
                  onBlur={() => {
                    if (sourceHtml !== (value ?? "")) {
                      onChange(sourceHtml);
                    }
                  }}
                  spellCheck={false}
                  disabled={disabled || readOnly}
                  placeholder={
                    placeholder ??
                    `Contoh tabel manual yang bisa kamu paste disini:\n\n<table style="border-collapse:collapse;width:100%">\n  <thead>\n    <tr style="background:#f1f5f9">\n      <th style="border:1px solid #94a3b8;padding:8px">Kolom 1</th>\n      <th style="border:1px solid #94a3b8;padding:8px">Kolom 2</th>\n    </tr>\n  </thead>\n  <tbody>\n    <tr>\n      <td style="border:1px solid #94a3b8;padding:8px">Isi baris 1 kolom 1</td>\n      <td style="border:1px solid #94a3b8;padding:8px">Isi baris 1 kolom 2</td>\n    </tr>\n  </tbody>\n</table>\n\nKlik tombol ✅ Terapkan HTML di Ribbon 🏠 Beranda untuk kembali ke editor visual TipTap.`
                  }
                  className="w-full font-mono text-[12.5px] leading-6 bg-[#0b1120] text-[#e2e8f0] p-4 rounded-md border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/40 shadow-inner resize-y"
                  style={{ minHeight }}
                />
              </div>
            ) : (
              <>
                <EditorContent
                  editor={editor}
                  className="relative"
                  style={{ minHeight }}
                />
                {placeholder && editor?.isEmpty ? (
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 px-4 pt-3 text-sm text-slate-400",
                      editorClassName,
                    )}
                    style={{ minHeight }}
                    aria-hidden="true"
                  >
                    {placeholder}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* ========= BUBBLE MENU GAMBAR (STABLE CLICK-BASED — NO DRAG LISTENER) ========= */}
        {imgBubbleVisible && imgBubblePos ? (
          <div
            data-img-bubble-root
            className="absolute z-50 bg-white border border-slate-300 rounded-xl shadow-2xl p-1.5 flex items-center gap-1"
            style={{
              top: imgBubblePos.top,
              left: Math.max(4, Math.min(imgBubblePos.left, (imgBubblePos.maxLeft || 800) - 540)),
            }}
          >
            <span className="text-[10px] text-slate-500 uppercase tracking-wider px-1.5 font-semibold shrink-0">
              Ukuran
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs shrink-0"
              onClick={() => applyImgStyle({ widthPct: 0.33 })}
              title="Lebar 33% container (1/3 halaman)"
            >
              33%
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs shrink-0"
              onClick={() => applyImgStyle({ widthPct: 0.5 })}
              title="Lebar 50% container (1/2 halaman)"
            >
              50%
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs shrink-0"
              onClick={() => applyImgStyle({ widthPct: 0.75 })}
              title="Lebar 75% container"
            >
              75%
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs shrink-0"
              onClick={() => applyImgStyle({ widthPct: 1.0 })}
              title="Lebar PENUH container (100%)"
            >
              100%
            </Button>
            <div className="w-px h-6 bg-slate-300 mx-1 shrink-0" />
            <Tb
              title="Rata Kiri — Alt+Shift+L"
              onClick={() => applyImgStyle({ align: "left" })}
              active={isImgAlignActive("left")}
            >
              <AlignLeft size={14} />
            </Tb>
            <Tb
              title="Rata Tengah — Alt+Shift+E"
              onClick={() => applyImgStyle({ align: "center" })}
              active={isImgAlignActive("center")}
            >
              <AlignCenter size={14} />
            </Tb>
            <Tb
              title="Rata Kanan — Alt+Shift+R"
              onClick={() => applyImgStyle({ align: "right" })}
              active={isImgAlignActive("right")}
            >
              <AlignRight size={14} />
            </Tb>
            <div className="w-px h-6 bg-slate-300 mx-1 shrink-0" />
            <Tb
              title="Hapus gambar ini"
              onClick={() => applyImgStyle({ del: true })}
              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 size={14} />
            </Tb>
            <button
              type="button"
              className="ml-1 inline-flex items-center justify-center h-7 w-7 rounded-md border border-transparent text-slate-500 hover:bg-slate-100 shrink-0"
              aria-label="Tutup bubble gambar"
              title="Tutup menu"
              onClick={() => {
                setImgBubbleVisible(false);
                selectedImgElRef.current = null;
              }}
            >
              <XCircle size={16} />
            </button>
          </div>
        ) : null}

        {/* ========= TABLE NODE DIY REPLIKA TABLE-EXTEND-BAR (mirip TableExtendRowColumnButtons official) + MERGE-SPLIT + HEADER ======= */}
        {tableContextVisible && tableContextPos ? (
          <div
            data-table-context-root
            className="absolute z-30 rounded-xl border border-indigo-200 bg-gradient-to-b from-white to-indigo-50 shadow-[0_10px_30px_rgba(99,102,241,0.16)] px-1.5 py-2 flex flex-wrap items-center gap-0.5 max-w-full"
            style={{
              top: `${tableContextPos.top}px`,
              left: `${tableContextPos.left}px`,
              maxWidth: `${tableContextPos.maxW}px`,
              animation: "tpt-bubble-in 110ms ease-out both",
            }}
          >
            <span className="mr-1 pl-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-indigo-700 whitespace-nowrap">Tabel</span>
            <Tb title="Tambah baris ATAS" onClick={() => editor?.chain().focus().addRowBefore().run()} className="whitespace-nowrap">
              <span className="text-[10px] font-bold leading-none">⬆R</span>
            </Tb>
            <Tb title="Tambah baris DI BAWAH" onClick={() => editor?.chain().focus().addRowAfter().run()} className="whitespace-nowrap">
              <span className="text-[10px] font-bold leading-none">R⬇</span>
            </Tb>
            <Tb title="Tambah kolom KIRI" onClick={() => editor?.chain().focus().addColumnBefore().run()} className="whitespace-nowrap">
              <span className="text-[10px] font-bold leading-none">⬅C</span>
            </Tb>
            <Tb title="Tambah kolom KANAN" onClick={() => editor?.chain().focus().addColumnAfter().run()} className="whitespace-nowrap">
              <span className="text-[10px] font-bold leading-none">C➡</span>
            </Tb>

            {/* NEW GROUP 1: GARIS (BORDER WIDTH) — PILIH: Tanpa Garis / Tipis 1px / Sedang 2px / Tebal 3px */}
            <div className="w-px h-6 bg-indigo-200 mx-1.5 shrink-0" />
            <span className="mr-1 pl-0.5 text-[10px] font-bold text-slate-700 whitespace-nowrap">Garis:</span>
            <Tb
              title={`${tableBorderPreset === 0 ? "✓" : ""} Tanpa Garis (hapus semua border sel tabel)`}
              active={tableBorderPreset === 0}
              onClick={() => applyTableBorderStyle(0)}
              className="whitespace-nowrap px-2"
            >
              <span className="text-[10.5px] font-bold leading-none">🟰 NONE</span>
            </Tb>
            <Tb
              title={`${tableBorderPreset === 1 ? "✓" : ""} Garis TIPIS 1px`}
              active={tableBorderPreset === 1}
              onClick={() => applyTableBorderStyle(1)}
              className="whitespace-nowrap px-2"
            >
              <span className="text-[10.5px] font-bold leading-none">╌ TIPIS</span>
            </Tb>
            <Tb
              title={`${tableBorderPreset === 2 ? "✓" : ""} Garis SEDANG 2px (sering dipakai cetak resmi)`}
              active={tableBorderPreset === 2}
              onClick={() => applyTableBorderStyle(2)}
              className="whitespace-nowrap px-2"
            >
              <span className="text-[10.5px] font-bold leading-none text-indigo-700">╘ SEDANG</span>
            </Tb>
            <Tb
              title={`${tableBorderPreset === 3 ? "✓" : ""} Garis TEBAL 3px (garis jelas buat kolom header)`}
              active={tableBorderPreset === 3}
              onClick={() => applyTableBorderStyle(3)}
              className="whitespace-nowrap px-2"
            >
              <span className="text-[10.5px] font-black leading-none text-indigo-800">╏ TEBAL</span>
            </Tb>

            <div className="w-px h-6 bg-indigo-200 mx-1.5 shrink-0" />
            <Tb title="Gabung sel (Merge)" onClick={mergeCurrentCells} className="whitespace-nowrap">
              <span className="text-[10.5px] font-bold leading-none text-indigo-700">⧉ Merge</span>
            </Tb>
            <Tb title="Pisahkan sel (Split)" onClick={splitCurrentCell} className="whitespace-nowrap">
              <span className="text-[10.5px] font-bold leading-none text-indigo-600">✂ Split</span>
            </Tb>
            <Tb title="Toggle HeaderRow ON/OFF" onClick={toggleTableHeaderRow} className="whitespace-nowrap">
              <span className="text-[10.5px] font-bold leading-none text-indigo-700">🟦 H</span>
            </Tb>

            {/* NEW GROUP 2: WARNA BACKGROUND SEL (8 chip warna) */}
            <div className="w-px h-6 bg-slate-300 mx-1.5 shrink-0" />
            <span className="mr-1 pl-0.5 text-[10px] font-bold text-slate-700 whitespace-nowrap">Warna sel:</span>
            {[
              { c: "#ffffff", n: "Putih" },
              { c: "#f8fafc", n: "Abu soft" },
              { c: "#fef3c7", n: "Kuning" },
              { c: "#dcfce7", n: "Hijau soft" },
              { c: "#dbeafe", n: "Biru soft" },
              { c: "#ffe4e6", n: "Merah soft" },
              { c: "#ede9fe", n: "Ungu soft" },
              { c: "#ffedd5", n: "Oranye" },
            ].map(({ c, n }) => (
              <button
                key={c}
                type="button"
                title={`Warna latar sel: ${n} — klik untuk terapkan ke sel aktif / sel yang di-hover`}
                onClick={() => applyCurrentCellBg(c)}
                className="h-6 w-6 rounded-md border border-slate-300 shadow-sm shrink-0 transition hover:scale-110 hover:shadow-md hover:border-slate-500 active:scale-95"
                style={{ background: c }}
                aria-label={`Background ${n}`}
              />
            ))}

            {/* NEW GROUP 3: LEBAR KOLOM (jika punya cell yang di-hover/di-cursor */}
            {hoveredCellRef.current ? (
              <>
                <div className="w-px h-6 bg-slate-300 mx-1.5 shrink-0" />
                <span className="mr-1 pl-0.5 text-[10px] font-bold text-slate-700 whitespace-nowrap">Lebar Kolom: <span className="text-indigo-700">{COL_LABELS[Math.min(hoveredCellRef.current.colIdx, 25)] ?? (hoveredCellRef.current.colIdx + 1)}</span>:</span>
                {([
                  { k: 0.25, n: "25%" },
                  { k: 0.3333, n: "33%" },
                  { k: 0.5, n: "50%" },
                  { k: 0.75, n: "75%" },
                  { k: 1, n: "100%" },
                  { k: "auto", n: "Auto" },
                ] as { k: number | "auto"; n: string }[]).map(({ k, n }) => (
                  <Tb
                    key={n}
                    title={`Atur lebar KOLOM ${COL_LABELS[Math.min(hoveredCellRef.current?.colIdx ?? 0, 25)]} = ${n}`}
                    onClick={() => setColWidthPctByActiveTable(k)}
                    className="whitespace-nowrap px-1.5"
                  >
                    <span className="text-[10px] font-bold leading-none">{n}</span>
                  </Tb>
                ))}
              </>
            ) : null}

            {/* GROUP HAPUS */}
            <div className="w-px h-6 bg-rose-200 mx-1.5 shrink-0" />
            <Tb title="Hapus BARIS ini" onClick={() => editor?.chain().focus().deleteRow().run()} className="whitespace-nowrap">
              <span className="text-[10.5px] font-bold text-rose-600 leading-none">Del R</span>
            </Tb>
            <Tb title="Hapus KOLOM ini" onClick={() => editor?.chain().focus().deleteColumn().run()} className="whitespace-nowrap">
              <span className="text-[10.5px] font-bold text-rose-600 leading-none">Del C</span>
            </Tb>
            <Tb title="HAPUS SELURUH TABEL" onClick={() => editor?.chain().focus().deleteTable().run()} className="whitespace-nowrap">
              <Trash2 size={13} className="text-rose-600" />
            </Tb>
          </div>
        ) : null}

        {/* ============= ROW HANDLE VISUAL (LEFT MARGIN LUAR KERTAS): Badge Nomor Baris + DEL ROW — PILIH HAPUS ROW MANA! ============= */}
        {hoveredCellRef.current && paperWrapperRef.current ? (() => {
          const hc = hoveredCellRef.current;
          activeTableElRef.current = hc.tableEl;
          const wrapRect = paperWrapperRef.current.getBoundingClientRect();
          const cellRect = hc.cellEl.getBoundingClientRect();
          // Row handle: kiri luar kertas, height = cell height, posisi top = cell top relative wrapper
          const h = Math.max(20, cellRect.height);
          const top = cellRect.top - wrapRect.top;
          const left = Math.max(2, cellRect.left - wrapRect.left - 44);
          const rowLabel = String(hc.rowIdx + 1);
          return (
            <div
              data-row-handle-root
              className="absolute z-40 select-none pointer-events-auto flex items-stretch gap-1"
              style={{
                top: `${top}px`,
                left: `${left}px`,
                height: `${h}px`,
                animation: "tpt-bubble-in 90ms ease-out both",
              }}
            >
              <button
                type="button"
                className="group rounded-l-lg border-2 border-indigo-400 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white text-[11px] font-bold min-w-[26px] px-2 shadow-[0_6px_14px_rgba(99,102,241,0.32)] flex items-center justify-center whitespace-nowrap"
                title={`BARIS ${rowLabel} ← HOVER menunjukkan BARIS INI. Klik 🔴 DEL di kanan badge ini untuk HAPUS BARIS ${rowLabel}`}
              >
                <span className="drop-shadow">{rowLabel}</span>
              </button>
              <button
                type="button"
                className="rounded-r-lg border-2 border-rose-400 bg-gradient-to-br from-rose-500 to-rose-700 text-white text-[10px] font-black px-1.5 shadow-[0_6px_14px_rgba(244,63,94,0.32)] hover:brightness-110 active:scale-95"
                title={`🔥 HAPUS BARIS NOMOR ${rowLabel} — KLIK = Hapus baris ini!`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const ok = window.confirm(`Yakin HAPUS BARIS nomor ${rowLabel} (${hc.totalRows} total baris saat ini)?`);
                  if (!ok) return;
                  deleteRowByHandleIdx(hc.rowIdx);
                }}
              >
                🗑 DEL ROW {rowLabel}
              </button>
            </div>
          );
        })() : null}

        {/* ============= COLUMN HANDLE VISUAL (ATAS LUAR KERTAS): Badge Huruf A/B/C + DEL COL — PILIH HAPUS KOLOM MANA! ============= */}
        {hoveredCellRef.current && paperWrapperRef.current ? (() => {
          const hc = hoveredCellRef.current;
          const wrapRect = paperWrapperRef.current.getBoundingClientRect();
          const cellRect = hc.cellEl.getBoundingClientRect();
          const w = Math.max(36, cellRect.width);
          const top = Math.max(4, cellRect.top - wrapRect.top - 40);
          const left = cellRect.left - wrapRect.left;
          const colLbl = COL_LABELS[Math.min(hc.colIdx, 25)] ?? String(hc.colIdx + 1);
          return (
            <div
              data-col-handle-root
              className="absolute z-40 select-none flex flex-col items-stretch gap-1"
              style={{
                top: `${top}px`,
                left: `${left}px`,
                width: `${w}px`,
                animation: "tpt-bubble-in 90ms ease-out both",
              }}
            >
              <div className="flex items-stretch justify-center gap-1">
                <button
                  type="button"
                  className="group rounded-t-lg border-2 border-indigo-400 bg-gradient-to-br from-indigo-500 to-indigo-700 text-white text-[11px] font-bold min-h-[24px] px-2 shadow-[0_6px_14px_rgba(99,102,241,0.32)] flex items-center justify-center whitespace-nowrap"
                  title={`KOLOM ${colLbl} ← HOVER menunjuk KOLOM INI. Klik DEL kanan = HAPUS KOLOM ${colLbl}`}
                >
                  <span className="drop-shadow">{colLbl}</span>
                </button>
                <button
                  type="button"
                  className="rounded-b-lg border-2 border-rose-400 bg-gradient-to-br from-rose-500 to-rose-700 text-white text-[10px] font-black px-1.5 shadow-[0_6px_14px_rgba(244,63,94,0.32)] hover:brightness-110 active:scale-95"
                  title={`🔥 HAPUS KOLOM ${colLbl} — KLIK = Hapus kolom ${colLbl} dari tabel (${hc.totalCols} total kolom)`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const ok = window.confirm(`Yakin HAPUS KOLOM ${colLbl}?`);
                    if (!ok) return;
                    deleteColByHandleIdx(hc.colIdx);
                  }}
                >
                  🗑 DEL COL {colLbl}
                </button>
              </div>
            </div>
          );
        })() : null}

        {/* Hidden file inputs */}
        {showImageUploadButton ? (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onFileImageChanged}
            className="hidden"
            aria-hidden
          />
        ) : null}
        {showDocxIoButtons ? (
          <input
            ref={docxImportRef}
            type="file"
            accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={onDocxImportChanged}
            className="hidden"
            aria-hidden
          />
        ) : null}
      </div>

      {/* ========= PAGE SETUP MODAL COPY PERSIS DARI RichTextEditor existing ========= */}
      {pageSetupModalOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6"
          onClick={() => setPageSetupModalOpen(false)}
        >
          <Card
            className="w-full max-w-3xl max-h-[94vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-br from-indigo-50 to-white px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-200 bg-white text-indigo-700 shadow-sm">
                  <Settings className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-800">
                    Layout Dokumen (TipTap)
                  </p>
                  <CardTitle className="text-lg font-semibold text-slate-900 truncate">
                    Pengaturan Halaman (Page Setup)
                  </CardTitle>
                </div>
              </div>
              <button
                type="button"
                aria-label="Tutup modal"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shrink-0"
                onClick={() => setPageSetupModalOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </CardHeader>
            <CardContent className="p-5 space-y-5 overflow-y-auto flex-1">
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Preset Cepat
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(PAGE_SETUP_PRESETS) as PageSetupPreset[]).map((key) => {
                    const p = PAGE_SETUP_PRESETS[key];
                    return (
                      <Button
                        key={key}
                        type="button"
                        variant={draftPaperKey === key ? "default" : "outline"}
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => applyPresetQuick(key)}
                      >
                        {p.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Ukuran Kertas
                  </div>
                  <select
                    value={draftPaperKey}
                    onChange={(e) =>
                      applyPaperSize(
                        e.target.value as keyof typeof PAPER_SIZE_DIM,
                        draftOrientation,
                      )
                    }
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {(Object.keys(PAPER_SIZE_DIM) as (keyof typeof PAPER_SIZE_DIM)[]).map((k) => (
                      <option key={k} value={k}>
                        {k.toUpperCase() === "CUSTOM"
                          ? "Custom (ukuran bebas)"
                          : `${k.toUpperCase()} — ${PAPER_SIZE_DIM[k].w}×${PAPER_SIZE_DIM[k].h} mm`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Orientasi
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={draftOrientation === "portrait" ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-9"
                      onClick={toggleOrientation}
                    >
                      📄 Portrait (tegak)
                    </Button>
                    <Button
                      type="button"
                      variant={draftOrientation === "landscape" ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-9"
                      onClick={toggleOrientation}
                    >
                      🗒️ Landscape (mendatar)
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">
                    Lebar (mm)
                  </label>
                  <Input
                    type="number"
                    value={draftWidthMm}
                    min={30}
                    step={0.5}
                    onChange={(e) => setDraftWidthMm(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">
                    Tinggi (mm)
                  </label>
                  <Input
                    type="number"
                    value={draftHeightMm}
                    min={30}
                    step={0.5}
                    onChange={(e) => setDraftHeightMm(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">
                    Padding dalam (mm)
                  </label>
                  <Input
                    type="number"
                    value={draftPaddingMm}
                    min={0}
                    step={0.5}
                    onChange={(e) => setDraftPaddingMm(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1 flex flex-col justify-end">
                  <div className="flex items-center gap-2">
                    <input
                      id="centerChk"
                      type="checkbox"
                      checked={draftMarginCenter}
                      onChange={(e) => setDraftMarginCenter(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <label htmlFor="centerChk" className="text-xs text-slate-700">
                      Tengahkan halaman
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="shadowChk"
                      type="checkbox"
                      checked={draftShadow}
                      onChange={(e) => setDraftShadow(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    <label htmlFor="shadowChk" className="text-xs text-slate-700">
                      Bayangan kertas
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Margin Area Cetak (mm)
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">⬆️ Atas</label>
                    <Input
                      type="number"
                      value={draftMarginTMm}
                      min={0}
                      step={0.5}
                      onChange={(e) => setDraftMarginTMm(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">⬇️ Bawah</label>
                    <Input
                      type="number"
                      value={draftMarginBMm}
                      min={0}
                      step={0.5}
                      onChange={(e) => setDraftMarginBMm(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">⬅️ Kiri</label>
                    <Input
                      type="number"
                      value={draftMarginLMm}
                      min={0}
                      step={0.5}
                      onChange={(e) => setDraftMarginLMm(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-slate-600">➡️ Kanan</label>
                    <Input
                      type="number"
                      value={draftMarginRMm}
                      min={0}
                      step={0.5}
                      onChange={(e) => setDraftMarginRMm(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Latar Belakang Kertas
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={draftBg}
                    onChange={(e) => setDraftBg(e.target.value)}
                    className="h-9 w-12 rounded-md border border-slate-200 bg-white"
                  />
                  <Input value={draftBg} onChange={(e) => setDraftBg(e.target.value)} />
                </div>
              </div>
            </CardContent>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
              <div className="text-[11px] text-slate-500">
                Preview: {Math.round(draftWidthMm)} × {Math.round(draftHeightMm)} mm · {draftOrientation} · margin {Math.round(draftMarginTMm)}/{Math.round(draftMarginRMm)}/{Math.round(draftMarginBMm)}/{Math.round(draftMarginLMm)}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPageSetupModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetPageSetupDefault}
                >
                  Reset Default
                </Button>
                <Button type="button" size="sm" onClick={applyPageSetupDraft}>
                  Simpan Pengaturan
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
