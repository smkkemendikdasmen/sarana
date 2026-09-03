"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  onlyOfficePrepareEditor,
  onlyOfficeReapplyPlaceholders,
  type OnlyOfficePreparedConfig,
} from "@/lib/onlyoffice-api";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (elementId: string, config: any) => any;
    };
  }
}

export interface OnlyOfficeEditorProps {
  npsn: string;
  kind: string;
  userId: string;
  userName: string;
  editable?: boolean;
  applyPlaceholdersOnFirstLoad?: boolean;
  minHeight?: string;
  className?: string;
  allowRefresh?: boolean;
  onReady?: () => void;
}

let apiLoadPromise: Promise<void> | null = null;

function loadDocApi(url: string): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("SSR"));
      return;
    }
    if (window.DocsAPI) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => {
      if (window.DocsAPI) resolve();
      else reject(new Error("DocsAPI undefined"));
    };
    s.onerror = () => reject(new Error(`Load script failed: ${url}`));
    document.head.appendChild(s);
  });
  return apiLoadPromise;
}

export function OnlyOfficeEditor({
  npsn,
  kind,
  userId,
  userName,
  editable = true,
  applyPlaceholdersOnFirstLoad = true,
  minHeight = "780px",
  className,
  allowRefresh = true,
  onReady,
}: OnlyOfficeEditorProps) {
  const mountIdRef = useRef<string>(
    `onlyoffice-${Math.random().toString(36).slice(2, 10)}`,
  );
  const editorObjRef = useRef<any>(null);
  const preparedRef = useRef<OnlyOfficePreparedConfig | null>(null);
  const lastLoadKeyRef = useRef<string>("");
  const [state, setState] = useState<
    | { kind: "idle" | "loading" | "ready" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setState({ kind: "loading" });
        const prepared = await onlyOfficePrepareEditor({
          npsn,
          kind,
          userId,
          userName,
          editable,
          applyPlaceholders: applyPlaceholdersOnFirstLoad,
        });
        if (cancelled) return;
        preparedRef.current = prepared;
        await loadDocApi(prepared.docserverApiJsUrl);
        if (cancelled) return;
        if (!window.DocsAPI) throw new Error("DocsAPI still undefined after script load");
        const mountKey = `${npsn}|${kind}|${prepared.config.document.key}|${editable ? "1" : "0"}`;
        if (lastLoadKeyRef.current === mountKey && editorObjRef.current) {
          setState({ kind: "ready" });
          return;
        }
        const mountEl = document.getElementById(mountIdRef.current);
        if (!mountEl) {
          throw new Error(`Mount element #${mountIdRef.current} not found`);
        }
        mountEl.innerHTML = "";
        try {
          editorObjRef.current?.destroyEditor?.();
        } catch {}
        editorObjRef.current = null;
        editorObjRef.current = new window.DocsAPI.DocEditor(
          mountIdRef.current,
          prepared.config as any,
        );
        lastLoadKeyRef.current = mountKey;
        setState({ kind: "ready" });
        onReady?.();
      } catch (err) {
        console.error("[OnlyOfficeEditor] err", err);
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            (err as Error)?.message ??
            "Gagal memuat ONLYOFFICE Document Editor. Pastikan ONLYOFFICE docker sudah up (docker compose -f docker-compose.onlyoffice.yml up -d).",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [npsn, kind, userId, userName, editable, applyPlaceholdersOnFirstLoad, onReady]);

  useEffect(() => {
    return () => {
      try {
        editorObjRef.current?.destroyEditor?.();
      } catch {}
      editorObjRef.current = null;
    };
  }, []);

  const handleRefresh = async () => {
    try {
      setState({ kind: "loading" });
      await onlyOfficeReapplyPlaceholders({ npsn, kind });
      lastLoadKeyRef.current = "";
      preparedRef.current = null;
      const prepared = await onlyOfficePrepareEditor({
        npsn,
        kind,
        userId,
        userName,
        editable,
        applyPlaceholders: applyPlaceholdersOnFirstLoad,
      });
      preparedRef.current = prepared;
      await loadDocApi(prepared.docserverApiJsUrl);
      const mountEl = document.getElementById(mountIdRef.current);
      if (mountEl) mountEl.innerHTML = "";
      try {
        editorObjRef.current?.destroyEditor?.();
      } catch {}
      editorObjRef.current = null;
      if (!window.DocsAPI) throw new Error("DocsAPI unavailable");
      editorObjRef.current = new window.DocsAPI.DocEditor(
        mountIdRef.current,
        prepared.config as any,
      );
      lastLoadKeyRef.current = `${npsn}|${kind}|${prepared.config.document.key}|${editable ? "1" : "0"}`;
      setState({ kind: "ready" });
    } catch (err) {
      setState({
        kind: "error",
        message: (err as Error)?.message ?? "Gagal refresh ONLYOFFICE editor",
      });
    }
  };

  const saveNow = () => {
    try {
      editorObjRef.current?.forceSave?.();
    } catch {}
  };

  return (
    <div
      className={cn(
        "relative w-full rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {allowRefresh ? (
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-3 py-2">
          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <Terminal className="h-3.5 w-3.5 text-indigo-600" />
            <span className="font-semibold tracking-wide">ONLYOFFICE • {kind}</span>
            <span className="text-slate-400">•</span>
            <span>{npsn}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-[11px]"
              onClick={saveNow}
              disabled={state.kind !== "ready"}
            >
              💾 Simpan Paksa
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-[11px]"
              onClick={handleRefresh}
              disabled={state.kind === "loading"}
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1", state.kind === "loading" ? "animate-spin" : "")} />
              Muat Ulang
            </Button>
          </div>
        </div>
      ) : null}
      <div
        id={mountIdRef.current}
        className="w-full bg-white"
        style={{ minHeight }}
      />
      {state.kind === "loading" ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/90 backdrop-blur-[2px]">
          <div className="flex items-center gap-3 text-[12px] text-slate-600">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <span className="font-medium">
              Memuat ONLYOFFICE Document Editor…
            </span>
          </div>
        </div>
      ) : null}
      {state.kind === "error" ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-white/95 p-6 text-center">
          <div className="max-w-xl w-full text-left rounded-lg border border-rose-200 bg-rose-50/90 p-4 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 text-rose-600 shrink-0" />
              <div className="text-[12px] leading-relaxed text-rose-900">
                <div className="font-semibold mb-1">
                  ⚠️ ONLYOFFICE Document Server BELUM BERJALAN atau koneksi gagal.
                </div>
                <div className="text-slate-700 whitespace-pre-wrap">
                  {state.message}
                </div>
                <div className="mt-2 rounded-md bg-slate-900 text-slate-100 px-2.5 py-1.5 font-mono text-[11px] overflow-x-auto">
                  cd /Users/ilahilah/Documents/Project/PRISMA/saranasmk
                  <br />
                  docker compose -f docker-compose.onlyoffice.yml up -d
                </div>
                <div className="mt-1.5 text-[11px] text-slate-500">
                  Tunggu ~90 detik start-up, cek di browser:{" "}
                  <a
                    href="http://localhost:9980/welcome"
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-indigo-600"
                  >
                    http://localhost:9980/welcome
                  </a>{" "}
                  → lalu klik Muat Ulang di atas.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default OnlyOfficeEditor;
