"use client";

import { ClipboardCheck, GraduationCap, UserRound, CalendarCheck, Building2, Wrench, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  schoolProfileRequest,
  workspaceAssignmentsRequest,
  workspaceVerifikasiOnlineReviewsRequest,
  type SchoolProfileRecord,
  type WorkspaceAssignmentRecord,
  type WorkspaceVerifikasiOnlineRecord,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type FacilitatorRow = {
  role: string;
  number: string;
  name: string;
  contact: string;
  assignments: Array<{ label: string; detail?: string; tone: "primary" | "success" | "warning" }>;
};

export function SchoolHelpPage() {
  const { hydrate, hydrated, session } = useAuthStore();
  const token = session?.token ?? "";
  const [profile, setProfile] = useState<SchoolProfileRecord | null>(null);
  const [verifikasiReview, setVerifikasiReview] = useState<WorkspaceVerifikasiOnlineRecord | null>(null);
  const [assignments, setAssignments] = useState<WorkspaceAssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketIssue, setTicketIssue] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hydrated) {
        return;
      }
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const results = await Promise.allSettled([
          schoolProfileRequest(token),
          workspaceVerifikasiOnlineReviewsRequest(token),
          workspaceAssignmentsRequest(token),
        ]);
        if (cancelled) {
          return;
        }
        const [profileRes, verifRes, assignmentRes] = results;
        if (profileRes.status === "fulfilled") {
          setProfile(profileRes.value);
          if (profileRes.value.npsn && verifRes.status === "fulfilled") {
            const matched =
              verifRes.value.find((item) => item.schoolNpsn === profileRes.value.npsn) ?? null;
            setVerifikasiReview(matched);
          }
          if (assignmentRes.status === "fulfilled" && profileRes.value.npsn) {
            const filtered = assignmentRes.value.filter(
              (item) => String(item.schoolNpsn ?? "").trim() === String(profileRes.value.npsn ?? "").trim(),
            );
            setAssignments(filtered);
          }
        } else {
          setError("Gagal memuat profil sekolah.");
        }
      } catch (err) {
        if (!cancelled) {
          setError("Terjadi kesalahan saat memuat data fasilitator.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, token]);

  async function handleRefresh() {
    if (!token || refreshing) {
      return;
    }
    setRefreshing(true);
    setError("");
    try {
      const results = await Promise.allSettled([
        schoolProfileRequest(token),
        workspaceVerifikasiOnlineReviewsRequest(token),
        workspaceAssignmentsRequest(token),
      ]);
      const [profileRes, verifRes, assignmentRes] = results;
      if (profileRes.status === "fulfilled") {
        setProfile(profileRes.value);
        if (profileRes.value.npsn && verifRes.status === "fulfilled") {
          const matched =
            verifRes.value.find((item) => item.schoolNpsn === profileRes.value.npsn) ?? null;
          setVerifikasiReview(matched);
        }
        if (assignmentRes.status === "fulfilled" && profileRes.value.npsn) {
          const filtered = assignmentRes.value.filter(
            (item) => String(item.schoolNpsn ?? "").trim() === String(profileRes.value.npsn ?? "").trim(),
          );
          setAssignments(filtered);
        }
      }
    } catch (err) {
      setError("Gagal memperbarui data. Coba sesaat lagi.");
    } finally {
      setRefreshing(false);
    }
  }

  const facilitatorRows: FacilitatorRow[] = useMemo(() => {
    const last6 = (id: string | null | undefined): string => {
      if (!id) return "-";
      const str = String(id);
      return str.length >= 6 ? str.slice(-6) : str;
    };
    const buildContact = (phone: string | null | undefined, email: string | null | undefined): string => {
      const parts: string[] = [];
      if (phone && String(phone).trim()) parts.push(String(phone).trim());
      if (email && String(email).trim()) parts.push(String(email).trim());
      return parts.length > 0 ? parts.join(" · ") : "-";
    };

    const moduleToneMap: Record<WorkspaceAssignmentRecord["moduleKey"], "primary" | "success" | "warning"> = {
      "verifikasi-online": "primary",
      wawancara: "warning",
      "bimbingan-teknis": "success",
      "pra-bimtek": "success",
    };

    const moduleLabelMap: Record<WorkspaceAssignmentRecord["moduleKey"], string> = {
      "verifikasi-online": "Verifikasi Online",
      wawancara: "Wawancara",
      "bimbingan-teknis": "Bimbingan Teknis",
      "pra-bimtek": "Pra Bimtek",
    };

    const formatSchedule = (date: string | null, time: string | null): string | undefined => {
      const parts: string[] = [];
      if (date) parts.push(date);
      if (time) parts.push(time);
      return parts.length > 0 ? parts.join(" · ") : undefined;
    };

    const buildAssignments = (
      facilitatorKey: "admin" | "equipment",
      facilitatorName: string | null | undefined,
      facilitatorId: string | null | undefined,
    ): FacilitatorRow["assignments"] => {
      const matchedByEither = assignments.filter((item) => {
        const name =
          facilitatorKey === "admin"
            ? String(item.facilitatorAdministrationName ?? "").trim()
            : String(item.facilitatorEquipmentName ?? "").trim();
        const id =
          facilitatorKey === "admin"
            ? String(item.facilitatorAdministrationId ?? "").trim()
            : String(item.facilitatorEquipmentId ?? "").trim();
        const targetName = String(facilitatorName ?? "").trim();
        const targetId = String(facilitatorId ?? "").trim();
        if (targetName && name === targetName) return true;
        if (targetId && id === targetId) return true;
        return false;
      });

      const seen = new Set<string>();
      const list: FacilitatorRow["assignments"] = [];
      for (const rec of matchedByEither) {
        const key = `${rec.moduleKey}__${rec.interviewScheduledDate ?? ""}__${rec.interviewScheduledTime ?? ""}`;
        if (seen.has(key)) continue;
        seen.add(key);
        list.push({
          label: moduleLabelMap[rec.moduleKey] ?? rec.moduleLabel ?? "Penugasan",
          detail:
            rec.moduleKey === "wawancara"
              ? formatSchedule(rec.interviewScheduledDate, rec.interviewScheduledTime) ??
                (rec.interviewMeetingLink ? `Link: ${rec.interviewMeetingLink}` : undefined)
              : rec.moduleLabel && rec.moduleLabel.trim() !== moduleLabelMap[rec.moduleKey]
                ? rec.moduleLabel
                : undefined,
          tone: moduleToneMap[rec.moduleKey] ?? "primary",
        });
      }

      if (list.length === 0) {
        return [
          {
            label: "Belum ada penugasan",
            tone: "warning",
          },
        ];
      }

      return list;
    };

    if (!verifikasiReview) {
      const adminNameFromAssignments = assignments.find(
        (item) => String(item.facilitatorAdministrationName ?? "").trim(),
      )?.facilitatorAdministrationName;
      const equipmentNameFromAssignments = assignments.find(
        (item) => String(item.facilitatorEquipmentName ?? "").trim(),
      )?.facilitatorEquipmentName;

      return [
        {
          role: "Fasilitator Administrasi",
          number: "-",
          name: adminNameFromAssignments?.trim() || "Belum ada penugasan",
          contact: "-",
          assignments: buildAssignments("admin", adminNameFromAssignments, null),
        },
        {
          role: "Fasilitator Alat",
          number: "-",
          name: equipmentNameFromAssignments?.trim() || "Belum ada penugasan",
          contact: "-",
          assignments: buildAssignments("equipment", equipmentNameFromAssignments, null),
        },
      ];
    }

    return [
      {
        role: "Fasilitator Administrasi",
        number: last6(verifikasiReview.reviewedAdminId),
        name: verifikasiReview.reviewedAdminName?.trim() || "Belum ada penugasan",
        contact: buildContact(verifikasiReview.reviewedAdminPhone, verifikasiReview.reviewedAdminEmail),
        assignments: buildAssignments(
          "admin",
          verifikasiReview.reviewedAdminName,
          verifikasiReview.reviewedAdminId,
        ),
      },
      {
        role: "Fasilitator Alat",
        number: last6(verifikasiReview.reviewedEquipmentId),
        name: verifikasiReview.reviewedEquipmentName?.trim() || "Belum ada penugasan",
        contact: buildContact(
          verifikasiReview.reviewedEquipmentPhone,
          verifikasiReview.reviewedEquipmentEmail,
        ),
        assignments: buildAssignments(
          "equipment",
          verifikasiReview.reviewedEquipmentName,
          verifikasiReview.reviewedEquipmentId,
        ),
      },
    ];
  }, [verifikasiReview, assignments]);

  const tahapanFacilitators = useMemo(() => {
    const last6 = (id: string | null | undefined): string => {
      if (!id) return "-";
      const str = String(id);
      return str.length >= 6 ? str.slice(-6) : str;
    };
    const findByModule = (moduleKey: WorkspaceAssignmentRecord["moduleKey"]) =>
      assignments.find((item) => item.moduleKey === moduleKey) ?? null;

    const verifikasiAssignment = findByModule("verifikasi-online");
    const wawancaraAssignment = findByModule("wawancara");
    const praBimtekAssignment = findByModule("pra-bimtek");
    const bimtekAssignment = findByModule("bimbingan-teknis");

    const buildRow = (assignment: WorkspaceAssignmentRecord | null, fallbackReview: WorkspaceVerifikasiOnlineRecord | null) => {
      let admName = assignment?.facilitatorAdministrationName?.trim() ?? "";
      let admId = assignment?.facilitatorAdministrationId ?? null;
      let admBalai = assignment?.facilitatorAdministrationBalai?.trim() ?? "";
      let eqName = assignment?.facilitatorEquipmentName?.trim() ?? "";
      let eqId = assignment?.facilitatorEquipmentId ?? null;
      let eqBalai = assignment?.facilitatorEquipmentBalai?.trim() ?? "";
      if (!admName && fallbackReview?.reviewedAdminName?.trim()) admName = fallbackReview.reviewedAdminName.trim();
      if (!admId && fallbackReview?.reviewedAdminId) admId = fallbackReview.reviewedAdminId;
      if (!admBalai && fallbackReview?.reviewedAdminBalai?.trim()) admBalai = fallbackReview.reviewedAdminBalai.trim();
      if (!eqName && fallbackReview?.reviewedEquipmentName?.trim()) eqName = fallbackReview.reviewedEquipmentName.trim();
      if (!eqId && fallbackReview?.reviewedEquipmentId) eqId = fallbackReview.reviewedEquipmentId;
      if (!eqBalai && fallbackReview?.reviewedEquipmentBalai?.trim()) eqBalai = fallbackReview.reviewedEquipmentBalai.trim();
      return {
        admin: {
          name: admName || "Belum ada penugasan",
          number: last6(admId),
          balai: admBalai || "-",
        },
        equipment: {
          name: eqName || "Belum ada penugasan",
          number: last6(eqId),
          balai: eqBalai || "-",
        },
      };
    };

    return {
      verifikasi: buildRow(verifikasiAssignment, verifikasiReview),
      wawancara: buildRow(wawancaraAssignment, verifikasiReview),
      praBimtek: buildRow(praBimtekAssignment, verifikasiReview),
      bimtek: buildRow(bimtekAssignment, verifikasiReview),
    };
  }, [assignments, verifikasiReview]);

  function TahapanSection({
    title,
    subtitle,
    icon,
    tone,
    data,
  }: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    tone: "primary" | "sky" | "emerald" | "violet";
    data: {
      admin: { name: string; number: string; balai: string };
      equipment: { name: string; number: string; balai: string };
    };
  }) {
    const toneBorder =
      tone === "primary"
        ? "border-primary/20"
        : tone === "sky"
          ? "border-sky-200"
          : tone === "emerald"
            ? "border-emerald-200"
            : "border-violet-200";
    const toneBg =
      tone === "primary"
        ? "bg-primary/[0.06]"
        : tone === "sky"
          ? "bg-sky-50"
          : tone === "emerald"
            ? "bg-emerald-50"
            : "bg-violet-50";
    const toneBadge =
      tone === "primary"
        ? "bg-white border-primary/30 text-primary"
        : tone === "sky"
          ? "bg-white border-sky-200 text-sky-700"
          : tone === "emerald"
            ? "bg-white border-emerald-200 text-emerald-700"
            : "bg-white border-violet-200 text-violet-700";

    return (
      <Card className={`rounded-[24px] border-dashed ${toneBorder} ${toneBg}`}>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {icon}
              <CardTitle className="text-lg text-slate-950">{title}</CardTitle>
            </div>
            <Badge variant="outline" className={`text-[10.5px] font-semibold uppercase tracking-[0.14em] ${toneBadge}`}>
              {subtitle}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-sky-200 bg-white p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
              <Building2 className="h-3.5 w-3.5" />
              <span>Fasilitator Administrasi</span>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-semibold text-slate-950">
                {data.admin.name === "Belum ada penugasan" ? (
                  <span className="font-normal italic text-slate-400">{data.admin.name}</span>
                ) : (
                  data.admin.name
                )}
              </p>
              <span className="font-mono text-xs text-slate-500">No: {data.admin.number}</span>
            </div>
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[11.5px] text-slate-600">
              <Building2 className="mt-0.5 h-3.5 w-3.5 flex-none text-sky-600" />
              <span className="flex-1">
                <span className="font-semibold text-slate-700">Balai:</span>{" "}
                {data.admin.balai === "-" ? (
                  <span className="italic text-slate-400">{data.admin.balai}</span>
                ) : (
                  <span className="text-slate-800">{data.admin.balai}</span>
                )}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-white p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-700">
              <Wrench className="h-3.5 w-3.5" />
              <span>Fasilitator Alat</span>
            </div>
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
              <p className="font-semibold text-slate-950">
                {data.equipment.name === "Belum ada penugasan" ? (
                  <span className="font-normal italic text-slate-400">{data.equipment.name}</span>
                ) : (
                  data.equipment.name
                )}
              </p>
              <span className="font-mono text-xs text-slate-500">No: {data.equipment.number}</span>
            </div>
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[11.5px] text-slate-600">
              <Wrench className="mt-0.5 h-3.5 w-3.5 flex-none text-violet-600" />
              <span className="flex-1">
                <span className="font-semibold text-slate-700">Balai:</span>{" "}
                {data.equipment.balai === "-" ? (
                  <span className="italic text-slate-400">{data.equipment.balai}</span>
                ) : (
                  <span className="text-slate-800">{data.equipment.balai}</span>
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px]">
        <CardHeader className="gap-3">
          <div className="flex items-center justify-between gap-2 text-slate-950">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" />
              <CardTitle className="text-2xl text-slate-950">Data Fasilitator</CardTitle>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading || refreshing || !token}
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading || refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Memperbarui..." : loading ? "Memuat..." : "Perbarui"}
            </Button>
          </div>
          <CardDescription>
            Daftar pendamping sekolah untuk tahapan Verifikasi, Wawancara, Pra Bimtek, dan Bimtek.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          {!verifikasiReview && assignments.length === 0 && !loading && !error ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              Belum ada penugasan fasilitator. Silakan tunggu admin membagi jadwal untuk sekolah Anda.
            </div>
          ) : null}
          <div className="relative">
            {loading ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/70 backdrop-blur-[1px]">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Memuat data fasilitator...
                </div>
              </div>
            ) : null}
            <div className="grid gap-4">
              <TahapanSection
                title="Verifikasi"
                subtitle="Tahap 1"
                tone="primary"
                icon={<ClipboardCheck className="h-4.5 w-4.5 text-primary" />}
                data={tahapanFacilitators.verifikasi}
              />
              <TahapanSection
                title="Wawancara"
                subtitle="Tahap 2"
                tone="sky"
                icon={<CalendarCheck className="h-4.5 w-4.5 text-sky-700" />}
                data={tahapanFacilitators.wawancara}
              />
              <TahapanSection
                title="Pra Bimtek"
                subtitle="Tahap 3"
                tone="emerald"
                icon={<GraduationCap className="h-4.5 w-4.5 text-emerald-700" />}
                data={tahapanFacilitators.praBimtek}
              />
              <TahapanSection
                title="Bimtek"
                subtitle="Tahap 4"
                tone="violet"
                icon={<GraduationCap className="h-4.5 w-4.5 text-violet-700" />}
                data={tahapanFacilitators.bimtek}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
