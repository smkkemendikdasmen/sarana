"use client";

import {
  Building2,
  FileSignature,
  FileText,
  Gauge,
  Loader2,
  MapPin,
  Scroll,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DocumentEditablePreview,
  type DocumentKind,
} from "@/components/shared/document-editable-preview";
import { schoolProfileRequest, type SchoolProfileRecord } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type MainTabKey = "RPA" | "PKS";
type RpaSubTabKey = "NON_PARAF" | "PARAF";

const MAIN_TABS: Array<{ key: MainTabKey; label: string; icon: typeof FileText; hint: string }> = [
  {
    key: "RPA",
    label: "RPA",
    icon: Scroll,
    hint: "Rencana Penggunaan Alat (dokumen praktek pembelajaran) — ada 2 versi: Non Paraf (draft review) dan Paraf (final).",
  },
  {
    key: "PKS",
    label: "PKS",
    icon: FileSignature,
    hint: "Perjanjian Kerja Sama (PKS) antara sekolah dengan pihak pemberi bantuan.",
  },
];

const RPA_SUBTABS: Array<{ key: RpaSubTabKey; label: string; hint: string }> = [
  {
    key: "NON_PARAF",
    label: "RPA Non Paraf",
    hint: "Draft RPA untuk review internal, sebelum di-paraf Kepala Sekolah.",
  },
  {
    key: "PARAF",
    label: "RPA Paraf",
    hint: "RPA final yang sudah ditandatangani / di-paraf Kepala Sekolah.",
  },
];

export function SchoolRpaPksPage() {
  const router = useRouter();
  const { session, hydrated, hydrate } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [profile, setProfile] = useState<SchoolProfileRecord | null>(null);
  const [mainTab, setMainTab] = useState<MainTabKey>("RPA");
  const [rpaSubTab, setRpaSubTab] = useState<RpaSubTabKey>("NON_PARAF");

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && session?.user.role === "SEKOLAH") {
      router.replace("/sekolah/dashboard");
    }
  }, [hydrated, session?.user.role, router]);

  useEffect(() => {
    const token = session?.token;
    if (!hydrated || !token) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await schoolProfileRequest(token);
        if (!cancelled) setProfile(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat profil sekolah.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.token]);

  const activeMainTabDef = MAIN_TABS.find((t) => t.key === mainTab) ?? MAIN_TABS[0]!;
  const activeRpaSubTabDef = RPA_SUBTABS.find((t) => t.key === rpaSubTab) ?? RPA_SUBTABS[0]!;

  const documentKind: DocumentKind = useMemo(() => {
    if (mainTab === "PKS") return "PKS";
    return rpaSubTab === "NON_PARAF" ? "RPA_NON_PARAF" : "RPA_PARAF";
  }, [mainTab, rpaSubTab]);

  if (!hydrated || !session) {
    return (
      <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat session...
      </div>
    );
  }

  if (session.user.role !== "SEKOLAH") {
    return (
      <div className="rounded-[24px] border border-danger/15 bg-danger/[0.08] p-6 text-sm">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-danger" />
          <div>
            <p className="font-semibold text-danger">Akses Ditolak</p>
            <p className="mt-1 text-slate-600">
              Halaman RPA &amp; PKS hanya dapat diakses oleh pengguna dengan Role <strong>SEKOLAH</strong>.
              Silakan gunakan akun sekolah (username = NPSN) untuk mengakses dokumen ini.
            </p>
            <Link href="/dashboard/sekolah" className="mt-4 inline-flex">
              <Button variant="outline" type="button">
                <Gauge className="h-4 w-4" />
                Kembali ke Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-primary/12 bg-gradient-to-br from-primary/[0.08] via-white to-slate-50 p-5 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-primary/20 bg-white shadow-sm">
              <FileSignature className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">
                Dokumen Sekolah
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-950">
                RPA &amp; PKS
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Dokumen Rencana Penggunaan Alat (RPA) dan Perjanjian Kerja Sama (PKS) untuk sekolah penerima bantuan.
                Preview format dokumen dapat diedit isiannya (data sekolah, data PPK, nomor/tanggal dokumen) melalui tombol edit di bawah. Perubahan disimpan secara lokal per sekolah.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat profil sekolah...
          </div>
        ) : error ? (
          <div className="mt-5 rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : profile ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Sekolah
              </p>
              <div className="mt-2 flex items-start gap-2">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="font-semibold text-slate-900 leading-5">
                  {profile.schoolName || "-"}
                </p>
              </div>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                NPSN
              </p>
              <div className="mt-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <p className="font-mono font-semibold text-slate-900">
                  {profile.npsn || "-"}
                </p>
              </div>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Provinsi
              </p>
              <div className="mt-2 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <p className="font-medium text-slate-800">
                  {profile.province || "-"}
                </p>
              </div>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Kab / Kota
              </p>
              <div className="mt-2 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <p className="font-medium text-slate-800">
                  {profile.city || "-"}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {MAIN_TABS.map((tab) => {
          const active = tab.key === mainTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMainTab(tab.key)}
              className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                active
                  ? "border-primary bg-primary text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:text-primary"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-[20px] border border-primary/12 bg-primary/[0.06] p-4 text-sm text-slate-700">
        <p className="font-semibold text-primary">
          {activeMainTabDef.label}
        </p>
        <p className="mt-2 leading-6">
          {activeMainTabDef.hint}
        </p>
      </div>

      {mainTab === "RPA" ? (
        <div className="flex flex-wrap gap-2 rounded-[20px] border border-slate-200 bg-white p-3">
          {RPA_SUBTABS.map((tab) => {
            const active = tab.key === rpaSubTab;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRpaSubTab(tab.key)}
                title={tab.hint}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-slate-200 bg-white text-slate-600 hover:border-primary/30 hover:text-primary"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <DocumentEditablePreview
        schoolKey={profile?.npsn || profile?.schoolId || session?.user?.id || "sekolah"}
        schoolName={profile?.schoolName || ""}
        schoolNpsn={profile?.npsn || ""}
        schoolProvince={profile?.province || ""}
        schoolCity={profile?.city || ""}
        schoolAddress={profile?.address || ""}
        kind={documentKind}
        readOnly={false}
      />
    </div>
  );
}
