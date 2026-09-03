"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock4,
  Loader2,
  PencilLine,
  RefreshCw,
  Search,
  Video,
  X,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  updateAssignmentInterviewScheduleRequest,
  upsertWorkspaceAssignmentsRequest,
  workspaceAssignmentsRequest,
  type WorkspaceAssignmentRecord,
} from "@/lib/api";
import { fetchCachedVerifikasiReviews } from "@/lib/school-verifikasi-cache";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

type ReviewItemStatus = "approved" | "pending" | "rejected" | null;

function reviewStatusVariant(status: ReviewItemStatus) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "rejected") return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "pending") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function reviewStatusLabel(status: ReviewItemStatus) {
  if (status === "approved") return "Disetujui";
  if (status === "rejected") return "Ditolak";
  if (status === "pending") return "Pending";
  return "Belum di Proses";
}

function normalizeUserName(value: string) {
  return value.trim().toLowerCase().replace(/\s+prisma$/i, "");
}

function formatDateId(value: string | null) {
  if (!value) return null;
  try {
    const d = new Date(`${value}T00:00:00`);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function formatTimeId(value: string | null) {
  if (!value) return null;
  const cleaned = value.trim();
  if (!/^\d{1,2}:\d{2}/.test(cleaned)) return value;
  const [hh, mm] = cleaned.split(":");
  return `${String(hh).padStart(2, "0")}.${String(mm).padStart(2, "0")} WIB`;
}

export function FacilitatorAdministrasiWawancaraPage() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [schools, setSchools] = useState<WorkspaceAssignmentRecord[]>([]);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const [verifikasiReviews, setVerifikasiReviews] = useState<Record<string, { approvedAdmin: boolean | null }>>({});

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [formDate, setFormDate] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formLink, setFormLink] = useState("");

  const facilitatorId = session?.user.id ?? "";
  const facilitatorName = session?.user.fullName ?? "";

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    window.setTimeout(() => setToast(null), 4000);
  }

  async function loadAll(showRefreshState = false) {
    if (!hydrated || !session?.token) {
      setLoading(false);
      return;
    }
    if (showRefreshState) setRefreshing(true);
    setLoading(true);
    setLoadError("");

    const token = session.token;
    const normalizedName = normalizeUserName(facilitatorName);

    try {
      const records = await workspaceAssignmentsRequest(token, {
        moduleKey: "wawancara",
        facilitatorAdministrationId: facilitatorId || undefined,
      });

      const matched = records.filter((record) => {
        if (record.moduleKey !== "wawancara") return false;
        if (facilitatorId && record.facilitatorAdministrationId === facilitatorId) return true;
        if (normalizedName && normalizeUserName(record.facilitatorAdministrationName) === normalizedName) return true;
        return false;
      });

      if (matched.length === 0) {
        const seededRecord: WorkspaceAssignmentRecord = {
          key: `seed-wawancara-admin-${session.user.id}-${Date.now()}`,
          moduleKey: "wawancara",
          moduleLabel: "Wawancara",
          sourceTab: "abt",
          sourceLabel: "data sekolah penerima bantuan ABT",
          schoolNo: 1,
          schoolNpsn: "10110273",
          schoolName: "SMK NEGERI 1 ARONGAN LAMBALEK",
          facilitatorAdministrationId: session.user.id,
          facilitatorAdministrationName: session.user.fullName,
          facilitatorEquipmentId: "",
          facilitatorEquipmentName: "Fasilitator Alat Pendamping",
          interviewScheduledDate: null,
          interviewScheduledTime: null,
          interviewMeetingLink: null,
          updatedAt: new Date().toISOString(),
        };

        try {
          await upsertWorkspaceAssignmentsRequest(token, [seededRecord]);
        } catch {
          // ignore save error, fallback to local in-memory seed
        }
        setSchools([seededRecord]);
      } else {
        setSchools(matched);
      }

      try {
        const reviewsRaw = await fetchCachedVerifikasiReviews(token, {}, { force: showRefreshState });
        const outReviews: Record<string, { approvedAdmin: boolean | null }> = {};
        for (const r of reviewsRaw) {
          if (r?.schoolNpsn) outReviews[String(r.schoolNpsn).trim()] = { approvedAdmin: r.approvedAdmin ?? null };
        }
        setVerifikasiReviews(outReviews);
      } catch {
        setVerifikasiReviews({});
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Gagal memuat daftar sekolah wawancara.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, session?.token, facilitatorId, facilitatorName]);

  const normalizedSearch = search.trim().toLowerCase();
  const filteredSchools = useMemo(() => {
    const base = [...schools].sort((left, right) => left.schoolNo - right.schoolNo);
    if (!normalizedSearch) return base;
    return base.filter(
      (row) =>
        row.schoolName.toLowerCase().includes(normalizedSearch) || row.schoolNpsn.includes(normalizedSearch),
    );
  }, [schools, normalizedSearch]);

  const stats = useMemo(() => {
    let scheduled = 0;
    let notScheduled = 0;
    for (const row of schools) {
      if (row.interviewScheduledDate && row.interviewScheduledTime) scheduled += 1;
      else notScheduled += 1;
    }
    return { total: schools.length, scheduled, notScheduled };
  }, [schools]);

  const editingRecord = useMemo(() => {
    if (!editingKey) return null;
    return schools.find((row) => row.key === editingKey) ?? null;
  }, [editingKey, schools]);

  useEffect(() => {
    if (!editingRecord) return;
    setFormDate(editingRecord.interviewScheduledDate ?? "");
    setFormTime(editingRecord.interviewScheduledTime ?? "");
    setFormLink(editingRecord.interviewMeetingLink ?? "");
  }, [editingRecord]);

  function closeModal() {
    if (saving) return;
    setEditingKey(null);
    setFormDate("");
    setFormTime("");
    setFormLink("");
  }

  async function submitSchedule() {
    if (!editingRecord || !session?.token) return;
    const payloadDate = formDate.trim() || null;
    const payloadTime = formTime.trim() || null;
    const payloadLink = formLink.trim() || null;

    if ((payloadDate && !payloadTime) || (!payloadDate && payloadTime)) {
      showToast("error", "Tanggal dan Jam wawancara harus diisi keduanya atau dikosongkan keduanya.");
      return;
    }

    setSaving(true);
    try {
      await updateAssignmentInterviewScheduleRequest(session.token, {
        moduleKey: editingRecord.moduleKey,
        sourceTab: editingRecord.sourceTab,
        schoolNpsn: editingRecord.schoolNpsn,
        interviewScheduledDate: payloadDate,
        interviewScheduledTime: payloadTime,
        interviewMeetingLink: payloadLink,
        updatedAt: new Date().toISOString(),
      });
      setSchools((prev) =>
        prev.map((row) =>
          row.key === editingRecord.key
            ? {
                ...row,
                interviewScheduledDate: payloadDate,
                interviewScheduledTime: payloadTime,
                interviewMeetingLink: payloadLink,
                updatedAt: new Date().toISOString(),
              }
            : row,
        ),
      );
      showToast(
        "success",
        payloadDate
          ? `Jadwal wawancara ${editingRecord.schoolName} berhasil disimpan.`
          : `Jadwal wawancara ${editingRecord.schoolName} telah dikosongkan.`,
      );
      closeModal();
    } catch (error) {
      showToast("error", error instanceof Error ? error.message : "Gagal menyimpan jadwal wawancara.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className="border border-primary/20 bg-primary/[0.08] text-primary"
              variant="outline"
            >
              <Building2 className="mr-2 h-3.5 w-3.5" />
              {facilitatorName || "Fasilitator Administrasi"}
            </Badge>
            <span className="text-xs text-slate-500">
              {session?.user.organization ?? "• Organisasi belum diatur"}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Wawancara</h1>
            <p className="mt-1 text-sm text-slate-600">
              Atur jadwal tanggal &amp; jam wawancara beserta link meeting untuk masing-masing sekolah dampingan.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadAll(true)}
          disabled={refreshing || loading || saving}
          className="gap-2"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Refresh
        </Button>
      </section>

      <section className="flex flex-wrap gap-3">
        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          <span className="text-slate-500">Total Sekolah</span>
          <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-700">
            {stats.total}
          </Badge>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          <CalendarClock className="h-4 w-4" />
          Terjadwal <span className="font-semibold">{stats.scheduled}</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Clock4 className="h-4 w-4" />
          Belum Terjadwal <span className="font-semibold">{stats.notScheduled}</span>
        </div>
      </section>

      <section className="panel rounded-[28px] p-6">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari nama sekolah / NPSN..."
              className="h-11 pl-9"
            />
          </div>
          <p className="text-xs text-slate-500">
            Menampilkan <span className="font-semibold text-slate-800">{filteredSchools.length}</span> dari{" "}
            <span className="font-semibold text-slate-800">{schools.length}</span> sekolah
          </p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            Memuat daftar sekolah...
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {loadError}
          </div>
        ) : filteredSchools.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-14 text-center text-sm text-slate-500">
            Tidak ada sekolah yang terdaftar dalam daftar wawancara anda saat ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[920px] w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-3 w-16">No</th>
                  <th className="px-4 py-3 w-36">NPSN</th>
                  <th className="px-4 py-3">Sekolah</th>
                  <th className="px-4 py-3 w-44">Verifikasi</th>
                  <th className="px-4 py-3 w-44">Wawancara</th>
                </tr>
              </thead>
              <tbody>
                {filteredSchools.map((row, idx) => {
                  const dateLabel = formatDateId(row.interviewScheduledDate);
                  const timeLabel = formatTimeId(row.interviewScheduledTime);
                  const isScheduled = Boolean(dateLabel && timeLabel);
                  const npsnKey = String(row.schoolNpsn).trim();
                  const review = verifikasiReviews[npsnKey];
                  const approved = review?.approvedAdmin ?? null;
                  let vBadge: ReviewItemStatus = "pending";
                  if (approved === true) vBadge = "approved";
                  else if (approved === false) vBadge = "rejected";

                  return (
                    <tr
                      key={row.key}
                      onClick={() => setEditingKey(row.key)}
                      className={cn(
                        "cursor-pointer transition border-b border-slate-100 last:border-b-0",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/40",
                        "hover:bg-primary/5",
                      )}
                    >
                      <td className="px-4 py-4 text-slate-500 font-medium">{idx + 1}</td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-xs font-bold text-slate-950">{row.schoolNpsn}</span>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">{row.schoolName}</td>
                      <td className="px-4 py-4">
                        <Badge
                          className={cn("border", reviewStatusVariant(vBadge))}
                          variant="outline"
                        >
                          {vBadge === "approved" && <CheckCircle2 className="mr-1.5 h-3 w-3" />}
                          {vBadge === "rejected" && <XCircle className="mr-1.5 h-3 w-3" />}
                          {vBadge === "pending" && <Clock4 className="mr-1.5 h-3 w-3" />}
                          {reviewStatusLabel(vBadge)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        {isScheduled ? (
                          <Badge
                            className="w-fit border border-indigo-200 bg-indigo-50 text-indigo-700"
                            variant="outline"
                          >
                            <CalendarDays className="mr-1.5 h-3 w-3" />
                            {dateLabel} · {timeLabel}
                          </Badge>
                        ) : (
                          <Badge
                            className="w-fit border border-dashed border-slate-300 bg-white text-slate-500"
                            variant="outline"
                          >
                            Belum dijadwalkan
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingRecord ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
                  Form Jadwal Wawancara
                </p>
                <h2 className="text-lg font-semibold text-slate-950">{editingRecord.schoolName}</h2>
                <p className="text-xs text-slate-500">
                  NPSN <span className="font-mono font-semibold text-slate-700">{editingRecord.schoolNpsn}</span>
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={closeModal}
                disabled={saving}
                className="h-9 w-9 rounded-[14px] text-slate-500 hover:text-slate-900"
              >
                <X className="h-4.5 w-4.5" />
              </Button>
            </div>

            <div className="mt-6 space-y-5 rounded-[22px] border border-dashed border-slate-300 bg-slate-50/50 p-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <CalendarDays className="mr-1.5 inline h-3.5 w-3.5 -translate-y-0.5" />
                  Tanggal Wawancara
                </label>
                <Input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <Clock4 className="mr-1.5 inline h-3.5 w-3.5 -translate-y-0.5" />
                  Jam Wawancara
                </label>
                <Input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="h-11"
                />
                <p className="text-[11px] leading-4 text-slate-500">
                  Gunakan format 24-jam (misal 09:30 untuk pukul 09.30 WIB).
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <Video className="mr-1.5 inline h-3.5 w-3.5 -translate-y-0.5" />
                  Link Meeting (Zoom / Google Meet)
                </label>
                <Input
                  type="url"
                  value={formLink}
                  onChange={(e) => setFormLink(e.target.value)}
                  placeholder="https://zoom.us/j/... atau https://meet.google.com/..."
                  className="h-11"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-[11px] leading-4 text-slate-500">
                Kosongkan tanggal &amp; jam jika ingin membatalkan penjadwalan.
              </p>
              <div className="inline-flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeModal}
                  disabled={saving}
                  className="gap-1.5"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={() => void submitSchedule()}
                  disabled={saving}
                  className="gap-1.5 bg-primary text-white hover:bg-primary/90"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Simpan Jadwal
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={cn(
            "fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-2xl border px-4 py-3 shadow-xl",
            toast.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800",
          )}
        >
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      ) : null}
    </div>
  );
}
