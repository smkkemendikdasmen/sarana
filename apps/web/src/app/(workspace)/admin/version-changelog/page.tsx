"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { APP_CHANGELOG, APP_VERSION } from "@/lib/version";
import { useAuthStore } from "@/store/auth-store";
import { NotebookPen, Rocket, Search, ShieldCheck, Star, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

export default function VersionChangelogPage() {
  const { session, hydrated, hydrate } = useAuthStore();
  const [query, setQuery] = useState("");

  if (!hydrated) {
    void hydrate();
  }

  const roleCanAccess = session?.user?.role === "SUPERADMIN" || session?.user?.role === "ADMIN";

  const filtered = useMemo(() => {
    const list = [...APP_CHANGELOG];
    if (!query.trim()) return list;
    const q = query.trim().toLowerCase();
    return list.filter((e) => {
      return (
        e.version.toLowerCase().includes(q) ||
        e.date.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q)
      );
    });
  }, [query]);

  const current = APP_CHANGELOG.find((e) => e.version === APP_VERSION) ?? APP_CHANGELOG[0];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-10">
        {/* ===== Header: Current Version ===== */}
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-slate-400">
            <Rocket className="h-3.5 w-3.5 text-emerald-500" />
            Release Notes · SARANA SMK
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 lg:text-3xl">
                Versi & Catatan Rilis <span className="text-emerald-600">v{APP_VERSION}</span>
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Halaman ini menampilkan catatan rilis setiap perubahan major/minor aplikasi
                SARANA SMK, termasuk fitur baru, perbaikan performa, dan stabilitas.
                {roleCanAccess ? (
                  <span className="mt-0.5 block text-[11.5px] font-semibold text-emerald-600">
                    ✓ Akses Admin — Anda dapat melihat semua versi rilis aplikasi.
                  </span>
                ) : (
                  <span className="mt-0.5 block text-[11.5px] font-semibold text-amber-600">
                    ⚠ Halaman ini hanya untuk role ADMIN / SUPERADMIN.
                  </span>
                )}
              </p>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-80">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <Input
                placeholder="Cari versi / tanggal / catatan..."
                value={query}
                onChange={(ev) => setQuery(ev.target.value)}
                className="h-9 text-[12.5px]"
              />
            </div>
          </div>
        </div>

        {/* ===== Current Version Highlight ===== */}
        {current && !query.trim() ? (
          <Card className="mb-6 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white shadow-lg shadow-emerald-100/60">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="default"
                  className="rounded-full bg-emerald-600 px-3 py-0.5 text-[11px] font-bold text-white"
                >
                  <Star className="mr-1 h-3 w-3" />
                  RELEASED TODAY · CURRENT
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-slate-300 bg-white text-slate-700 px-3 py-0.5 text-[11px] font-bold"
                >
                  <ShieldCheck className="mr-1 h-3 w-3 text-emerald-600" />
                  Produksi · saranasmk.id
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-amber-300 bg-amber-50 text-amber-800 px-3 py-0.5 text-[11px] font-bold"
                >
                  <Wrench className="mr-1 h-3 w-3" />
                  MAJOR RELEASE
                </Badge>
                <span className="ml-auto text-[12px] font-semibold text-slate-500 tabular-nums">
                  Released · {current.date}
                </span>
              </div>
              <CardTitle className="mt-3 text-2xl font-black text-slate-900">
                <NotebookPen className="mr-2 inline-block h-7 w-7 align-middle text-emerald-600" />
                <span className="font-mono">v{current.version}</span>
              </CardTitle>
              <CardDescription className="mt-1 text-[13px] leading-6 text-slate-500">
                Rilis MAJOR. Upgrade diwajibkan untuk seluruh role (Sekolah · Fasilitator Alat ·
                Fasilitator Administrasi · Admin). Telah dibackup penuh sebelum deploy.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-[13px] leading-6 text-slate-700">
                {current.summary.split(/\s+\[\d+\]\s+/).filter(Boolean).map((point, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-[11px] font-black text-white shadow-sm">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">
                      {point.startsWith("[") ? point.replace(/^\d+\]\s*/, "") : point}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {/* ===== Timeline Previous Versions ===== */}
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-[0.18em] text-slate-500">
            {query.trim() ? `Hasil pencarian (${filtered.length})` : `Arsip Versi Sebelumnya (${filtered.length})`}
          </h2>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setQuery("")}
            disabled={!query.trim()}
            className="h-8 text-[11.5px]"
          >
            Reset filter
          </Button>
        </div>

        <div className="space-y-4">
          {filtered.map((entry) => {
            const isCurrent = entry.version === APP_VERSION;
            return (
              <Card
                key={entry.version}
                className={`border shadow-sm ${
                  isCurrent
                    ? "border-emerald-200 ring-1 ring-emerald-100"
                    : "border-slate-200"
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={isCurrent ? "default" : "outline"}
                      className={`rounded-full px-3 py-0.5 text-[11px] font-bold ${
                        isCurrent
                          ? "bg-slate-900 text-white"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      <span className="mr-1 font-mono">v{entry.version}</span>
                      {isCurrent && " · AKTIF"}
                    </Badge>
                    <span className="text-[11.5px] font-semibold text-slate-500 tabular-nums">
                      {entry.date}
                    </span>
                  </div>
                  <CardTitle className="mt-1.5 text-base font-extrabold text-slate-800">
                    {isCurrent ? "Versi Saat Ini · " : "Versi "}
                    <span className="font-mono">v{entry.version}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3.5 text-[12.5px] leading-6 text-slate-600 whitespace-pre-wrap">
                    {entry.summary}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 ? (
            <Card className="border-dashed border-slate-300 bg-white/70">
              <CardContent className="py-14 text-center">
                <Search className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                <p className="text-sm font-semibold text-slate-600">
                  Tidak ada catatan rilis yang cocok dengan pencarian Anda.
                </p>
                <p className="mt-1 text-[12px] text-slate-400">
                  Coba kata kunci lain, atau reset filter untuk melihat semua versi.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-4 text-[11.5px] leading-5 text-slate-500">
          <p className="font-semibold text-slate-700">Catatan Deploy Versi 2.0.0 — Produksi saranasmk.id</p>
          <ul className="mt-1.5 space-y-1 pl-4 list-disc">
            <li>Backup lengkap produksi sebelum deploy: MySQL dump + apps source tarball + env files.</li>
            <li>
              Prosedur deploy aman: build lokal sukses (TSC exit 0), rsync ke production, build ulang di
              server (Next.js standalone + Nest.js dist), restart PM2 saranasmk-api dan saranasmk-web.
            </li>
            <li>
              Data existing di MySQL (profil sekolah, user, assignments, dll.){" "}
              <span className="font-bold text-slate-800">TIDAK dimodifikasi / dihapus</span> —
              migration workspace-data master template bersifat idempotent.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
