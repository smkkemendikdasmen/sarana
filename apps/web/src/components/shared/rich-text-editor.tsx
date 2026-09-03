"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  FileImage,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  LayoutDashboard,
  PlusSquare,
  Table as TableIcon,
  Underline,
  Unlink,
  Settings,
  Trash2,
  RotateCcw,
  X,
  Check,
} from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as RMouseEvent,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type PageSetupPreset =
  | "default"
  | "a4"
  | "a4-narrow"
  | "a4-wide"
  | "a4-landscape";

export type PageSetup = {
  preset: PageSetupPreset;
  widthMm?: number;
  heightMm?: number;
  paddingMm?: number;
  paperShadow?: boolean;
  marginYAuto?: boolean;
  pageBg?: string;
  marginTopMm?: number;
  marginBottomMm?: number;
  marginLeftMm?: number;
  marginRightMm?: number;
  orientation?: "portrait" | "landscape";
};

export const PAGE_SETUP_PRESETS: Record<PageSetupPreset, PageSetup & { label: string }> = {
  default: {
    preset: "default",
    label: "Tanpa preset (width penuh container)",
  },
  a4: {
    preset: "a4",
    label: "A4 Portrait (Standar)",
    widthMm: 210,
    heightMm: 297,
    paddingMm: 14,
    paperShadow: true,
    marginYAuto: true,
    pageBg: "#ffffff",
    marginTopMm: 12,
    marginBottomMm: 14,
    marginLeftMm: 12,
    marginRightMm: 12,
    orientation: "portrait",
  },
  "a4-narrow": {
    preset: "a4-narrow",
    label: "A4 (Margin Sempit / Compact)",
    widthMm: 210,
    heightMm: 297,
    paddingMm: 9,
    paperShadow: true,
    marginYAuto: true,
    pageBg: "#ffffff",
    marginTopMm: 8,
    marginBottomMm: 10,
    marginLeftMm: 8,
    marginRightMm: 8,
    orientation: "portrait",
  },
  "a4-wide": {
    preset: "a4-wide",
    label: "A4 (Margin Luas / Lega)",
    widthMm: 210,
    heightMm: 297,
    paddingMm: 22,
    paperShadow: true,
    marginYAuto: true,
    pageBg: "#ffffff",
    marginTopMm: 18,
    marginBottomMm: 20,
    marginLeftMm: 18,
    marginRightMm: 18,
    orientation: "portrait",
  },
  "a4-landscape": {
    preset: "a4-landscape",
    label: "A4 Landscape (Untuk table Survey Harga)",
    widthMm: 297,
    heightMm: 210,
    paddingMm: 10,
    paperShadow: true,
    marginYAuto: true,
    pageBg: "#ffffff",
    marginTopMm: 10,
    marginBottomMm: 10,
    marginLeftMm: 10,
    marginRightMm: 10,
    orientation: "landscape",
  },
};

export const PAPER_SIZE_DIM: Record<string, { label: string; w: number; h: number }> = {
  a4: { label: "A4 (Standar Dokumen)", w: 210, h: 297 },
  a5: { label: "A5 (Buku Kecil / Undangan)", w: 148, h: 210 },
  letter: { label: "Letter (Amerika)", w: 215.9, h: 279.4 },
  folio: { label: "Folio / F4 (Indonesia)", w: 215.9, h: 330.2 },
  legal: { label: "Legal / Panjang", w: 215.9, h: 355.6 },
  custom: { label: "Custom (isi manual)", w: 0, h: 0 },
};

export function resolvePageSetup(presetOrSetup?: PageSetupPreset | PageSetup): PageSetup {
  if (!presetOrSetup) return { preset: "default" };
  if (typeof presetOrSetup === "string") {
    return { ...(PAGE_SETUP_PRESETS[presetOrSetup] ?? { preset: "default" }) };
  }
  const base = PAGE_SETUP_PRESETS[presetOrSetup.preset] ?? PAGE_SETUP_PRESETS.default;
  return {
    ...base,
    ...presetOrSetup,
    widthMm: presetOrSetup.widthMm ?? base.widthMm,
    heightMm: presetOrSetup.heightMm ?? base.heightMm,
    paddingMm: presetOrSetup.paddingMm ?? base.paddingMm,
    paperShadow: presetOrSetup.paperShadow ?? base.paperShadow,
    marginYAuto: presetOrSetup.marginYAuto ?? base.marginYAuto,
    pageBg: presetOrSetup.pageBg ?? base.pageBg ?? "#ffffff",
    marginTopMm: presetOrSetup.marginTopMm ?? base.marginTopMm ?? 12,
    marginBottomMm: presetOrSetup.marginBottomMm ?? base.marginBottomMm ?? 12,
    marginLeftMm: presetOrSetup.marginLeftMm ?? base.marginLeftMm ?? 12,
    marginRightMm: presetOrSetup.marginRightMm ?? base.marginRightMm ?? 12,
    orientation:
      presetOrSetup.orientation ??
      base.orientation ??
      (presetOrSetup.preset === "a4-landscape" ? "landscape" : "portrait"),
  };
}

type PlaceholderMap = Record<string, string | number | null | undefined>;

export function resolvePlaceholdersHtml(
  html: string,
  placeholders: PlaceholderMap = {},
  opts: { maxPasses?: number } = {},
): string {
  if (!html) return "";
  const keys = Object.keys(placeholders);
  if (keys.length === 0) return html;
  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    return String(v);
  };
  const re = new RegExp(
    `\\{\\{\\s*(${keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*\\}\\}`,
    "g",
  );
  let out = html;
  const maxPasses = opts.maxPasses ?? 2;
  for (let i = 0; i < maxPasses; i += 1) {
    const next = out.replace(re, (_m, k) => esc(placeholders[k as string] ?? ""));
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * Render HTML string ke PDF A4 menggunakan html2canvas + jsPDF.
 * Cocok untuk template RPD/PKS yang kompleks (tabel panjang, multi-halaman, gambar).
 *
 * @param htmlIn String HTML sumber (bisa mengandung <style> inline/embed).
 * @param pageSetup Objek PageSetup (margin, ukuran kertas, orientasi).
 * @param placeholders Map placeholder untuk di-resolve SEBELUM render ke canvas.
 * @param filename Jika diberikan: otomatis trigger download <a download>.
 * @returns Promise<Blob> file PDF yang siap diunggah / diunduh.
 */
export async function exportPdfFromHtml(
  htmlIn: string,
  pageSetup: PageSetupPreset | PageSetup,
  placeholders: PlaceholderMap = {},
  filename?: string,
): Promise<Blob> {
  const ps = resolvePageSetup(pageSetup);
  const widthMm = Math.max(50, ps.widthMm ?? 210);
  const heightMm = Math.max(50, ps.heightMm ?? 297);
  const orientation: "portrait" | "landscape" =
    ps.orientation ?? (widthMm > heightMm ? "landscape" : "portrait");
  const marginLeftMm = Math.max(0, ps.marginLeftMm ?? 12);
  const marginTopMm = Math.max(0, ps.marginTopMm ?? 12);

  const bodyHtml = resolvePlaceholdersHtml(htmlIn ?? "", placeholders);

  const wrapDiv = document.createElement("div");
  wrapDiv.setAttribute(
    "style",
    "position:fixed;left:-99999px;top:0px;z-index:-99999;overflow:hidden;background:#ffffff;",
  );
  const pageDiv = document.createElement("div");
  const canvasCss =
    "body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color:#000; }" +
    ` .page-a4 { width: ${widthMm}mm; min-height: ${heightMm}mm; padding: ${ps.paddingMm ?? 14}mm; margin: 0 auto; background: #fff; box-sizing: border-box; } ` +
    " table { border-collapse: collapse; width: 100%; } " +
    " table th, table td { border: 1px solid #000; padding: 4px 6px; font-size: 11pt; } " +
    " table th { background: #f8fafc; font-weight: bold; } " +
    " h1, h2, h3 { font-family: 'Times New Roman', Times, serif; font-weight: bold; margin-top: 0.6em; margin-bottom: 0.4em; } " +
    " p { margin-top: 0.3em; margin-bottom: 0.3em; } " +
    " .page-break-after { page-break-after: always; break-after: page; } ";
  pageDiv.setAttribute(
    "style",
    `width:${widthMm}mm;min-height:${heightMm}mm;padding:${ps.paddingMm ?? 14}mm;background:#ffffff;box-sizing:border-box;margin:0;`,
  );
  pageDiv.innerHTML = `<style>${canvasCss}</style>${bodyHtml}`;
  wrapDiv.appendChild(pageDiv);
  document.body.appendChild(wrapDiv);

  try {
    const canvas = await html2canvas(pageDiv, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      allowTaint: true,
    });

    const pdf = new jsPDF({
      orientation,
      unit: "mm",
      format: [widthMm, heightMm],
      compress: true,
    });

    const pdfInnerWidthMm = widthMm - marginLeftMm - Math.max(0, ps.marginRightMm ?? 12);
    const pdfInnerHeightMm = heightMm - marginTopMm - Math.max(0, ps.marginBottomMm ?? 14);
    const pxPerMm = canvas.width / widthMm;
    const sliceHeightPx = Math.round(pdfInnerHeightMm * pxPerMm);
    const totalHeightPx = canvas.height;

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const imgWmm = pdfInnerWidthMm;
    const imgHmm = (canvas.height / pxPerMm) * (imgWmm / (canvas.width / pxPerMm));

    if (totalHeightPx <= sliceHeightPx) {
      pdf.addImage(imgData, "JPEG", marginLeftMm, marginTopMm, imgWmm, imgHmm);
    } else {
      const totalSlices = Math.ceil(totalHeightPx / sliceHeightPx);
      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      const sliceCtx = sliceCanvas.getContext("2d")!;
      for (let i = 0; i < totalSlices; i += 1) {
        sliceCtx.clearRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        const startY = i * sliceHeightPx;
        const remainingPx = totalHeightPx - startY;
        const drawH = Math.min(sliceHeightPx, remainingPx);
        const sliceImgHmm = (drawH / pxPerMm) * (imgWmm / (canvas.width / pxPerMm));
        sliceCtx.drawImage(
          canvas,
          0,
          startY,
          canvas.width,
          drawH,
          0,
          0,
          canvas.width,
          drawH,
        );
        const sliceDataUrl = sliceCanvas.toDataURL("image/jpeg", 0.92);
        if (i > 0) pdf.addPage();
        pdf.addImage(sliceDataUrl, "JPEG", marginLeftMm, marginTopMm, imgWmm, sliceImgHmm);
      }
    }

    const blob = pdf.output("blob");

    if (filename) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    return blob;
  } finally {
    if (wrapDiv.parentNode) wrapDiv.parentNode.removeChild(wrapDiv);
  }
}

const Tb = ({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    title={title}
    onClick={onClick}
    className={cn(
      "h-8 w-8 shrink-0 rounded-md border border-transparent",
      active
        ? "bg-primary/10 text-primary border-primary/20"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
    )}
  >
    {children}
  </Button>
);

interface RichTextEditorProps {
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
}

type ImgResizeHandle =
  | "nw" | "n" | "ne"
  | "w" | "e"
  | "sw" | "s" | "se";

/**
 * Rich text editor berbasis contentEditable + document.execCommand.
 * Ringan, tidak butuh library tambahan, output HTML aman untuk simpan ke
 * kolom body_html master_rpd_pks_templates & school_instance_rpd_pks.
 *
 * Fitur tambahan:
 *  - Pengaturan Gambar: floating toolbar (rata/ hapus) + 8-titik drag resize.
 *  - Pengaturan Halaman (Page Setup Modal): Paper size, orientation, 4 sisi margin, padding, preset cepat.
 */
export function RichTextEditor({
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
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pageSetupRef = useRef<HTMLDivElement | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const resolvedPage = useMemo(() => resolvePageSetup(pageSetup), [pageSetup]);

  // ==================== STATE PENGATURAN GAMBAR ====================
  const [selectedImg, setSelectedImg] = useState<HTMLImageElement | null>(null);
  const [imgToolbarTop, setImgToolbarTop] = useState<number>(0);
  const [imgToolbarLeft, setImgToolbarLeft] = useState<number>(0);
  const [imgToolbarVisible, setImgToolbarVisible] = useState(false);
  const resizeStateRef = useRef<{
    handle: ImgResizeHandle | null;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    origRatio: number;
    target: HTMLImageElement | null;
  }>({ handle: null, startX: 0, startY: 0, startW: 0, startH: 0, origRatio: 1, target: null });

  // ==================== STATE PAGE SETUP MODAL ====================
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

  const paperSizeLabel = useMemo(() => {
    if (resolvedPage.preset === "default") return "Default";
    const orientation = resolvedPage.orientation === "landscape" ? " — Landscape" : "";
    return `${(resolvedPage.widthMm ?? 210).toFixed(0)}×${(resolvedPage.heightMm ?? 297).toFixed(0)}mm${orientation}`;
  }, [resolvedPage]);

  const pageContainerStyle: CSSProperties = useMemo(() => {
    const p = resolvedPage;
    if (p.preset === "default" || !p.widthMm || p.widthMm <= 0) {
      return {};
    }
    return {
      width: `${p.widthMm}mm`,
      maxWidth: "100%",
      minHeight: p.heightMm ? `${p.heightMm}mm` : undefined,
      height: p.heightMm ? "auto" : undefined,
      padding: `${p.paddingMm}mm`,
      background: p.pageBg || "#ffffff",
      boxShadow: p.paperShadow ? "0 10px 30px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.05)" : undefined,
      borderRadius: "6px",
      margin: p.marginYAuto ? "20px auto" : undefined,
      overflowX: "hidden",
      pageBreakInside: "auto",
      // Print page name untuk @page landscape di global CSS
      className: undefined,
    } as CSSProperties;
  }, [resolvedPage]);

  const wrapperBgStyle: CSSProperties = useMemo(() => {
    if (resolvedPage.preset === "default") return {};
    return { background: "#eef2f7" };
  }, [resolvedPage.preset]);

  // ========= SYNC PAGE SETUP DARI PROP KE DRAFT MODAL (saat modal buka) =========
  useEffect(() => {
    if (!pageSetupModalOpen) return;
    const p = resolvedPage;
    // tentukan paper key berdasarkan widthMm + heightMm cocok
    let keyMatched: keyof typeof PAPER_SIZE_DIM = "custom";
    for (const k of Object.keys(PAPER_SIZE_DIM) as (keyof typeof PAPER_SIZE_DIM)[]) {
      if (k === "custom") continue;
      const { w, h } = PAPER_SIZE_DIM[k];
      const wp = p.widthMm ?? 0;
      const hp = p.heightMm ?? 0;
      if ((Math.abs(wp - w) < 0.3 && Math.abs(hp - h) < 0.3) ||
          (Math.abs(wp - h) < 0.3 && Math.abs(hp - w) < 0.3)) {
        keyMatched = k; break;
      }
    }
    const o = p.orientation ?? ((p.widthMm ?? 210) > (p.heightMm ?? 297) ? "landscape" : "portrait");
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSetupModalOpen]);

  // =========================================================================
  //                            IMAGE FLOATING TOOLBAR + RESIZE
  // =========================================================================
  const updateImageToolbarPosition = useCallback((img: HTMLImageElement | null) => {
    if (!img || !ref.current) {
      setImgToolbarVisible(false);
      return;
    }
    try {
      const containerRect = ref.current.getBoundingClientRect();
      const rect = img.getBoundingClientRect();
      const left = Math.max(0, rect.left - containerRect.left + (rect.width / 2) - 120);
      const top = Math.max(0, rect.top - containerRect.top - 46);
      setImgToolbarLeft(left);
      setImgToolbarTop(top);
      setImgToolbarVisible(true);
    } catch {
      setImgToolbarVisible(false);
    }
  }, []);

  const clearImageSelection = useCallback(() => {
    setSelectedImg((cur) => {
      if (cur) {
        cur.style.outline = "";
        cur.style.outlineOffset = "";
      }
      return null;
    });
    setImgToolbarVisible(false);
  }, []);

  const handleAlignImage = useCallback((align: "left" | "center" | "right") => {
    setSelectedImg((cur) => {
      if (!cur) return cur;
      cur.style.display = "block";
      if (align === "left") {
        cur.style.marginLeft = "0"; cur.style.marginRight = "auto";
      } else if (align === "center") {
        cur.style.marginLeft = "auto"; cur.style.marginRight = "auto";
      } else {
        cur.style.marginLeft = "auto"; cur.style.marginRight = "0";
      }
      return cur;
    });
    setTimeout(() => notifyChange(), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteImage = useCallback(() => {
    setSelectedImg((cur) => {
      if (!cur) return cur;
      cur.parentNode?.removeChild(cur);
      setTimeout(() => notifyChange(), 0);
      return null;
    });
    setImgToolbarVisible(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saat user click contentEditable → cek apakah target adalah img
  const handleEditorMouseDown = useCallback((e: globalThis.MouseEvent) => {
    if (readOnly || disabled) return;
    const target = e.target as HTMLElement | null;
    if (target && target.nodeName === "IMG") {
      const img = target as HTMLImageElement;
      setSelectedImg((prev) => {
        if (prev && prev !== img) { prev.style.outline = ""; prev.style.outlineOffset = ""; }
        img.style.outline = "2px dashed #1d6fd8";
        img.style.outlineOffset = "3px";
        return img;
      });
      updateImageToolbarPosition(img);
    } else {
      clearImageSelection();
    }
  }, [readOnly, disabled, clearImageSelection, updateImageToolbarPosition]);

  // Resize handle drag
  const beginResizeHandle = useCallback((e: RMouseEvent<HTMLDivElement>, handle: ImgResizeHandle) => {
    if (!selectedImg) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = selectedImg.getBoundingClientRect();
    resizeStateRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
      origRatio: rect.width / Math.max(1, rect.height),
      target: selectedImg,
    };
  }, [selectedImg]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const st = resizeStateRef.current;
      if (!st.handle || !st.target) return;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      let newW = st.startW;
      let newH = st.startH;
      switch (st.handle) {
        case "e": newW = Math.max(40, st.startW + dx); newH = newW / st.origRatio; break;
        case "w": newW = Math.max(40, st.startW - dx); newH = newW / st.origRatio; break;
        case "s": newH = Math.max(30, st.startH + dy); newW = newH * st.origRatio; break;
        case "n": newH = Math.max(30, st.startH - dy); newW = newH * st.origRatio; break;
        case "se": newW = Math.max(40, st.startW + dx); newH = newW / st.origRatio; break;
        case "sw": newW = Math.max(40, st.startW - dx); newH = newW / st.origRatio; break;
        case "ne": newW = Math.max(40, st.startW + dx); newH = newW / st.origRatio; break;
        case "nw": newW = Math.max(40, st.startW - dx); newH = newW / st.origRatio; break;
      }
      st.target.style.width = `${Math.round(newW)}px`;
      st.target.style.height = "auto";
      st.target.style.maxWidth = "100%";
      setTimeout(() => updateImageToolbarPosition(st.target), 0);
    };
    const onUp = () => {
      if (resizeStateRef.current.target) {
        notifyChange();
        updateImageToolbarPosition(resizeStateRef.current.target);
      }
      resizeStateRef.current = { handle: null, startX: 0, startY: 0, startW: 0, startH: 0, origRatio: 1, target: null };
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateImageToolbarPosition]);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.addEventListener("mousedown", handleEditorMouseDown, true);
    return () => root.removeEventListener("mousedown", handleEditorMouseDown, true);
  }, [handleEditorMouseDown]);

  // Re-posisi toolbar tiap scroll window
  useEffect(() => {
    if (!imgToolbarVisible || !selectedImg) return;
    const reposition = () => updateImageToolbarPosition(selectedImg);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    const tm = setInterval(reposition, 250);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      clearInterval(tm);
    };
  }, [imgToolbarVisible, selectedImg, updateImageToolbarPosition]);

  // =========================================================================
  //                              HELPER STANDARD
  // =========================================================================
  const triggerUploadImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onFileImageChanged = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (!files.length) return;
      const readerQueue = [...files];
      let htmlAcc = "";
      const flushHtml = () => {
        if (htmlAcc) {
          const el = ref.current;
          if (el) {
            el.focus();
            try {
              document.execCommand("insertHTML", false, htmlAcc);
            } catch {
              el.innerHTML = el.innerHTML + htmlAcc;
            }
          }
          htmlAcc = "";
          notifyChange();
        }
      };
      const processNext = () => {
        const f = readerQueue.shift();
        if (!f) {
          flushHtml();
          e.target.value = "";
          return;
        }
        if (!/^image\//i.test(f.type)) {
          processNext();
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          const dataUri = String(reader.result ?? "");
          if (dataUri) {
            const alt = f.name ? ` alt="${f.name.replace(/"/g, "&quot;")}"` : "";
            htmlAcc += `<img src="${dataUri}"${alt} style="display:block;max-width:100%;height:auto;border-radius:6px;margin:12px auto;box-shadow:0 1px 4px rgba(15,23,42,0.08);" />`;
          }
          processNext();
        };
        reader.onerror = () => processNext();
        reader.readAsDataURL(f);
      };
      processNext();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setHtmlFromOutside = useCallback(
    (html: string) => {
      if (ref.current && ref.current.innerHTML !== html) {
        ref.current.innerHTML = html ?? "";
      }
    },
    [],
  );

  useEffect(() => {
    setHtmlFromOutside(value);
  }, [value, setHtmlFromOutside]);

  const notifyChange = useCallback(() => {
    if (!ref.current) return;
    if (isComposing) return;
    const next = ref.current.innerHTML;
    if (next !== value) onChange(next);
  }, [isComposing, onChange, value]);

  const exec = useCallback(
    (cmd: string, arg?: string) => {
      if (disabled || readOnly) return;
      const el = ref.current;
      if (!el) return;
      el.focus();
      try {
        if (cmd === "removeFormat") {
          document.execCommand("removeFormat", false);
        } else if (cmd === "insertUnorderedList") {
          document.execCommand("insertUnorderedList", false);
        } else if (cmd === "insertOrderedList") {
          document.execCommand("insertOrderedList", false);
        } else if (cmd === "createLink") {
          const url =
            arg ??
            window.prompt("Masukkan URL tautan:", "https://")?.trim();
          if (url) document.execCommand("createLink", false, url);
        } else if (cmd === "unlink") {
          document.execCommand("unlink", false);
        } else if (cmd === "insertTable") {
          const rowsRaw = window.prompt("Jumlah baris (min 1):", "4");
          const colsRaw = window.prompt("Jumlah kolom (min 1):", "3");
          const rows = Math.max(1, parseInt(rowsRaw ?? "1", 10) || 1);
          const cols = Math.max(1, parseInt(colsRaw ?? "1", 10) || 1);
          let html =
            '<table style="width:100%;border-collapse:collapse;margin:12px 0;" border="1" cellpadding="6" cellspacing="0"><tbody>';
          for (let r = 0; r < rows; r += 1) {
            html += "<tr>";
            for (let c = 0; c < cols; c += 1) {
              const tag = r === 0 ? "th" : "td";
              const style =
                r === 0
                  ? 'style="background:#f1f5f9;font-weight:600;text-align:left;"'
                  : "";
              html += `<${tag} ${style}>&nbsp;</${tag}>`;
            }
            html += "</tr>";
          }
          html += "</tbody></table>";
          document.execCommand("insertHTML", false, html);
        } else if (cmd === "insertHorizontalRule") {
          document.execCommand("insertHorizontalRule", false);
        } else if (cmd === "insertHeading") {
          document.execCommand("formatBlock", false, arg ?? "P");
        } else if (cmd === "align") {
          document.execCommand(`justify${arg ?? "Left"}`, false);
        } else {
          document.execCommand(cmd, false, arg);
        }
      } catch {
        /* noop */
      }
      notifyChange();
    },
    [disabled, readOnly, notifyChange],
  );

  const isEmpty = useMemo(() => {
    const stripped = (value ?? "")
      .replace(/<br\s*\/?>/gi, "")
      .replace(/&nbsp;/g, " ")
      .replace(/<[^>]+>/g, "")
      .trim();
    return stripped.length === 0;
  }, [value]);

  // =========================================================================
  //                    MODAL PAGE SETUP QUICK ACTIONS
  // =========================================================================
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

  // Saat paper size diganti → update width/height sesuai orientation
  const applyPaperSize = (key: keyof typeof PAPER_SIZE_DIM, orien: "portrait" | "landscape") => {
    setDraftPaperKey(key);
    const ps = PAPER_SIZE_DIM[key];
    if (key === "custom") {
      setDraftOrientation(orien);
      return;
    }
    let w = ps.w; let h = ps.h;
    if (orien === "landscape") { const tmp = w; w = h; h = tmp; }
    setDraftWidthMm(Math.round(w * 10) / 10);
    setDraftHeightMm(Math.round(h * 10) / 10);
    setDraftOrientation(orien);
  };

  const toggleOrientation = () => {
    setDraftOrientation((o) => {
      const next = o === "portrait" ? "landscape" : "portrait";
      // swap width / height
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
    // Sesuaikan nama preset jika cocok dengan built-in
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
      if (near) { next.preset = key; break; }
    }
    onPageSetupChange?.(next);
    setPageSetupModalOpen(false);
  };

  const resetPageSetupDefault = () => onPageSetupChange?.({ preset: "default" });

  // =========================================================================
  //                                RENDER
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
            "flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50/70 px-2 py-1.5",
            disabled ? "opacity-60 pointer-events-none" : "",
          )}
        >
          <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
            <Tb title="Heading 1" onClick={() => exec("insertHeading", "H1")}>
              <Heading1 className="h-4 w-4" />
            </Tb>
            <Tb title="Heading 2" onClick={() => exec("insertHeading", "H2")}>
              <Heading2 className="h-4 w-4" />
            </Tb>
            <Tb title="Heading 3" onClick={() => exec("insertHeading", "H3")}>
              <Heading3 className="h-4 w-4" />
            </Tb>
          </div>

          <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
            <Tb title="Tebal (Ctrl+B)" onClick={() => exec("bold")}>
              <Bold className="h-4 w-4" />
            </Tb>
            <Tb title="Miring (Ctrl+I)" onClick={() => exec("italic")}>
              <Italic className="h-4 w-4" />
            </Tb>
            <Tb title="Garis bawah (Ctrl+U)" onClick={() => exec("underline")}>
              <Underline className="h-4 w-4" />
            </Tb>
            <Tb title="Hapus format pemilihan" onClick={() => exec("removeFormat")}>
              <Eraser className="h-4 w-4" />
            </Tb>
          </div>

          <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
            <Tb title="Rata kiri" onClick={() => exec("align", "Left")}>
              <AlignLeft className="h-4 w-4" />
            </Tb>
            <Tb title="Rata tengah" onClick={() => exec("align", "Center")}>
              <AlignCenter className="h-4 w-4" />
            </Tb>
            <Tb title="Rata kanan" onClick={() => exec("align", "Right")}>
              <AlignRight className="h-4 w-4" />
            </Tb>
          </div>

          <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
            <Tb title="Daftar bullet" onClick={() => exec("insertUnorderedList")}>
              <List className="h-4 w-4" />
            </Tb>
            <Tb title="Daftar nomor" onClick={() => exec("insertOrderedList")}>
              <ListOrdered className="h-4 w-4" />
            </Tb>
          </div>

          <div className="flex items-center gap-0.5 pr-1.5 border-r border-slate-200 mr-1">
            <Tb title="Sisipkan tautan" onClick={() => exec("createLink")}>
              <Link2 className="h-4 w-4" />
            </Tb>
            <Tb title="Hapus tautan" onClick={() => exec("unlink")}>
              <Unlink className="h-4 w-4" />
            </Tb>
            <Tb title="Sisipkan garis pemisah" onClick={() => exec("insertHorizontalRule")}>
              <PlusSquare className="h-4 w-4" />
            </Tb>
            <Tb title="Sisipkan tabel" onClick={() => exec("insertTable")}>
              <TableIcon className="h-4 w-4" />
            </Tb>
            {showImageUploadButton ? (
              <Tb title="Upload & sisipkan gambar (JPG/PNG/WebP)" onClick={triggerUploadImage}>
                <ImageIcon className="h-4 w-4" />
              </Tb>
            ) : null}
            {showPageSetupButton && onPageSetupChange ? (
              <>
                <Tb
                  title={`Buka Pengaturan Halaman (Page Setup): ${paperSizeLabel}`}
                  onClick={() => setPageSetupModalOpen(true)}
                  active={resolvedPage.preset !== "default"}
                >
                  <Settings className="h-4 w-4" />
                </Tb>
                {resolvedPage.preset !== "default" ? (
                  <Tb title="Kembalikan ke Default (tanpa kertas)" onClick={resetPageSetupDefault}>
                    <RotateCcw className="h-4 w-4" />
                  </Tb>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-2 pr-1">
            {showImageUploadButton ? (
              <label
                className="inline-flex items-center gap-1 text-[11px] text-slate-500"
                title="Upload gambar (klik untuk pilih file)"
              >
                <FileImage className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Gambar</span>
              </label>
            ) : null}
            {showPageSetupButton ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10.5px] cursor-pointer select-none",
                  resolvedPage.preset === "default"
                    ? "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                    : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
                )}
                onClick={() => (onPageSetupChange ? setPageSetupModalOpen(true) : undefined)}
                title={`Page layout: ${paperSizeLabel} — klik untuk buka modal custom`}
              >
                <LayoutDashboard className="h-3 w-3" />
                {resolvedPage.preset === "default" ? "Default" : paperSizeLabel}
              </span>
            ) : null}
            <span className="text-[11px] text-slate-400 italic pr-1">
              Tips: <code className="font-mono text-[10px] bg-white rounded border border-slate-200 px-1">{`{{nama_sekolah}}`}</code>
            </span>
          </div>
        </div>
      ) : null}

      <div
        ref={pageSetupRef}
        style={wrapperBgStyle}
        className={cn(
          "relative w-full",
          resolvedPage.preset !== "default" ? "py-1 px-1 sm:py-3 sm:px-3" : "",
        )}
      >
        <div
          style={pageContainerStyle}
          className={cn(
            resolvedPage.preset !== "default" ? "border border-slate-200/80 relative" : "relative",
          )}
        >
          {placeholder && isEmpty ? (
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
          <div
            ref={ref}
            contentEditable={!disabled && !readOnly}
            suppressContentEditableWarning
            onInput={() => notifyChange()}
            onBlur={() => notifyChange()}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => {
              setIsComposing(false);
              notifyChange();
            }}
            spellCheck
            className={cn(
              "prose prose-slate max-w-none px-4 py-3 text-[14.5px] leading-7 text-slate-800 outline-none",
              "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2",
              "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2",
              "[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5",
              "[&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6",
              "[&_a]:text-primary [&_a]:underline [&_a]:break-all",
              "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:cursor-pointer",
              "[&_table]:border-collapse [&_table]:w-full [&_th]:border [&_th]:border-slate-300 [&_th]:px-3 [&_th]:py-2 [&_td]:border [&_td]:border-slate-300 [&_td]:px-3 [&_td]:py-2",
              editorClassName,
            )}
            style={{ minHeight }}
            dir="ltr"
          />

          {/* =========== FLOATING IMAGE TOOLBAR =========== */}
          {!readOnly && !disabled && imgToolbarVisible && selectedImg ? (
            <>
              <div
                className="absolute z-20 inline-flex items-center gap-0.5 rounded-xl border border-slate-200 bg-white shadow-lg px-1 py-1"
                style={{ top: imgToolbarTop, left: imgToolbarLeft }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <Tb title="Rata gambar kiri" onClick={() => handleAlignImage("left")}>
                  <AlignLeft className="h-4 w-4" />
                </Tb>
                <Tb title="Rata gambar tengah" onClick={() => handleAlignImage("center")}>
                  <AlignCenter className="h-4 w-4" />
                </Tb>
                <Tb title="Rata gambar kanan" onClick={() => handleAlignImage("right")}>
                  <AlignRight className="h-4 w-4" />
                </Tb>
                <Tb title="Hapus gambar" onClick={handleDeleteImage}>
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </Tb>
              </div>
              {/* 8 Resize Handles di perimeter gambar */}
              {(() => {
                const rect = (() => { try { return selectedImg.getBoundingClientRect(); } catch { return null; } })();
                const container = (() => { try { return pageContainerStyle.width ? ref.current?.getBoundingClientRect() ?? null : null; } catch { return null; } })();
                if (!rect || !ref.current) return null;
                const parentRect = ref.current.getBoundingClientRect();
                const left = rect.left - parentRect.left;
                const top = rect.top - parentRect.top;
                const w = rect.width;
                const h = rect.height;
                const commonCls = "absolute z-10 rounded-full border-2 border-[#1d6fd8] bg-white shadow-sm";
                const edgeCls = "absolute z-10 bg-[#1d6fd8]/70";
                const SZ = 10;
                return (
                  <div className="pointer-events-none" style={{ position: "relative" }}>
                    {/* 4 CORNERS */}
                    <div onMouseDown={(e) => beginResizeHandle(e, "nw")} className={`${commonCls} pointer-events-auto cursor-nwse-resize`} title="Resize Barat Laut" style={{ position: "absolute", top: top - SZ/2, left: left - SZ/2, width: SZ, height: SZ }} />
                    <div onMouseDown={(e) => beginResizeHandle(e, "ne")} className={`${commonCls} pointer-events-auto cursor-nesw-resize`} title="Resize Timur Laut" style={{ position: "absolute", top: top - SZ/2, left: left + w - SZ/2, width: SZ, height: SZ }} />
                    <div onMouseDown={(e) => beginResizeHandle(e, "sw")} className={`${commonCls} pointer-events-auto cursor-nesw-resize`} title="Resize Barat Daya" style={{ position: "absolute", top: top + h - SZ/2, left: left - SZ/2, width: SZ, height: SZ }} />
                    <div onMouseDown={(e) => beginResizeHandle(e, "se")} className={`${commonCls} pointer-events-auto cursor-nwse-resize`} title="Resize Tenggara" style={{ position: "absolute", top: top + h - SZ/2, left: left + w - SZ/2, width: SZ, height: SZ }} />
                    {/* 4 EDGES */}
                    <div onMouseDown={(e) => beginResizeHandle(e, "n")} className={`${edgeCls} pointer-events-auto cursor-ns-resize`} title="Resize Utara" style={{ position: "absolute", top: top - 2, left: left + w/2 - 10, width: 20, height: 4 }} />
                    <div onMouseDown={(e) => beginResizeHandle(e, "s")} className={`${edgeCls} pointer-events-auto cursor-ns-resize`} title="Resize Selatan" style={{ position: "absolute", top: top + h - 2, left: left + w/2 - 10, width: 20, height: 4 }} />
                    <div onMouseDown={(e) => beginResizeHandle(e, "w")} className={`${edgeCls} pointer-events-auto cursor-ew-resize`} title="Resize Barat" style={{ position: "absolute", top: top + h/2 - 2, left: left - 2, width: 4, height: 20 }} />
                    <div onMouseDown={(e) => beginResizeHandle(e, "e")} className={`${edgeCls} pointer-events-auto cursor-ew-resize`} title="Resize Timur" style={{ position: "absolute", top: top + h/2 - 2, left: left + w - 2, width: 4, height: 20 }} />
                  </div>
                );
              })()}
            </>
          ) : null}
        </div>

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
      </div>

      {/* =========================================================================
                                    MODAL PAGE SETUP
          ========================================================================= */}
      {pageSetupModalOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-3 sm:p-6"
          onClick={() => { setPageSetupModalOpen(false); }}
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
                    Layout Dokumen
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
              {/* ========= Quick Preset Chips ========= */}
              <div className="space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Preset Cepat
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(PAGE_SETUP_PRESETS) as PageSetupPreset[]).map((key) => {
                    const p = PAGE_SETUP_PRESETS[key];
                    return (
                      <Badge
                        key={key}
                        variant="outline"
                        className={cn(
                          "cursor-pointer px-3 py-1.5 text-[11.5px] rounded-full transition",
                          draftPaperKey === "a4" && draftOrientation === p.orientation && (key === "a4" || key === "a4-landscape")
                            ? "border-indigo-400 bg-indigo-50 text-indigo-800 shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                        )}
                        onClick={() => applyPresetQuick(key)}
                      >
                        {key === "default" ? "📄 Default" : PAGE_SETUP_PRESETS[key].label}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ====== KERTAS & ORIENTASI ====== */}
                <div className="space-y-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    1. Ukuran Kertas
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-700">Jenis Kertas</label>
                    <select
                      className={cn(
                        "w-full h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
                      )}
                      value={draftPaperKey}
                      onChange={(e) => applyPaperSize(e.target.value as keyof typeof PAPER_SIZE_DIM, draftOrientation)}
                    >
                      {(Object.keys(PAPER_SIZE_DIM) as (keyof typeof PAPER_SIZE_DIM)[]).map((k) => (
                        <option key={k} value={k}>{PAPER_SIZE_DIM[k].label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">Lebar (mm)</label>
                      <Input
                        type="number"
                        min={20}
                        max={600}
                        step={0.5}
                        value={draftWidthMm}
                        onChange={(e) => setDraftWidthMm(Number(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">Tinggi (mm)</label>
                      <Input
                        type="number"
                        min={20}
                        max={800}
                        step={0.5}
                        value={draftHeightMm}
                        onChange={(e) => setDraftHeightMm(Number(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2 border-t border-slate-200">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 pt-1">
                      2. Orientasi
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (draftOrientation !== "portrait") toggleOrientation();
                        }}
                        className={cn(
                          "h-14 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition",
                          draftOrientation === "portrait"
                            ? "border-indigo-400 bg-indigo-50 text-indigo-800 shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                        )}
                      >
                        <div className="h-8 w-6 border-2 border-current rounded-sm" />
                        Portrait
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (draftOrientation !== "landscape") toggleOrientation();
                        }}
                        className={cn(
                          "h-14 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1 transition",
                          draftOrientation === "landscape"
                            ? "border-indigo-400 bg-indigo-50 text-indigo-800 shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                        )}
                      >
                        <div className="h-6 w-8 border-2 border-current rounded-sm" />
                        Landscape
                      </button>
                    </div>
                  </div>
                </div>

                {/* ====== MARGIN + PADDING ====== */}
                <div className="space-y-4 p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    3. Jarak Tepi (Margin Cetak · mm)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-1">
                      <label className="text-xs font-medium text-slate-700">⬆️ Atas</label>
                      <Input type="number" min={0} max={50} step={0.5} value={draftMarginTMm} onChange={(e)=>setDraftMarginTMm(Number(e.target.value)||0)} className="h-9" />
                    </div>
                    <div className="space-y-1 col-span-1">
                      <label className="text-xs font-medium text-slate-700">⬇️ Bawah</label>
                      <Input type="number" min={0} max={50} step={0.5} value={draftMarginBMm} onChange={(e)=>setDraftMarginBMm(Number(e.target.value)||0)} className="h-9" />
                    </div>
                    <div className="space-y-1 col-span-1">
                      <label className="text-xs font-medium text-slate-700">⬅️ Kiri</label>
                      <Input type="number" min={0} max={50} step={0.5} value={draftMarginLMm} onChange={(e)=>setDraftMarginLMm(Number(e.target.value)||0)} className="h-9" />
                    </div>
                    <div className="space-y-1 col-span-1">
                      <label className="text-xs font-medium text-slate-700">➡️ Kanan</label>
                      <Input type="number" min={0} max={50} step={0.5} value={draftMarginRMm} onChange={(e)=>setDraftMarginRMm(Number(e.target.value)||0)} className="h-9" />
                    </div>
                  </div>
                  <div className="pt-2 space-y-3 border-t border-slate-200">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 pt-1">
                      4. Konten Kertas
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">Padding Isi Luar (mm)</label>
                      <Input type="number" min={0} max={50} step={0.5} value={draftPaddingMm} onChange={(e)=>setDraftPaddingMm(Number(e.target.value)||0)} className="h-9" />
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <label className="text-xs font-medium text-slate-700 flex items-center gap-2 cursor-pointer"
                        onClick={() => setDraftShadow((v) => !v)}>
                        <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded border-2 transition", draftShadow ? "bg-primary border-primary text-white" : "border-slate-300 bg-white")}>
                          {draftShadow ? <Check className="h-3 w-3" /> : null}
                        </span>
                        Bayangan Kertas (shadow)
                      </label>
                      <label className="text-xs font-medium text-slate-700 flex items-center gap-2 cursor-pointer"
                        onClick={() => setDraftMarginCenter((v) => !v)}>
                        <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded border-2 transition", draftMarginCenter ? "bg-primary border-primary text-white" : "border-slate-300 bg-white")}>
                          {draftMarginCenter ? <Check className="h-3 w-3" /> : null}
                        </span>
                        Tengah-kan kertas
                      </label>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-700">Warna Background Kertas</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="color"
                          value={draftBg}
                          onChange={(e) => setDraftBg(e.target.value)}
                          className="h-9 w-16 p-1"
                        />
                        <Input
                          type="text"
                          value={draftBg}
                          onChange={(e) => setDraftBg(e.target.value)}
                          className="h-9 flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ========= PREVIEW SUMMARY ========= */}
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 via-white to-white p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-800 mb-0.5">
                    Ringkasan
                  </p>
                  <p className="text-sm text-slate-800 font-medium">
                    {PAPER_SIZE_DIM[draftPaperKey]?.label ?? "Custom"} · <b>{draftWidthMm}</b> × <b>{draftHeightMm}</b> mm · {draftOrientation === "landscape" ? "Landscape" : "Portrait"}
                  </p>
                  <p className="text-[12px] text-slate-600 mt-0.5">
                    Margin cetak: Atas {draftMarginTMm} · Bawah {draftMarginBMm} · Kiri {draftMarginLMm} · Kanan {draftMarginRMm} (mm) · Padding isi {draftPaddingMm}mm.
                  </p>
                </div>
                <div className="shrink-0">
                  <div
                    className={cn(
                      "border rounded-md flex items-center justify-center text-[9px] font-bold text-slate-400 transition-all",
                      draftShadow ? "shadow-xl" : "",
                      draftMarginCenter ? "mx-auto" : "",
                    )}
                    style={{
                      width: draftOrientation === "landscape" ? 150 : 105,
                      height: draftOrientation === "landscape" ? 105 : 150,
                      background: draftBg,
                      borderColor: "#cbd5e1",
                    }}
                  >
                    <span>Preview</span>
                  </div>
                </div>
              </div>
            </CardContent>

            {/* ========= FOOTER BUTTON ========= */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-5 py-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => applyPresetQuick("a4")}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Reset ke A4 Standar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={resetPageSetupDefault}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Hilangkan preset
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setPageSetupModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={applyPageSetupDraft}
                  className="bg-primary text-white hover:bg-primary/90 hover:ring-2 hover:ring-primary/25 shadow-sm shadow-primary/10"
                >
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  Terapkan Pengaturan
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
