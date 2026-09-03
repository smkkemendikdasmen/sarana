"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ListChecks,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDev =
    typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error("[AdminError] Error di scope admin:", error);
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-xl border border-amber-200 bg-amber-50/40 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-700 ring-1 ring-amber-200">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-amber-800">
                Kesalahan pada area Admin
              </h1>
              <p className="text-sm text-slate-500">
                Terjadi kendala saat memuat halaman administrasi.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="rounded-md border border-amber-200 bg-white p-4 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium text-slate-900">Pesan:</p>
                <p className="mt-1 text-slate-700">
                  {error?.message ||
                    "Kesalahan tak terduga terjadi pada modul admin."}
                </p>
                {error?.digest ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Referensi:{" "}
                    <span className="font-mono">{error.digest}</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          {isDev && error?.stack ? (
            <details className="group">
              <summary className="cursor-pointer select-none rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                Tampilkan detail stack (DEV)
              </summary>
              <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-200">
                {error.stack}
              </pre>
            </details>
          ) : null}
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-end gap-2 border-t border-amber-100 pt-4">
          <Link href="/admin/laporan">
            <Button variant="outline" size="sm" className="gap-1">
              <ListChecks className="h-4 w-4" />
              <span>Laporan Admin</span>
            </Button>
          </Link>
          <Link href="/(workspace)/sekolah">
            <Button variant="outline" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              <span>Ke Workspace</span>
            </Button>
          </Link>
          <Button
            type="button"
            size="sm"
            onClick={() => reset()}
            className="gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Muat Ulang</span>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
