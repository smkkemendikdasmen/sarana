import Link from "next/link";
import { Home, LogIn, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-8">
      <Card className="w-full max-w-md border border-slate-200 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 ring-1 ring-slate-200">
              <SearchX className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-5xl font-extrabold tracking-tight text-slate-900">
                404
              </p>
              <h1 className="text-lg font-semibold text-slate-900">
                Halaman tidak ditemukan
              </h1>
              <p className="max-w-sm text-sm text-slate-500">
                Alamat yang Anda cari tidak ada atau telah dipindahkan.
                Silakan periksa kembali URL atau kembali ke halaman utama.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-4">
          <Link href="/login">
            <Button variant="outline" size="sm" className="gap-1">
              <LogIn className="h-4 w-4" />
              <span>Login</span>
            </Button>
          </Link>
          <Link href="/">
            <Button size="sm" className="gap-1">
              <Home className="h-4 w-4" />
              <span>Ke Halaman Utama</span>
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
