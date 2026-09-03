"use client";

import {
  Building2,
  FileSignature,
  FileText,
  Loader2,
  MapPin,
  Scroll,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DocumentEditablePreview,
  type DocumentKind,
} from "@/components/shared/document-editable-preview";
import {
  schoolProfileRequest,
  type SchoolProfileRecord,
  workspaceAssignmentsRequest,
  workspaceAssignmentSourceRequest,
  type WorkspaceAssignmentRecord,
} from "@/lib/api";
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

type PilihanSekolah = {
  key: string;
  npsn: string;
  nama: string;
  sourceTab: string;
  provinsi?: string;
  kabKota?: string;
};

function normalizeUserName(name: string | null | undefined) {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function pickSchoolNpsn(raw: object | null | undefined): string {
  if (!raw) return "";
  const r = raw as Record<string, unknown>;
  const candidates = [r.npsn, r.NPSN, r["NPSN"], r.nisn, r["Kode NPSN"]];
  for (const v of candidates) {
    if (v === null || v === undefined) continue;
    const s = typeof v === "number" ? v.toFixed(0) : String(v).trim();
    const digits = s.replace(/[^0-9]/g, "");
    if (digits.length >= 6) return digits;
  }
  return "";
}

function normalizeText(v: unknown): string {
  if (v === null || v === undefined) return "-";
  const s = String(v).trim();
  return s || "-";
}

export function FacilitatorAdministrasiRpaPksPage() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [listSekolah, setListSekolah] = useState<PilihanSekolah[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [profile, setProfile] = useState<SchoolProfileRecord | null>(null);
  const [mainTab, setMainTab] = useState<MainTabKey>("RPA");
  const [rpaSubTab, setRpaSubTab] = useState<RpaSubTabKey>("NON_PARAF");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const token = session?.token;
    const userId = session?.user?.id;
    const userName = session?.user?.fullName;
    if (!hydrated || !token || !userId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError("");
      try {
        const normalizedName = normalizeUserName(userName);
        const assignments = await workspaceAssignmentsRequest(token, {
          moduleKey: "verifikasi-online",
          facilitatorAdministrationId: userId,
        });
        const matchedAssignments: WorkspaceAssignmentRecord[] = assignments.filter((rec) => {
          if (rec.moduleKey !== "verifikasi-online") return false;
          if (rec.facilitatorAdministrationId === userId) return true;
          if (normalizedName && normalizeUserName(rec.facilitatorAdministrationName) === normalizedName) return true;
          return false;
        });

        let finalAssignments: WorkspaceAssignmentRecord[] = matchedAssignments;
        if (finalAssignments.length === 0) {
          finalAssignments = [
            {
              key: `seed-admin-rpa-pks-${userId}-${Date.now()}`,
              moduleKey: "verifikasi-online",
              moduleLabel: "Verifikasi Online Administrasi",
              sourceTab: "abt",
              sourceLabel: "data sekolah penerima bantuan ABT",
              schoolNo: 1,
              schoolNpsn: "10110273",
              schoolName: "SMK NEGERI 1 ARONGAN LAMBALEK",
              facilitatorAdministrationId: userId,
              facilitatorAdministrationName: userName ?? "Fasilitator Administrasi",
              facilitatorEquipmentId: "",
              facilitatorEquipmentName: "",
              interviewScheduledDate: null,
              interviewScheduledTime: null,
              interviewMeetingLink: null,
              updatedAt: new Date().toISOString(),
            },
          ];
        }

        const provMap = new Map<string, { provinsi: string; kabKota: string }>();
        try {
          const sourceRows = await workspaceAssignmentSourceRequest(token, "abt");
          for (const src of sourceRows) {
            const npsn = pickSchoolNpsn(src);
            if (!npsn) continue;
            const prov = normalizeText(
              (src as Record<string, unknown>).provinsi ??
                (src as Record<string, unknown>)["Provinsi"] ??
                (src as Record<string, unknown>).province ??
                "",
            );
            const kab = normalizeText(
              (src as Record<string, unknown>).kab_kota ??
                (src as Record<string, unknown>)["Kab/Kota"] ??
                (src as Record<string, unknown>).city ??
                "",
            );
            if (prov !== "-" || kab !== "-") {
              provMap.set(npsn, { provinsi: prov, kabKota: kab });
            }
          }
        } catch {
          // ignore source load failure (provinsi default nanti diambil dari profile API)
        }

        const pilihan: PilihanSekolah[] = finalAssignments.map((rec, idx) => {
          const npsn = rec.schoolNpsn || pickSchoolNpsn(rec as unknown as object);
          const fromMap = provMap.get(npsn);
          return {
            key: rec.key ?? `opt-${idx}`,
            npsn: npsn || String(rec.schoolNo ?? idx + 1),
            nama: normalizeText(rec.schoolName),
            sourceTab: rec.sourceTab,
            provinsi: fromMap?.provinsi ? normalizeText(fromMap.provinsi) : undefined,
            kabKota: fromMap?.kabKota ? normalizeText(fromMap.kabKota) : undefined,
          };
        });

        const uniqueByNpsn = new Map<string, PilihanSekolah>();
        for (const o of pilihan) {
          if (o.npsn && !uniqueByNpsn.has(o.npsn)) uniqueByNpsn.set(o.npsn, o);
          else if (!o.npsn) uniqueByNpsn.set(o.key, o);
        }
        const deduped = Array.from(uniqueByNpsn.values());

        setListSekolah(deduped);
        setSelectedKey(deduped[0]?.key ?? "");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat daftar sekolah binaan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.token, session?.user?.id, session?.user?.fullName]);

  const currentPilihan: PilihanSekolah | undefined = useMemo(() => {
    if (!selectedKey) return listSekolah[0];
    return listSekolah.find((s) => s.key === selectedKey) ?? listSekolah[0];
  }, [listSekolah, selectedKey]);

  useEffect(() => {
    const token = session?.token;
    const npsn = currentPilihan?.npsn;
    if (!token || !npsn) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const data = await schoolProfileRequest(token);
        if (!cancelled) {
          setProfile({
            ...data,
            schoolName: currentPilihan?.nama && currentPilihan.nama !== "-" ? currentPilihan.nama : data.schoolName,
            npsn: npsn || data.npsn,
            province:
              currentPilihan?.provinsi && currentPilihan.provinsi !== "-"
                ? currentPilihan.provinsi
                : data.province,
            city:
              currentPilihan?.kabKota && currentPilihan.kabKota !== "-"
                ? currentPilihan.kabKota
                : data.city,
          });
        }
      } catch {
        if (!cancelled) {
          setProfile({
            schoolId: "",
            schoolName: currentPilihan?.nama ?? "-",
            npsn: npsn,
            province: currentPilihan?.provinsi ?? "-",
            city: currentPilihan?.kabKota ?? "-",
            address: "-",
            principalName: "-",
            concentrations: [],
          } as unknown as SchoolProfileRecord);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.token, currentPilihan]);

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

  if (
    session.user.role !== "FASILITATOR_ADMINISTRASI" &&
    session.user.role !== "ADMIN"
  ) {
    return (
      <div className="rounded-[24px] border border-danger/15 bg-danger/[0.08] p-6 text-sm">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-danger" />
          <div>
            <p className="font-semibold text-danger">Akses Ditolak</p>
            <p className="mt-1 text-slate-600">
              Halaman RPA &amp; PKS Sekolah Binaan hanya dapat diakses oleh Fasilitator Administrasi.
            </p>
            <Link href="/dashboard/fasilitator-administrasi" className="mt-4 inline-flex">
              <Button variant="outline" type="button">
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
      <Card className="overflow-hidden rounded-[28px] border border-primary/12 bg-gradient-to-br from-primary/[0.08] via-white to-slate-50 shadow-sm">
        <div className="p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-primary/20 bg-white shadow-sm">
                <FileSignature className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">
                  Dokumen Administrasi Sekolah Binaan
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-950">
                  RPA &amp; PKS - Sekolah Didampingi
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Fasilitator Administrasi dapat memverifikasi dokumen RPA dan PKS dari sekolah binaan.
                  Pilih sekolah pada daftar dibawah untuk melihat preview dokumen, edit isian data sekolah dan PPK secara langsung, serta print / download hasil.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-[20px] border border-slate-200 bg-white p-4 md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="flex-1 md:max-w-[560px]">
                <label className="text-sm font-semibold text-slate-800">
                  <span className="inline-flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-primary" />
                    Pilih Sekolah Didampingi (Administrasi)
                  </span>
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Daftar sekolah yang tercatat dalam pembagian tugas fasilitator administrasi pada Modul Verifikasi Online.
                </p>
                <div className="mt-3">
                  {loading ? (
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memuat daftar sekolah binaan...
                    </div>
                  ) : error ? (
                    <div className="rounded-full border border-danger/20 bg-danger/[0.08] px-4 py-2.5 text-sm text-danger">
                      {error}
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={selectedKey}
                        onChange={(e) => setSelectedKey(e.target.value)}
                        className="h-11 w-full appearance-none rounded-[14px] border border-slate-300 bg-white pr-12 pl-4 text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      >
                        {listSekolah.length === 0 ? (
                          <option value="">Belum ada sekolah didampingi</option>
                        ) : null}
                        {listSekolah.map((s) => (
                          <option key={s.key} value={s.key}>
                            [{s.sourceTab.toUpperCase()}] NPSN {s.npsn || "-"} — {s.nama}
                            {(s.provinsi && s.provinsi !== "-") || (s.kabKota && s.kabKota !== "-")
                              ? ` | ${s.kabKota && s.kabKota !== "-" ? s.kabKota : ""}${s.provinsi && s.provinsi !== "-" ? ` - ${s.provinsi}` : ""}`
                              : ""}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                          aria-hidden="true"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 011.08 1.04l-4.24 4.38a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[18px] border border-primary/15 bg-primary/[0.06] px-4 py-3 text-xs text-slate-700 md:max-w-[360px]">
                <p className="font-semibold text-primary">Total Sekolah Didampingi</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {listSekolah.length} <span className="text-sm font-medium text-slate-500">sekolah</span>
                </p>
              </div>
            </div>
          </div>

          {profile ? (
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
      </Card>

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
                title={tab.hint}
                onClick={() => setRpaSubTab(tab.key)}
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
        schoolKey={
          currentPilihan?.npsn ||
          profile?.npsn ||
          profile?.schoolId ||
          selectedKey ||
          currentPilihan?.key ||
          "fasil-adm-sekolah"
        }
        schoolName={profile?.schoolName || currentPilihan?.nama || ""}
        schoolNpsn={profile?.npsn || currentPilihan?.npsn || ""}
        schoolProvince={profile?.province || currentPilihan?.provinsi || ""}
        schoolCity={profile?.city || currentPilihan?.kabKota || ""}
        schoolAddress={profile?.address || ""}
        kind={documentKind}
        readOnly={false}
      />
    </div>
  );
}
