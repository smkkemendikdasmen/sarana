"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, ArrowLeft, Home, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useAuthSession } from "@/hooks/use-auth-session";
import { dashboardPath } from "@/lib/roles";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const auth = useAuthSession();
  const isDev =
    typeof process !== "undefined" && process.env?.NODE_ENV !== "production";

  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error("[RootError] Unhandled runtime error:", error);
    }
  }, [error]);

  const dashboardHref = auth?.role ? dashboardPath(auth.role as never) : "/login";

  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50">
        <div className="flex min-h-screen items-center justify-center p-4 sm:p-8">
          <Card className="w-full max-w-lg border border-slate-200 shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-700 ring-1 ring-rose-200">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-rose-700">
                    Terjadi kesalahan sistem
                  </h1>
                  <p className="text-sm text-slate-500">
                    {isDev
                      ? "Mode pengembangan — detail error ditampilkan di bawah."
                      : "Silakan coba lagi atau hubungi admin jika berulang."}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="rounded-md border border-slate-200 bg-white p-4 text-sm">
                <p className="font-medium text-slate-900">Pesan:</p>
                <p className="mt-1 text-slate-700">
                  {error?.message || "Kesalahan tidak diketahui."}
                </p>
                {error?.digest ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Digest: <span className="font-mono">{error.digest}</span>
                  </p>
                ) : null}
              </div>
              {isDev && error?.stack ? (
                <details className="group">
                  <summary className="cursor-pointer select-none rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100">
                    Tampilkan stack trace (DEV only)
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-slate-200 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-200">
                    {error.stack}
                  </pre>
                </details>
              ) : null}
            </CardContent>
            <CardFooter className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <Link href="/login">
                <Button variant="outline" size="sm" className="gap-1">
                  <Home className="h-4 w-4" />
                  <span>Login</span>
                </Button>
              </Link>
              <Link href={dashboardHref}>
                <Button variant="outline" size="sm" className="gap-1">
                  <ArrowLeft className="h-4 w-4" />
                  <span>Dashboard</span>
                </Button>
              </Link>
              <Button
                type="button"
                size="sm"
                onClick={() => reset()}
                className="gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Coba Lagi</span>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </body>
    </html>
  );
}
