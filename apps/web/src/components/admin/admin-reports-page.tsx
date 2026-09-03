"use client";

import {
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Clock4,
  Loader2,
  RefreshCw,
  School,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminUsersRequest,
  workspaceAssignmentsRequest,
  type AdminSchoolOption,
  type AdminUserRecord,
  type WorkspaceAssignmentRecord,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type ReportStatusTone = "emerald" | "amber" | "rose" | "slate";

const REPORT_TABS = [
  { href: "/admin/laporan", label: "Ringkasan", key: "/admin/laporan" },
  { href: "/admin/laporan/verifikasi-online", label: "Verifikasi Online", key: "/admin/laporan/verifikasi-online" },
  { href: "/admin/laporan/wawancara", label: "Wawancara", key: "/admin/laporan/wawancara" },
  { href: "/admin/laporan/pra-bimtek", label: "Pra-Bimtek", key: "/admin/laporan/pra-bimtek" },
  { href: "/admin/laporan/pra-bimtek-ppk", label: "Pra-Bimtek PPK", key: "/admin/laporan/pra-bimtek-ppk" },
  { href: "/admin/laporan/konsentrasi-keahlian-prioritas", label: "Konsentrasi Keahlian", key: "/admin/laporan/konsentrasi-keahlian-prioritas" },
  { href: "/admin/laporan/gabungan", label: "Gabungan", key: "/admin/laporan/gabungan" },
  { href: "/admin/laporan/rpkp", label: "RPKP", key: "/admin/laporan/rpkp" },
];

export function AdminLaporanTabs() {
  const pathname = usePathname();
  const activeKey = (() => {
    if (pathname === "/admin/laporan") return "/admin/laporan";
    const match = REPORT_TABS.find((t) => pathname?.startsWith(t.key) && t.key !== "/admin/laporan");
    return match?.key ?? "/admin/laporan";
  })();

  return (
    <div className="-mx-1 overflow-x-auto">
      <nav role="tablist" className="flex min-w-max flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
        {REPORT_TABS.map((tab) => {
          const active = tab.key === activeKey;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              role="tab"
              aria-selected={active}
              className={
                "rounded-xl px-3.5 py-2 text-xs font-semibold leading-4 transition-colors whitespace-nowrap " +
                (active
                  ? "bg-white text-primary shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900")
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

interface ReportSchoolRow {
  no: number;
  npsn: string;
  nama: string;
  id: string;
  penggunaAkunStatus: "aktif" | "belum";
  rolePenggunaSekolah: string;
  statusPenugasan: "lengkap" | "administrasi" | "alat" | "belum";
  fasilitatorAdmin: string;
  fasilitatorAlat: string;
  totalPenugasan: number;
}

export function AdminReportsPage() {
  const { session, hydrated, hydrate } = useAuthStore();
  const token = session?.token ?? "";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [schools, setSchools] = useState<AdminSchoolOption[]>([]);
  const [assignments, setAssignments] = useState<WorkspaceAssignmentRecord[]>([]);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const results = await Promise.allSettled([
          adminUsersRequest(),
          token ? workspaceAssignmentsRequest(token) : Promise.resolve([] as WorkspaceAssignmentRecord[]),
        ]);
        if (cancelled) return;
        if (results[0].status === "fulfilled") {
          setUsers(results[0].value.users);
          setSchools(results[0].value.schools);
        }
        if (results[1].status === "fulfilled") setAssignments(results[1].value);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, token]);

  async function handleRefresh() {
    if (refreshing || !hydrated) return;
    setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        adminUsersRequest(),
        token ? workspaceAssignmentsRequest(token) : Promise.resolve([] as WorkspaceAssignmentRecord[]),
      ]);
      if (results[0].status === "fulfilled") {
        setUsers(results[0].value.users);
        setSchools(results[0].value.schools);
      }
      if (results[1].status === "fulfilled") setAssignments(results[1].value);
    } finally {
      setRefreshing(false);
    }
  }

  const summaryCards = useMemo(() => {
    const totalSekolah = schools.length;
    const totalPengguna = users.length;
    const totalPenugasan = assignments.length;
    const sekolahUser = users.filter((u) => u.roleCode === "SEKOLAH");
    const sekolahDenganAkunAktif = sekolahUser.filter((u) => u.isActive).length;
    const adminCount = users.filter((u) => u.roleCode === "ADMIN").length;
    const fasAdmCount = users.filter((u) => u.roleCode === "FASILITATOR_ADMINISTRASI" && u.isActive).length;
    const fasAlatCount = users.filter((u) => u.roleCode === "FASILITATOR_ALAT" && u.isActive).length;
    return [
      {
        title: "Total Sekolah",
        value: totalSekolah,
        icon: Building2,
        tone: "bg-primary/10 text-primary-700",
        sub: `${sekolahDenganAkunAktif} akun sekolah aktif`,
      },
      {
        title: "Total Pengguna",
        value: totalPengguna,
        icon: Users,
        tone: "bg-indigo-100 text-indigo-700",
        sub: `${users.filter((u) => u.isActive).length} akun aktif · ${adminCount} Admin`,
      },
      {
        title: "Total Penugasan",
        value: totalPenugasan,
        icon: ClipboardCheck,
        tone: "bg-emerald-100 text-emerald-700",
        sub: "Verifikasi · Wawancara · Bimtek",
      },
      {
        title: "Fasilitator Aktif",
        value: fasAdmCount + fasAlatCount,
        icon: School,
        tone: "bg-amber-100 text-amber-700",
        sub: `${fasAdmCount} Administrasi · ${fasAlatCount} Alat`,
      },
    ];
  }, [schools, assignments, users]);

  const reportRows: ReportSchoolRow[] = useMemo(() => {
    return schools.map((s, idx): ReportSchoolRow => {
      const sekolahUser = users.find(
        (u) =>
          (u.roleCode === "SEKOLAH" || u.roleCode?.startsWith("SEKOLAH")) &&
          (u.schoolId === s.id ||
            String(u.schoolName ?? "").trim() === String(s.name ?? "").trim() ||
            u.username.includes(s.npsn)),
      );
      const assigByNpsn = assignments.filter((a) => String(a.schoolNpsn ?? "").trim() === String(s.npsn ?? "").trim());
      const adminNames = Array.from(
        new Set(
          assigByNpsn
            .map((a) => a.facilitatorAdministrationName)
            .filter((name): name is string => Boolean(name && name.trim())),
        ),
      );
      const alatNames = Array.from(
        new Set(
          assigByNpsn
            .map((a) => a.facilitatorEquipmentName)
            .filter((name): name is string => Boolean(name && name.trim())),
        ),
      );
      const statusPenugasan: ReportSchoolRow["statusPenugasan"] =
        adminNames.length > 0 && alatNames.length > 0
          ? "lengkap"
          : adminNames.length > 0
            ? "administrasi"
            : alatNames.length > 0
              ? "alat"
              : "belum";
      return {
        no: idx + 1,
        npsn: s.npsn,
        nama: s.name?.trim() || "-",
        id: s.id,
        penggunaAkunStatus: sekolahUser?.isActive ? "aktif" : "belum",
        rolePenggunaSekolah: sekolahUser?.roleName ?? "Belum ada akun",
        statusPenugasan,
        fasilitatorAdmin: adminNames.length ? adminNames.join(", ") : "-",
        fasilitatorAlat: alatNames.length ? alatNames.join(", ") : "-",
        totalPenugasan: assigByNpsn.length,
      };
    });
  }, [schools, users, assignments]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return reportRows;
    return reportRows.filter(
      (r) =>
        r.nama.toLowerCase().includes(q) ||
        r.npsn.toLowerCase().includes(q) ||
        r.rolePenggunaSekolah.toLowerCase().includes(q) ||
        r.fasilitatorAdmin.toLowerCase().includes(q) ||
        r.fasilitatorAlat.toLowerCase().includes(q),
    );
  }, [query, reportRows]);

  const toneBadgeAkun = (status: "aktif" | "belum") => {
    const tone: ReportStatusTone = status === "aktif" ? "emerald" : "slate";
    const classBy: Record<ReportStatusTone, string> = {
      emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
      amber: "border-amber-200 bg-amber-50 text-amber-700",
      rose: "border-rose-200 bg-rose-50 text-rose-700",
      slate: "border-slate-200 bg-slate-50 text-slate-600",
    };
    return (
      <Badge variant="outline" className={`${classBy[tone]} rounded-full px-3 py-1`}>
        {tone === "emerald" ? (
          <CheckCircle2 className="mr-1.5 h-3 w-3" />
        ) : (
          <Clock4 className="mr-1.5 h-3 w-3" />
        )}
        {status === "aktif" ? "Akun Aktif" : "Belum Ada Akun"}
      </Badge>
    );
  };

  const toneBadgePenugasan = (status: ReportSchoolRow["statusPenugasan"]) => {
    const toneMap: Record<typeof status, ReportStatusTone> = {
      lengkap: "emerald",
      administrasi: "amber",
      alat: "amber",
      belum: "rose",
    };
    const tone = toneMap[status];
    const classBy: Record<ReportStatusTone, string> = {
      emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
      amber: "border-amber-200 bg-amber-50 text-amber-700",
      rose: "border-rose-200 bg-rose-50 text-rose-700",
      slate: "border-slate-200 bg-slate-50 text-slate-600",
    };
    const label = {
      lengkap: "Lengkap (Admin + Alat)",
      administrasi: "Hanya Fasilitator Administrasi",
      alat: "Hanya Fasilitator Alat",
      belum: "Belum Ada Penugasan",
    }[status];
    return (
      <Badge variant="outline" className={`${classBy[tone]} rounded-full px-3 py-1`}>
        {tone === "emerald" ? (
          <CheckCircle2 className="mr-1.5 h-3 w-3" />
        ) : tone === "rose" ? (
          <Wrench className="mr-1.5 h-3 w-3" />
        ) : (
          <Clock4 className="mr-1.5 h-3 w-3" />
        )}
        {label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <AdminLaporanTabs />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <BarChart3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Cari nama sekolah, NPSN, role pengguna, atau nama fasilitator..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-11"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="gap-2"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {refreshing ? "Memperbarui..." : "Perbarui"}
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      {card.title}
                    </p>
                    <p className="display-font mt-2 text-3xl font-semibold text-slate-950">
                      {card.value}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{card.sub}</p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${card.tone}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200 px-6 py-4 md:flex md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            Rekap Laporan per Sekolah
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500 md:mt-0">
            Menampilkan {filteredRows.length} dari {reportRows.length} sekolah.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[1240px] w-full text-sm">
              <thead className="bg-slate-100/80 text-slate-600">
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em]">
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">NPSN</th>
                  <th className="px-4 py-3">Nama Sekolah</th>
                  <th className="px-4 py-3">Akun Sekolah</th>
                  <th className="px-4 py-3">Status Penugasan Fasilitator</th>
                  <th className="px-4 py-3">Jumlah Penugasan</th>
                  <th className="px-4 py-3">Fasilitator Administrasi</th>
                  <th className="px-4 py-3">Fasilitator Alat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin align-middle" />
                      Memuat laporan...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      Tidak ada data yang sesuai dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id || row.npsn} className="align-top">
                      <td className="px-4 py-4 tabular-nums text-slate-500">{row.no}</td>
                      <td className="px-4 py-4 font-medium text-slate-700">{row.npsn}</td>
                      <td className="px-4 py-4 font-semibold text-slate-950">{row.nama}</td>
                      <td className="px-4 py-4">{toneBadgeAkun(row.penggunaAkunStatus)}</td>
                      <td className="px-4 py-4">{toneBadgePenugasan(row.statusPenugasan)}</td>
                      <td className="px-4 py-4 tabular-nums text-slate-700">
                        <Badge variant="outline" className="border-slate-200 bg-slate-50 rounded-full">
                          {row.totalPenugasan}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{row.fasilitatorAdmin}</td>
                      <td className="px-4 py-4 text-slate-600">{row.fasilitatorAlat}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
