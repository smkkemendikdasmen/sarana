"use client";

import {
  Activity,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock4,
  Database,
  FileSignature,
  Loader2,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminUsersRequest,
  workspaceAssignmentsRequest,
  type AdminUserRecord,
  type WorkspaceAssignmentRecord,
} from "@/lib/api";
import { APP_VERSION, APP_CHANGELOG } from "@/lib/version";
import { useAuthStore } from "@/store/auth-store";

type AuditTone = "primary" | "success" | "warning" | "danger" | "slate";

interface AuditLogRow {
  id: string;
  version: string;
  timestamp: string;
  category: "SISTEM" | "PENGGUNA" | "PENUGASAN" | "VERIFIKASI" | "PROFIL_SEKOLAH";
  module: string;
  actor: string;
  actorRole: string;
  action: string;
  subject: string;
  changeDetail: string;
  tone: AuditTone;
}

export default function AuditLogPage() {
  const { session, hydrated, hydrate } = useAuthStore();
  const token = session?.token ?? "";
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<AuditLogRow["category"] | "ALL">("ALL");
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [assignments, setAssignments] = useState<WorkspaceAssignmentRecord[]>([]);

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
        if (results[0].status === "fulfilled") setUsers(results[0].value.users);
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
      if (results[0].status === "fulfilled") setUsers(results[0].value.users);
      if (results[1].status === "fulfilled") setAssignments(results[1].value);
    } finally {
      setRefreshing(false);
    }
  }

  const summaryCards = useMemo(() => {
    return [
      {
        title: "Versi Aplikasi",
        value: APP_VERSION,
        icon: Activity,
        tone: "bg-primary/10 text-primary-700",
        sub: `${APP_CHANGELOG[0]?.date ?? ""} · Changelog terbaru`,
      },
      {
        title: "Perubahan Terdaftar",
        value: APP_CHANGELOG.length,
        icon: ScrollText,
        tone: "bg-indigo-100 text-indigo-700",
        sub: "Rilis & patch yang tercatat",
      },
      {
        title: "Aktivitas Pengguna",
        value: users.length,
        icon: UserRound,
        tone: "bg-emerald-100 text-emerald-700",
        sub: `${users.filter((u) => u.isActive).length} akun aktif`,
      },
      {
        title: "Total Penugasan Fasilitator",
        value: assignments.length,
        icon: FileSignature,
        tone: "bg-amber-100 text-amber-700",
        sub: "Verifikasi · Wawancara · Bimtek",
      },
    ];
  }, [users, assignments]);

  const rows: AuditLogRow[] = useMemo(() => {
    const list: AuditLogRow[] = [];

    const pad = (n: number) => String(n).padStart(2, "0");
    const isoLocal = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const now = new Date();
    let idx = 0;

    for (let ci = 0; ci < APP_CHANGELOG.length; ci += 1) {
      const entry = APP_CHANGELOG[ci];
      idx += 1;
      list.push({
        id: `changelog-${ci}`,
        version: entry.version,
        timestamp: entry.date,
        category: "SISTEM",
        module: "Release Aplikasi",
        actor: "SARANA SMK",
        actorRole: "SYSTEM",
        action: "Rilis / Patch",
        subject: entry.version,
        changeDetail: entry.summary,
        tone: entry.summary.includes("Perbaikan") ? "warning" : "primary",
      });
    }

    const usersSorted = [...users].sort((a, b) => {
      const ad = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bd = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bd - ad;
    });
    for (let i = 0; i < usersSorted.length; i += 1) {
      const u = usersSorted[i];
      const d = u.createdAt ? new Date(u.createdAt) : new Date(now.getTime() - i * 3600_000);
      idx += 1;
      list.push({
        id: `user-create-${u.id ?? i}`,
        version: APP_VERSION,
        timestamp: isoLocal(d),
        category: "PENGGUNA",
        module: "Manajemen Pengguna",
        actor: "Admin",
        actorRole: "ADMIN",
        action: "Buat Akun",
        subject: `${u.roleName} · ${u.username}`,
        changeDetail: `Akun ${u.fullName} (${u.roleCode})${u.isActive ? " diaktifkan" : " dinonaktifkan"}${u.schoolName ? " untuk sekolah " + u.schoolName : ""}.`,
        tone: u.isActive ? "success" : "slate",
      });

      if (u.passwordChangedAt) {
        idx += 1;
        list.push({
          id: `user-chpass-${u.id ?? i}`,
          version: APP_VERSION,
          timestamp: isoLocal(new Date(u.passwordChangedAt)),
          category: "PENGGUNA",
          module: "Manajemen Pengguna",
          actor: u.username,
          actorRole: u.roleCode,
          action: "Ubah Password",
          subject: `${u.roleName} · ${u.username}`,
          changeDetail: `Pengguna mengganti password default ke password pribadi.`,
          tone: "primary",
        });
      }
    }

    const assigSorted = [...assignments]
      .filter(
        (a) =>
          a.facilitatorAdministrationName ||
          a.facilitatorEquipmentName ||
          a.interviewScheduledDate,
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    for (let i = 0; i < assigSorted.length; i += 1) {
      const a = assigSorted[i];
      if (a.moduleKey === "verifikasi-online" && a.updatedAt) {
        idx += 1;
        list.push({
          id: `verif-${a.key ?? i}`,
          version: APP_VERSION,
          timestamp: a.updatedAt,
          category: "VERIFIKASI",
          module: a.moduleLabel || "Verifikasi Online",
          actor: [a.facilitatorAdministrationName, a.facilitatorEquipmentName]
            .filter(Boolean)
            .join(" & ") || "Fasilitator",
          actorRole: "FASILITATOR",
          action: "Lakukan Verifikasi",
          subject: `Sekolah ${a.schoolNpsn ?? "-"} · ${a.schoolName ?? ""}`.trim(),
          changeDetail: `Modul ${a.moduleLabel ?? a.moduleKey} (Sumber: ${a.sourceLabel}).${a.interviewScheduledDate ? ` Wawancara dijadwalkan: ${a.interviewScheduledDate}${a.interviewScheduledTime ? " " + a.interviewScheduledTime : ""}.` : ""}`,
          tone: "success",
        });
      } else {
        idx += 1;
        const admins = [a.facilitatorAdministrationName, a.facilitatorEquipmentName].filter(Boolean).join(", ") || "Fasilitator";
        list.push({
          id: `assig-${a.key ?? i}`,
          version: APP_VERSION,
          timestamp: a.updatedAt,
          category: "PENUGASAN",
          module: a.moduleLabel || "Pembagian Tugas",
          actor: "Admin",
          actorRole: "ADMIN",
          action: a.interviewScheduledDate ? "Jadwalkan Wawancara" : "Tugaskan Fasilitator",
          subject: `Sekolah ${a.schoolNpsn ?? "-"} · ${a.schoolName ?? ""}`.trim(),
          changeDetail: `${admins} ditugaskan untuk modul ${a.moduleKey} (${a.sourceLabel}).${a.interviewScheduledDate ? ` Jadwal: ${a.interviewScheduledDate}${a.interviewScheduledTime ? " " + a.interviewScheduledTime : ""}` : ""}${a.interviewMeetingLink ? ` · Link: ${a.interviewMeetingLink}` : ""}.`,
          tone: "warning",
        });
      }
    }

    list.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return list;
  }, [users, assignments]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = rows;
    if (filterCategory !== "ALL") {
      out = out.filter((r) => r.category === filterCategory);
    }
    if (!q) return out;
    return out.filter(
      (r) =>
        r.version.toLowerCase().includes(q) ||
        r.actor.toLowerCase().includes(q) ||
        r.action.toLowerCase().includes(q) ||
        r.subject.toLowerCase().includes(q) ||
        r.changeDetail.toLowerCase().includes(q) ||
        r.module.toLowerCase().includes(q),
    );
  }, [query, filterCategory, rows]);

  const categoryFilterOptions: Array<{ key: AuditLogRow["category"] | "ALL"; label: string }> = [
    { key: "ALL", label: "Semua Kategori" },
    { key: "SISTEM", label: "Sistem / Rilis" },
    { key: "PENGGUNA", label: "Pengguna" },
    { key: "PENUGASAN", label: "Penugasan" },
    { key: "VERIFIKASI", label: "Verifikasi" },
    { key: "PROFIL_SEKOLAH", label: "Profil Sekolah" },
  ];

  const toneCatClass: Record<AuditTone, string> = {
    primary: "border-primary/20 bg-primary/10 text-primary-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
  };

  const toneActClass: Record<AuditTone, string> = {
    primary: "border-primary/20 bg-primary/5 text-primary-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };

  const toneCatIcon = (cat: AuditLogRow["category"]) => {
    switch (cat) {
      case "SISTEM":
        return Activity;
      case "PENGGUNA":
        return UserRound;
      case "PENUGASAN":
        return FileSignature;
      case "VERIFIKASI":
        return CheckCircle2;
      case "PROFIL_SEKOLAH":
        return Building2;
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <ScrollText className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Cari versi, aktor, aksi, subjek, atau detail perubahan..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-11"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categoryFilterOptions.map((opt) => {
            const active = filterCategory === opt.key;
            return (
              <Button
                key={opt.key}
                type="button"
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterCategory(opt.key)}
                className={
                  active ? "gap-1.5" : "gap-1.5 border-slate-200 text-slate-600 hover:bg-slate-50"
                }
              >
                {opt.key === "ALL" ? <Database className="h-3.5 w-3.5" /> : null}
                {opt.label}
              </Button>
            );
          })}
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

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200 px-6 py-4 md:flex md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Audit Log Perubahan
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500 md:mt-0">
            Menampilkan {filteredRows.length} dari {rows.length} catatan.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[1480px] w-full text-sm">
              <thead className="bg-slate-100/80 text-slate-600">
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em]">
                  <th className="px-4 py-3">Versi</th>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Kategori</th>
                  <th className="px-4 py-3">Modul</th>
                  <th className="px-4 py-3">Aktor</th>
                  <th className="px-4 py-3">Aksi</th>
                  <th className="px-4 py-3">Subjek</th>
                  <th className="px-4 py-3 min-w-[420px]">Detail Perubahan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin align-middle" />
                      Memuat audit log...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-500">
                      Tidak ada catatan yang sesuai.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => {
                    const CatIcon = toneCatIcon(row.category);
                    return (
                      <tr key={row.id} className="align-top hover:bg-slate-50/60">
                        <td className="px-4 py-4">
                          <Badge
                            variant="outline"
                            className="border-primary/20 bg-primary/5 text-primary-700 rounded-lg px-2.5 py-1 font-mono"
                          >
                            v{row.version}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 tabular-nums text-xs text-slate-600 whitespace-nowrap">
                          <Clock4 className="mr-1 inline h-3 w-3 -mt-0.5 text-slate-400" />
                          {row.timestamp}
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            variant="outline"
                            className={`${toneCatClass[row.tone]} rounded-full px-2.5 py-1`}
                          >
                            <CatIcon className="mr-1.5 h-3 w-3" />
                            {row.category}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{row.module}</td>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-medium text-slate-800">{row.actor}</p>
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                              {row.actorRole}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge
                            variant="outline"
                            className={`${toneActClass[row.tone]} rounded-lg px-2.5 py-1`}
                          >
                            {row.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-slate-800 font-medium">{row.subject}</td>
                        <td className="px-4 py-4 text-slate-600 leading-7">{row.changeDetail}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
