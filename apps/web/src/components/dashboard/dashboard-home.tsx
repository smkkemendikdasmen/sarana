"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, Calendar, Clock, ExternalLink, Info, LoaderCircle, BellRing, Video, BookOpen, HardHat, MapPin } from "lucide-react";

import { dashboardRequest, schoolProfileRequest, workspaceAssignmentsRequest, type WorkspaceAssignmentRecord } from "@/lib/api";
import { emptyDashboard, roleSummaries, type DashboardPayload } from "@/lib/dashboard-content";
import { roleLabels, type AuthSession } from "@/lib/roles";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SchoolProfileCard } from "@/components/dashboard/school-profile-card";
import { SectionCard } from "@/components/dashboard/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface DashboardHomeProps {
  roleSlug: string;
  session: AuthSession;
}

function formatInterviewDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (!Number.isFinite(d.getTime())) return raw;
  return d.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatInterviewTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/^\d{2}:\d{2}/.test(raw.trim())) return raw.trim().slice(0, 5) + " WIB";
  const d = new Date(`2000-01-01T${raw.trim()}`);
  if (Number.isFinite(d.getTime())) return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
  return raw.trim();
}

function getInterviewStatus(scheduled: { date: string|null; time: string|null; link: string|null; updatedAt: string|null; }):
  | { key: "empty" | "soon" | "today" | "upcoming" | "passed";
      label: string; badgeClass: string; dotClass: string; } {
  if (!scheduled.date && !scheduled.time && !scheduled.link) {
    return { key: "empty", label: "Belum Dijadwalkan",
      badgeClass: "border-slate-200 bg-slate-50 text-slate-600", dotClass: "bg-slate-400" };
  }
  if (!scheduled.date) {
    return { key: "empty", label: "Belum Ada Tanggal",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700", dotClass: "bg-amber-500" };
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rawDate = new Date(scheduled.date);
  if (!Number.isFinite(rawDate.getTime())) {
    return { key: "empty", label: "Format Tanggal Tidak Valid",
      badgeClass: "border-rose-200 bg-rose-50 text-rose-700", dotClass: "bg-rose-500" };
  }
  const sched = new Date(rawDate);
  sched.setHours(0, 0, 0, 0);
  const diffDays = Math.round((sched.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { key: "passed", label: "Sudah Dilaksanakan",
      badgeClass: "border-slate-200 bg-slate-50 text-slate-600", dotClass: "bg-slate-400" };
  }
  if (diffDays === 0) {
    return { key: "today", label: "Hari Ini",
      badgeClass: "border-rose-200 bg-rose-50 text-rose-700", dotClass: "bg-rose-500" };
  }
  if (diffDays <= 3) {
    return { key: "soon", label: `${diffDays} Hari Lagi`,
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700", dotClass: "bg-amber-500" };
  }
  return { key: "upcoming", label: `H-${diffDays}`,
    badgeClass: "border-sky-200 bg-sky-50 text-sky-700", dotClass: "bg-sky-500" };
}

type GenericDateBasedStatusKey = "empty" | "soon" | "today" | "upcoming" | "passed";

function getPraBimtekStatus(scheduled: { date: string|null; time: string|null; link: string|null; }):
  { key: GenericDateBasedStatusKey; label: string; badgeClass: string; dotClass: string } {
  return getInterviewStatus({ ...scheduled, updatedAt: null });
}

function formatBimtekStatus(status?: string | null): {
  key: BimtekStatusKey;
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch ((status ?? "").toUpperCase()) {
    case "COMPLETED":
      return { key: "COMPLETED", label: "Selesai", badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700", dotClass: "bg-emerald-500" };
    case "IN_PROGRESS":
      return { key: "IN_PROGRESS", label: "Sedang Berlangsung", badgeClass: "border-sky-200 bg-sky-50 text-sky-700", dotClass: "bg-sky-500" };
    case "SCHEDULED":
      return { key: "SCHEDULED", label: "Sudah Dijadwalkan", badgeClass: "border-primary/30 bg-primary/[0.06] text-primary", dotClass: "bg-primary" };
    case "CANCELLED":
      return { key: "CANCELLED", label: "Dibatalkan", badgeClass: "border-slate-200 bg-slate-100 text-slate-600", dotClass: "bg-slate-400" };
    default:
      return { key: "NOT_SCHEDULED", label: "Belum Dijadwalkan", badgeClass: "border-slate-200 bg-slate-50 text-slate-600", dotClass: "bg-slate-400" };
  }
}

type BimtekStatusKey = "NOT_SCHEDULED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export function DashboardHome({ roleSlug, session }: DashboardHomeProps) {
  const [payload, setPayload] = useState<DashboardPayload>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isSchoolDashboard = session.user.role === "SEKOLAH";
  const isFasilitatorAlat = session.user.role === "FASILITATOR_ALAT";

  const [schoolProfileNpsn, setSchoolProfileNpsn] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<WorkspaceAssignmentRecord[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const response = await dashboardRequest(session.token, roleSlug);
        if (active) {
          setPayload(response);
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Gagal memuat dashboard.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, [roleSlug, session.token]);

  useEffect(() => {
    if (!isSchoolDashboard) return;
    let active = true;
    void (async () => {
      try {
        const profile = await schoolProfileRequest(session.token);
        if (!active) return;
        const npsn = profile?.npsn ?? null;
        setSchoolProfileNpsn(npsn);
        if (npsn) {
          setAssignmentsLoading(true);
          try {
            const rows = await workspaceAssignmentsRequest(session.token, { schoolNpsn: npsn });
            if (active) setAssignments(rows ?? []);
          } finally {
            if (active) setAssignmentsLoading(false);
          }
        }
      } catch {
        if (active) setAssignments([]);
      }
    })();
    return () => { active = false; };
  }, [isSchoolDashboard, session.token]);

  const pickFirstScheduledAssignment = (
    selector: (a: WorkspaceAssignmentRecord) => { date: string|null; time: string|null; link: string|null; updatedAt: string|null },
    earliestDateOnly = true,
  ) => {
    let picked: WorkspaceAssignmentRecord | null = null;
    let pickedSchedule = selector(picked ?? ({} as WorkspaceAssignmentRecord));
    if (pickedSchedule === undefined) {
      pickedSchedule = { date: null, time: null, link: null, updatedAt: null };
    }
    for (const a of assignments) {
      if (!a) continue;
      const s = selector(a);
      if (!s || (!s.date && !s.time && !s.link)) continue;
      if (!picked) { picked = a; continue; }
      if (!earliestDateOnly) continue;
      const da = new Date(s.date ?? "").getTime();
      const dp = new Date(selector(picked).date ?? "").getTime();
      if (Number.isFinite(da) && (!Number.isFinite(dp) || da < dp)) picked = a;
    }
    const fallback = { date: null, time: null, link: null, updatedAt: null };
    const pickedSel = picked ? selector(picked) : null;
    const finalSchedule = {
      date: pickedSel?.date ?? fallback.date,
      time: pickedSel?.time ?? fallback.time,
      link: pickedSel?.link ?? fallback.link,
      updatedAt: pickedSel?.updatedAt ?? fallback.updatedAt,
      facilitatorAdministrationName: picked?.facilitatorAdministrationName ?? null,
      facilitatorEquipmentName: picked?.facilitatorEquipmentName ?? null,
    };
    return finalSchedule;
  };

  const interviewSchedule = pickFirstScheduledAssignment((a) => ({
    date: a.interviewScheduledDate ?? null,
    time: a.interviewScheduledTime ?? null,
    link: a.interviewMeetingLink ?? null,
    updatedAt: a.updatedAt ?? null,
  }));

  const praBimtekSchedule = pickFirstScheduledAssignment((a) => ({
    date: a.praBimtekScheduledDate ?? null,
    time: a.praBimtekScheduledTime ?? null,
    link: a.praBimtekMeetingLink ?? null,
    updatedAt: a.updatedAt ?? null,
  }));

  const bimtekSchedule = (() => {
    let picked: WorkspaceAssignmentRecord | null = null;
    for (const a of assignments) {
      if (!a) continue;
      const hasAny = a.bimtekScheduledDate || a.bimtekLocation || a.bimtekStatus;
      if (!hasAny) continue;
      if (!picked) { picked = a; break; }
    }
    return {
      date: picked?.bimtekScheduledDate ?? null,
      location: picked?.bimtekLocation ?? null,
      status: picked?.bimtekStatus ?? null,
      updatedAt: picked?.updatedAt ?? null,
      facilitatorEquipmentName: picked?.facilitatorEquipmentName ?? null,
    };
  })();

  const interviewStatus = useMemo(() => getInterviewStatus(interviewSchedule), [interviewSchedule]);
  const praBimtekStatus = useMemo(() => getPraBimtekStatus(praBimtekSchedule), [praBimtekSchedule]);
  const bimtekStatus = useMemo(() => formatBimtekStatus(bimtekSchedule.status), [bimtekSchedule]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {isSchoolDashboard ? (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 via-white to-amber-50/50">
          <CardContent className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-amber-300 bg-white text-amber-800">
                <BellRing className="mr-1.5 h-3.5 w-3.5" />
                Informasi Penting
              </Badge>
              <h1 className="display-font ml-auto mt-3 max-w-3xl text-xl font-semibold tracking-tight text-slate-950 sm:mt-0 sm:text-2xl">
                Selamat Datang, {session.user.fullName?.trim() || session.user.organization}
              </h1>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
                      <Video className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Wawancara
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        Jadwal Wawancara Verifikasi Administrasi
                      </p>
                    </div>
                  </div>
                  <Badge className={`border text-[11px] font-bold tracking-wide ${interviewStatus.badgeClass}`}>
                    <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${interviewStatus.dotClass}`} />
                    {assignmentsLoading ? "Memuat..." : interviewStatus.label}
                  </Badge>
                </div>

                {interviewStatus.key === "empty" ? (
                  <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">
                        Jadwal wawancara belum diatur oleh Fasilitator Administrasi
                      </p>
                      <p className="mt-1 text-xs leading-6 text-slate-500">
                        Silahkan lengkapi Dokumen Administrasi. Setelah diverifikasi, Fasilitator Administrasi akan
                        mengirim jadwal wawancara paling lambat 3 hari kerja.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-rose-600" />
                        Jadwal
                      </div>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-900">
                        {formatInterviewDate(interviewSchedule.date) ?? "—"}
                        {interviewSchedule.time ? ` • ${formatInterviewTime(interviewSchedule.time)}` : ""}
                      </p>
                      {interviewSchedule.updatedAt ? (
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">
                          Diperbarui {new Date(interviewSchedule.updatedAt).toLocaleDateString("id-ID", {day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <ExternalLink className="h-3.5 w-3.5 text-primary" />
                        Link Pertemuan
                      </div>
                      {interviewSchedule.link?.trim() ? (
                        <div className="mt-2 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 sm:text-sm">
                            {interviewSchedule.link.trim()}
                          </p>
                          <Button
                            asChild
                            size="sm"
                            className="bg-rose-600 hover:bg-rose-700 text-white shadow-sm shadow-rose-500/20"
                          >
                            <a href={interviewSchedule.link.trim()} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 h-4 w-4" />
                              Buka Meeting
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs leading-6 text-slate-500">
                          Link akan dikirimkan 1 hari sebelum wawancara.
                        </p>
                      )}
                      {interviewSchedule.facilitatorAdministrationName ? (
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">
                          Fasilitator: {interviewSchedule.facilitatorAdministrationName}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-rose-200/60 bg-rose-50/50 px-4 py-3 flex items-start sm:items-center">
                      <div className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                        <Info className="h-4 w-4 text-rose-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-rose-900">Status Wawancara</p>
                        <p className="mt-1 text-[11.5px] leading-5 text-rose-800/80">
                          Pastikan perangkat dan koneksi siap 15 menit sebelum jadwal wawancara dimulai.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                      <BookOpen className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Pra Bimtek
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        Persiapan Sebelum Bimbingan Teknis
                      </p>
                    </div>
                  </div>
                  <Badge className={`border text-[11px] font-bold tracking-wide ${praBimtekStatus.badgeClass}`}>
                    <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${praBimtekStatus.dotClass}`} />
                    {assignmentsLoading ? "Memuat..." : praBimtekStatus.label}
                  </Badge>
                </div>

                {praBimtekStatus.key === "empty" ? (
                  <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">
                        Jadwal Pra Bimtek belum diatur oleh Fasilitator
                      </p>
                      <p className="mt-1 text-xs leading-6 text-slate-500">
                        Informasi Pra Bimtek (jadwal briefing dan link meeting) akan diumumkan setelah sekolah dinyatakan
                        lolos tahapan wawancara verifikasi.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-sky-600" />
                        Jadwal
                      </div>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-900">
                        {formatInterviewDate(praBimtekSchedule.date) ?? "—"}
                        {praBimtekSchedule.time ? ` • ${formatInterviewTime(praBimtekSchedule.time)}` : ""}
                      </p>
                      {praBimtekSchedule.updatedAt ? (
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">
                          Diperbarui {new Date(praBimtekSchedule.updatedAt).toLocaleDateString("id-ID", {day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <ExternalLink className="h-3.5 w-3.5 text-primary" />
                        Link Meeting
                      </div>
                      {praBimtekSchedule.link?.trim() ? (
                        <div className="mt-2 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700 sm:text-sm">
                            {praBimtekSchedule.link.trim()}
                          </p>
                          <Button
                            asChild
                            size="sm"
                            className="bg-sky-600 hover:bg-sky-700 text-white shadow-sm shadow-sky-500/20"
                          >
                            <a href={praBimtekSchedule.link.trim()} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-1 h-4 w-4" />
                              Buka Meeting
                            </a>
                          </Button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs leading-6 text-slate-500">
                          Link Pra Bimtek akan dikirimkan H-1 sebelum kegiatan.
                        </p>
                      )}
                    </div>

                    <div className="rounded-xl border border-sky-200/60 bg-sky-50/60 px-4 py-3 flex items-start sm:items-center">
                      <div className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                        <Info className="h-4 w-4 text-sky-700" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-sky-900">Status Pra Bimtek</p>
                        <p className="mt-1 text-[11.5px] leading-5 text-sky-800/80">
                          Pastikan seluruh persyaratan administrasi Pra Bimtek sudah disiapkan sesuai arahan Fasilitator.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <HardHat className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Bimtek
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        Bimbingan Teknis Pelaksanaan
                      </p>
                    </div>
                  </div>
                  <Badge className={`border text-[11px] font-bold tracking-wide ${bimtekStatus.badgeClass}`}>
                    <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${bimtekStatus.dotClass}`} />
                    {assignmentsLoading ? "Memuat..." : bimtekStatus.label}
                  </Badge>
                </div>

                {bimtekStatus.key === "NOT_SCHEDULED" && !bimtekSchedule.date && !bimtekSchedule.location ? (
                  <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4 sm:flex-row sm:items-center">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">
                        Jadwal Bimtek belum ditentukan
                      </p>
                      <p className="mt-1 text-xs leading-6 text-slate-500">
                        Informasi jadwal dan lokasi Bimbingan Teknis akan diumumkan setelah tahapan Pra Bimtek selesai
                        dan sekolah dinyatakan sebagai penerima bantuan.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
                    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-emerald-700" />
                        Jadwal
                      </div>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-900">
                        {formatInterviewDate(bimtekSchedule.date) ?? "—"}
                      </p>
                      {bimtekSchedule.updatedAt ? (
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">
                          Diperbarui {new Date(bimtekSchedule.updatedAt).toLocaleDateString("id-ID", {day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        <MapPin className="h-3.5 w-3.5 text-emerald-700" />
                        Lokasi
                      </div>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-900 whitespace-pre-wrap">
                        {bimtekSchedule.location?.trim() ?? "—"}
                      </p>
                      {bimtekSchedule.facilitatorEquipmentName ? (
                        <p className="mt-1 text-[11px] leading-5 text-slate-500">
                          Fasilitator Alat: {bimtekSchedule.facilitatorEquipmentName}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-4 py-3 flex items-start sm:items-center">
                      <div className="mr-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                        <Info className="h-4 w-4 text-emerald-700" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-emerald-900">Status Bimtek</p>
                        <p className="mt-1 text-[11.5px] leading-5 text-emerald-800/80">
                          Silahkan datang 30 menit lebih awal untuk registrasi dan persiapan ruangan Bimtek.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </CardContent>
        </Card>
      ) : isFasilitatorAlat ? (
        <div className="space-y-1">
          <Badge variant="outline">
            {roleLabels[session.user.role]}
          </Badge>
          <h1 className="display-font mt-2 max-w-3xl text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">
            {loading ? "Menyiapkan dashboard..." : payload.headline}
          </h1>
        </div>
      ) : (
        <Card>
          <CardContent className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px lg:gap-6">
            <div>
              <Badge variant="outline" className="mb-3 sm:mb-4">
                {roleLabels[session.user.role]}
              </Badge>
              <h1 className="display-font max-w-3xl text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                {loading ? "Menyiapkan dashboard..." : payload.headline}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                {roleSummaries[session.user.role]}{" "}
                {loading ? "Sedang mengambil data ringkas terbaru." : payload.summary}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
                <Building2 className="h-4 w-4" />
                Akses aktif
              </div>
              <p className="display-font mt-3 text-lg font-semibold text-slate-900 sm:text-xl">
                {session.user.organization}
              </p>
              <p className="mt-2 text-sm text-slate-500">{session.user.region}</p>
              <p className="mt-4 hidden text-sm leading-6 text-slate-600 sm:block">
                Workspace disederhanakan agar fokus ke data inti, progres bantuan, dan tindak lanjut peran.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-3 px-6 py-5 text-sm text-slate-600">
          <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          Memuat statistik dan fokus kerja terbaru...
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="flex items-center gap-3 px-6 py-5 text-sm text-danger">
          <AlertCircle className="h-5 w-5" />
          {error}
          </CardContent>
        </Card>
      ) : (
        <>
          {!isSchoolDashboard && !isFasilitatorAlat && payload.schoolProfile ? (
            <SchoolProfileCard profile={payload.schoolProfile} />
          ) : null}

          {!isSchoolDashboard ? (
            <>
              <section className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {payload.metrics.map((metric) => (
                  <MetricCard key={metric.label} metric={metric} />
                ))}
              </section>

              <section className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {payload.focus.map((panel) => (
                  <SectionCard key={panel.title} panel={panel} />
                ))}
              </section>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
