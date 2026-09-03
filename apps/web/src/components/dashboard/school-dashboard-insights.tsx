"use client";

import {
  AlertCircle,
  BadgeCheck,
  Blocks,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  ListChecks,
  MessageSquareWarning,
  ShieldCheck,
  ShieldQuestion,
  Wrench,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ADMINISTRATIVE_DOCUMENT_LABELS,
  ADMINISTRATIVE_DOCUMENT_UMUM_CODES,
  schoolAdministrativeDocumentsRequest,
  schoolProfileRequest,
  schoolProposalDataRequest,
  workspaceVerifikasiOnlineReviewsRequest,
  type SchoolAdministrativeDocumentRecord,
  type SchoolProfileRecord,
  type WorkspaceVerifikasiOnlineRecord,
} from "@/lib/api";

const tahapanPengajuan = [
  { key: "profile", label: "Lengkapi Profil Sekolah", target: 100 },
  { key: "documents", label: "Unggah Dokumen Administrasi", target: 100 },
  { key: "verifikasi", label: "Verifikasi Online (Fasilitator)", target: 100 },
  { key: "proposal", label: "Survey Harga & Pengajuan RAB", target: 0 },
] as const;

type TahapanKey = (typeof tahapanPengajuan)[number]["key"];

export function SchoolDashboardInsights({ token }: { token: string }) {
  const [profile, setProfile] = useState<SchoolProfileRecord | null>(null);
  const [administrativeDocuments, setAdministrativeDocuments] = useState<SchoolAdministrativeDocumentRecord[]>([]);
  const [verifikasiReview, setVerifikasiReview] = useState<WorkspaceVerifikasiOnlineRecord | null>(null);
  const [proposalRowCount, setProposalRowCount] = useState(0);
  const [proposalValue, setProposalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const results = await Promise.allSettled([
          schoolProfileRequest(token),
          schoolAdministrativeDocumentsRequest(token),
          workspaceVerifikasiOnlineReviewsRequest(token),
          schoolProposalDataRequest(token),
        ]);

        if (active) {
          const [profileRes, docsRes, verifRes, proposalRes] = results;

          if (profileRes.status === "fulfilled") {
            setProfile(profileRes.value);
            if (profileRes.value.npsn && verifRes.status === "fulfilled") {
              const matched =
                verifRes.value.find((item) => item.schoolNpsn === profileRes.value.npsn) ?? null;
              setVerifikasiReview(matched);
            }
          }
          if (docsRes.status === "fulfilled") {
            setAdministrativeDocuments(docsRes.value);
          }
          if (proposalRes.status === "fulfilled") {
            const tables = proposalRes.value.proposalTables ?? {};
            const rpkpSelections = proposalRes.value.rpkpSelections ?? {};
            const getTableKey = (schoolId: string, concentrationCode: string, tabKey: string) =>
              `${schoolId}::${concentrationCode}::${tabKey}`;
            const cleanNumber = (raw: unknown): number =>
              Number(String(raw ?? "").replace(/[^\d]/g, "")) || 0;
            const roundToNearestThousand = (value: number): number => Math.round(value / 1000) * 1000;

            let totalItemsRpkpOnly = 0;
            let grandTotalRpkpBeforeRounding = 0;

            const profileRecord = profileRes.status === "fulfilled" ? profileRes.value : null;
            const concentrations = profileRecord?.concentrations ?? [];
            const schoolId = profileRecord?.schoolId;

            if (schoolId) {
              for (const kk of concentrations) {
                const surveyKey = getTableKey(schoolId, kk.code, "survey");
                const rpkpKey = getTableKey(schoolId, kk.code, "rpkp");
                const rows = Array.isArray((tables as Record<string, unknown[]>)[surveyKey])
                  ? ((tables as Record<string, unknown[]>)[surveyKey] as Array<Record<string, unknown>>)
                  : [];
                const rowToShop =
                  (rpkpSelections as Record<string, Partial<Record<string, "shop1" | "shop2" | "shop3">>>)[rpkpKey] ??
                  {};

                for (const row of rows) {
                  const shopKey = rowToShop[row.id as string];
                  if (!shopKey) continue;
                  const shop = (row[shopKey] ?? {}) as Record<string, unknown>;
                  const unit =
                    cleanNumber(shop.priceWithTax) +
                    cleanNumber(shop.shippingCost) +
                    cleanNumber(shop.installationCost);
                  const qty = cleanNumber(row.quantity);
                  totalItemsRpkpOnly += 1;
                  grandTotalRpkpBeforeRounding += unit * qty;
                }
              }
            }

            setProposalRowCount(totalItemsRpkpOnly);
            setProposalValue(roundToNearestThousand(grandTotalRpkpBeforeRounding));
          }

          const anyFulfilled = results.some((r) => r.status === "fulfilled");
          if (!anyFulfilled) {
            setError("Gagal memuat ringkasan sekolah.");
          }
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Gagal memuat ringkasan sekolah.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [token]);

  const EXCLUDED_ADMIN_CODES = new Set<string>([
    "akta-pendirian-yayasan",
    "pengesahan-yayasan-kemenkumham",
  ]);

  const ADMIN_UMUM_INCLUDED_CODES = (ADMINISTRATIVE_DOCUMENT_UMUM_CODES ?? []).filter(
    (code) => !EXCLUDED_ADMIN_CODES.has(code),
  );

  const ADMIN_UMUM_INCLUDED_SET = new Set<string>(ADMIN_UMUM_INCLUDED_CODES);

  const administrativeDocumentsFiltered = useMemo(
    () =>
      administrativeDocuments.filter(
        (item) => ADMIN_UMUM_INCLUDED_SET.has(String(item.code ?? "").trim()),
      ),
    [administrativeDocuments],
  );

  const uploadedDocuments = useMemo(
    () => administrativeDocumentsFiltered.filter((item) => item.uploaded).length,
    [administrativeDocumentsFiltered],
  );
  const totalDocuments = ADMIN_UMUM_INCLUDED_CODES.length || 10;

  const profileProgress = useMemo(() => {
    if (!profile) return 0;
    let score = 0;
    let total = 0;
    const fieldKeys = [
      "npsn",
      "schoolName",
      "province",
      "city",
      "principalName",
      "vicePrincipalFacilitiesName",
      "totalRombel",
      "totalStudents",
    ] as const;
    for (const f of fieldKeys) {
      total += 1;
      const value = profile[f];
      if (value !== undefined && value !== null && String(value).trim() !== "") score += 1;
    }
    total += Math.max(1, profile.concentrations?.length ?? 0);
    score += Math.min(profile.concentrations?.length ?? 0, 1) > 0 ? profile.concentrations?.length ?? 0 : 0;
    return Math.round((score / total) * 100);
  }, [profile]);

  const documentsProgress = totalDocuments > 0 ? Math.round((uploadedDocuments / totalDocuments) * 100) : 0;

  const verifikasiProgress = useMemo(() => {
    if (!verifikasiReview) return 0;
    const admin = verifikasiReview.approvedAdmin === true ? 1 : verifikasiReview.approvedAdmin === false ? 0 : 0;
    const alat = verifikasiReview.approvedEquipment === true ? 1 : verifikasiReview.approvedEquipment === false ? 0 : 0;
    const adminDone = verifikasiReview.approvedAdmin !== null ? 1 : 0;
    const alatDone = verifikasiReview.approvedEquipment !== null ? 1 : 0;
    const total = 2;
    const done = (admin + alat + adminDone + alatDone) / 2;
    return Math.round((done / total) * 100);
  }, [verifikasiReview]);

  const proposalProgress = proposalRowCount > 0 ? Math.min(100, 35) : 0;

  const progressByTahapan: Record<TahapanKey, number> = {
    profile: profileProgress,
    documents: documentsProgress,
    verifikasi: verifikasiProgress,
    proposal: proposalProgress,
  };

  const overallProgress = Math.round(
    tahapanPengajuan.reduce((sum, t) => sum + progressByTahapan[t.key], 0) / tahapanPengajuan.length,
  );

  const statusPengajuan = useMemo(() => {
    const allFull = tahapanPengajuan.every((t) => progressByTahapan[t.key] >= 100);
    if (allFull) return { stage: "SELESAI", label: "Pengajuan Selesai", tone: "success" as const };
    if (
      progressByTahapan.profile >= 100 &&
      progressByTahapan.documents >= 100 &&
      progressByTahapan.verifikasi >= 100
    ) {
      return { stage: "PENGAJUAN_RAB", label: "Proses Pengajuan RAB", tone: "info" as const };
    }
    if (progressByTahapan.profile >= 100 && progressByTahapan.documents >= 100) {
      return { stage: "DALAM_VERIFIKASI", label: "Dalam Verifikasi Fasilitator", tone: "warning" as const };
    }
    if (progressByTahapan.profile >= 100) {
      return { stage: "UNGGAH_DOKUMEN", label: "Lengkapi Dokumen Administrasi", tone: "warning" as const };
    }
    return { stage: "LENGKAPI_PROFIL", label: "Lengkapi Profil Sekolah", tone: "danger" as const };
  }, [progressByTahapan]);

  const totalRombel = profile?.totalRombel ?? 0;
  const totalStudents = profile?.totalStudents ?? 0;

  const toneStyles: Record<
    "success" | "warning" | "danger" | "info",
    { border: string; bg: string; badge: string; text: string; icon: string; dot: string }
  > = {
    success: {
      border: "border-emerald-200",
      bg: "bg-emerald-50/60",
      badge: "bg-emerald-600 text-white",
      text: "text-emerald-800",
      icon: "text-emerald-600",
      dot: "bg-emerald-500",
    },
    warning: {
      border: "border-amber-200",
      bg: "bg-amber-50/60",
      badge: "bg-amber-600 text-white",
      text: "text-amber-800",
      icon: "text-amber-600",
      dot: "bg-amber-500",
    },
    danger: {
      border: "border-rose-200",
      bg: "bg-rose-50/60",
      badge: "bg-rose-600 text-white",
      text: "text-rose-800",
      icon: "text-rose-600",
      dot: "bg-rose-500",
    },
    info: {
      border: "border-sky-200",
      bg: "bg-sky-50/60",
      badge: "bg-sky-600 text-white",
      text: "text-sky-800",
      icon: "text-sky-600",
      dot: "bg-sky-500",
    },
  };
  const tone = toneStyles[statusPengajuan.tone];

  const resolveConcentrationLabel = useMemo(() => {
    const map = new Map<string, string>();
    if (profile && profile.concentrations.length) {
      for (const kk of profile.concentrations) {
        map.set(kk.code, `${kk.code} - ${kk.name}`);
      }
    }
    return (key: string) => {
      if (!key) return key;
      if (map.has(key)) return map.get(key) as string;
      for (const [code, label] of map.entries()) {
        if (key.includes(code)) return label;
      }
      const lastDash = key.lastIndexOf("-");
      return lastDash > 0 ? key.slice(lastDash + 1).trim() : key;
    };
  }, [profile]);

  const resolveDocumentLabel = (key: string) => {
    if (!key) return key;
    if (ADMINISTRATIVE_DOCUMENT_LABELS[key]) return ADMINISTRATIVE_DOCUMENT_LABELS[key];
    const lastDash = key.lastIndexOf("-");
    return lastDash > 0 ? key.slice(lastDash + 1).trim() : key;
  };

  const resolveConditionLabel = (key: string) => {
    if (!key) return key;
    if (profile && profile.concentrations.length) {
      for (const kk of profile.concentrations) {
        if (key.includes(kk.code)) return `Kondisi Ruang Praktik ${resolveConcentrationLabel(kk.code)}`;
      }
    }
    const lastDash = key.lastIndexOf("-");
    const code = lastDash > 0 ? key.slice(lastDash + 1).trim() : key;
    return `Kondisi Ruangan (${code})`;
  };

  const resolveProposalLabel = (key: string) => {
    if (!key) return key;
    if (profile && profile.concentrations.length) {
      for (const kk of profile.concentrations) {
        if (key.includes(kk.code)) return `Pengajuan Alat ${resolveConcentrationLabel(kk.code)}`;
      }
    }
    const lastDash = key.lastIndexOf("-");
    const code = lastDash > 0 ? key.slice(lastDash + 1).trim() : key;
    return `Pengajuan Alat (${code})`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="px-6 py-5 text-sm text-slate-600">
          Memuat ringkasan dashboard sekolah...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 px-6 py-5 text-sm text-rose-700">
          <AlertCircle className="h-5 w-5" />
          {error}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RingkasCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="NPSN"
          value={profile?.npsn || "-"}
          helper={profile?.schoolName || "Nama sekolah"}
        />
        <RingkasCard
          icon={<BadgeCheck className="h-4 w-4" />}
          label="Konsentrasi Keahlian"
          value={`${profile?.concentrations.length ?? 0}`}
          helper={`${totalRombel} rombel · ${totalStudents} siswa`}
        />
        <RingkasCard
          icon={<FileText className="h-4 w-4" />}
          label="Dokumen Administrasi"
          value={`${uploadedDocuments}/${totalDocuments}`}
          helper={
            documentsProgress >= 100
              ? "Sudah lengkap"
              : `${Math.max(0, totalDocuments - uploadedDocuments)} belum diunggah`
          }
        />
        <RingkasCard
          icon={<ClipboardList className="h-4 w-4" />}
          label="Pengajuan RAB"
          value={proposalValue > 0 ? `Rp ${proposalValue.toLocaleString("id-ID")}` : "-"}
          helper={`${proposalRowCount} item harga`}
        />
      </section>

      <Card className={`border ${tone.border} ${tone.bg}`}>
        <CardHeader className="flex flex-col gap-4 pb-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 ${tone.icon}`}
            >
              <ListChecks className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-950">Status Pengajuan Bantuan Sarana</h2>
                <Badge className={`rounded-full px-3 py-1 text-xs font-semibold ${tone.badge}`}>
                  {statusPengajuan.label}
                </Badge>
              </div>
              <CardDescription className="mt-1 max-w-2xl leading-6">
                Pantau tahapan pengajuan sekolah. Selesaikan setiap tahapan sesuai urutan agar bantuan
                sarana dapat segera diproses.
              </CardDescription>
            </div>
          </div>
          <div className="w-full lg:w-64">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>Progres Keseluruhan</span>
              <span className={tone.text}>{overallProgress}%</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  statusPengajuan.tone === "success"
                    ? "bg-emerald-500"
                    : statusPengajuan.tone === "warning"
                      ? "bg-amber-500"
                      : statusPengajuan.tone === "danger"
                        ? "bg-rose-500"
                        : "bg-sky-500"
                }`}
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              {statusPengajuan.stage === "SELESAI"
                ? "Seluruh tahapan telah diselesaikan. Tunggu tindak lanjut dari unit terkait."
                : `Tahapan selanjutnya: ${statusPengajuan.label}.`}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {tahapanPengajuan.map((t, idx) => {
              const progress = progressByTahapan[t.key];
              const isDone = progress >= 100;
              const isCurrent = !isDone && tahapanPengajuan.findIndex((tt) => progressByTahapan[tt.key] < 100) === idx;
              return (
                <li
                  key={t.key}
                  className={`rounded-2xl border p-4 ${
                    isCurrent
                      ? `border-slate-300 bg-white shadow-sm ring-2 ring-primary/20`
                      : isDone
                        ? "border-emerald-200 bg-white"
                        : "border-slate-200 bg-white/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          isDone
                            ? "bg-emerald-600 text-white"
                            : isCurrent
                              ? "bg-primary text-white"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                      </div>
                      <p
                        className={`text-sm font-semibold ${
                          isCurrent ? "text-slate-950" : isDone ? "text-emerald-800" : "text-slate-500"
                        }`}
                      >
                        {t.label}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        isDone ? "text-emerald-700" : isCurrent ? "text-primary" : "text-slate-500"
                      }`}
                    >
                      {progress}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isDone
                          ? "bg-emerald-500"
                          : isCurrent
                            ? "bg-primary"
                            : "bg-slate-300"
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>

          {verifikasiReview ? (
            <div className="mt-5 grid gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 md:grid-cols-2 md:p-5">
              <VerifikasiStatusCard
                reviewer="Fasilitator Administrasi"
                reviewerIcon={<FileSpreadsheet className="h-3.5 w-3.5" />}
                approved={verifikasiReview.approvedAdmin}
                reviewedAt={verifikasiReview.reviewedAdminAt}
                reviewerName={verifikasiReview.reviewedAdminName}
                note={verifikasiReview.reviewNoteAdmin}
                resolveConcentrationLabel={resolveConcentrationLabel}
                resolveDocumentLabel={resolveDocumentLabel}
                resolveConditionLabel={resolveConditionLabel}
                resolveProposalLabel={resolveProposalLabel}
              />
              <VerifikasiStatusCard
                reviewer="Fasilitator Alat"
                reviewerIcon={<Wrench className="h-3.5 w-3.5" />}
                approved={verifikasiReview.approvedEquipment}
                reviewedAt={verifikasiReview.reviewedEquipmentAt}
                reviewerName={verifikasiReview.reviewedEquipmentName}
                note={verifikasiReview.reviewNoteEquipment}
                resolveConcentrationLabel={resolveConcentrationLabel}
                resolveDocumentLabel={resolveDocumentLabel}
                resolveConditionLabel={resolveConditionLabel}
                resolveProposalLabel={resolveProposalLabel}
              />
            </div>
          ) : (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-white/50 p-4 text-sm text-slate-600">
              <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <div>
                <p className="font-medium text-slate-800">Belum ada penugasan verifikasi.</p>
                <p className="mt-1 leading-5">
                  Setelah profil sekolah dan dokumen administrasi lengkap, admin akan menugaskan fasilitator
                  untuk melakukan verifikasi online terhadap sekolah Anda.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VerifikasiStatusCard({
  reviewer,
  reviewerIcon,
  approved,
  reviewedAt,
  reviewerName,
  note,
  resolveConcentrationLabel,
  resolveDocumentLabel,
  resolveConditionLabel,
  resolveProposalLabel,
}: {
  reviewer: string;
  reviewerIcon: React.ReactNode;
  approved: boolean | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  note: string | null;
  resolveConcentrationLabel: (key: string) => string;
  resolveDocumentLabel: (key: string) => string;
  resolveConditionLabel: (key: string) => string;
  resolveProposalLabel: (key: string) => string;
}) {
  type ParsedReviewEntry = { status?: string; note?: string };
  type StructuredReviewNotes = {
    globalNote: string;
    concentrations: Record<string, ParsedReviewEntry>;
    documents: Record<string, ParsedReviewEntry>;
    conditions: Record<string, ParsedReviewEntry>;
    proposals: Record<string, ParsedReviewEntry>;
  };
  const parseStructuredReviewNotes = (raw: string | null | undefined): StructuredReviewNotes => {
    const empty: StructuredReviewNotes = {
      globalNote: "",
      concentrations: {},
      documents: {},
      conditions: {},
      proposals: {},
    };
    if (!raw || !raw.trim()) return empty;
    const text = raw.trim();
    if (!text.startsWith("{")) {
      return { ...empty, globalNote: text };
    }
    try {
      const parsed = JSON.parse(text) as Partial<StructuredReviewNotes>;
      return {
        globalNote: String(parsed.globalNote ?? "").trim(),
        concentrations:
          typeof parsed.concentrations === "object" && parsed.concentrations !== null
            ? (parsed.concentrations as StructuredReviewNotes["concentrations"])
            : {},
        documents:
          typeof parsed.documents === "object" && parsed.documents !== null
            ? (parsed.documents as StructuredReviewNotes["documents"])
            : {},
        conditions:
          typeof parsed.conditions === "object" && parsed.conditions !== null
            ? (parsed.conditions as StructuredReviewNotes["conditions"])
            : {},
        proposals:
          typeof parsed.proposals === "object" && parsed.proposals !== null
            ? (parsed.proposals as StructuredReviewNotes["proposals"])
            : {},
      };
    } catch {
      return { ...empty, globalNote: text };
    }
  };

  const getStatusBadgeStyle = (status?: string) => {
    const s = status ? String(status).toLowerCase() : "";
    if (s === "approved" || s.includes("setuju") || s.includes("approve"))
      return { className: "border border-emerald-200 bg-emerald-50 text-emerald-700", label: "Disetujui" };
    if (s === "rejected" || s.includes("tolak"))
      return { className: "border border-rose-200 bg-rose-50 text-rose-700", label: "Perlu Perbaikan" };
    if (s === "attention" || s.includes("perlu") || s === "pending")
      return { className: "border border-amber-200 bg-amber-50 text-amber-700", label: "Perlu Perhatian" };
    return { className: "border border-slate-200 bg-slate-100 text-slate-600", label: "Belum Ada Note" };
  };

  const parsed = parseStructuredReviewNotes(note);
  const docCount = Object.keys(parsed.documents).length;
  const concentrationCount = Object.keys(parsed.concentrations).length;
  const conditionCount = Object.keys(parsed.conditions).length;
  const proposalCount = Object.keys(parsed.proposals).length;
  const hasAnyDetail = docCount + concentrationCount + conditionCount + proposalCount > 0;
  const hasAnyNote = Boolean(parsed.globalNote.trim()) || hasAnyDetail;

  let status: { tone: "approved" | "rejected" | "waiting" | "attention"; label: string };
  if (approved === true) status = { tone: "approved", label: "Disetujui" };
  else if (approved === false) status = { tone: "rejected", label: "Perlu Perbaikan" };
  else if (hasAnyNote) status = { tone: "attention", label: "Perlu Perhatian" };
  else status = { tone: "waiting", label: "Menunggu Review" };

  const styleMap = {
    approved: {
      badge: "bg-emerald-600 text-white",
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
    },
    rejected: {
      badge: "bg-rose-600 text-white",
      icon: XCircle,
      iconColor: "text-rose-600",
    },
    waiting: {
      badge: "bg-slate-500 text-white",
      icon: ShieldQuestion,
      iconColor: "text-slate-500",
    },
    attention: {
      badge: "bg-amber-500 text-white",
      icon: Clock3,
      iconColor: "text-amber-600",
    },
  };
  const style = styleMap[status.tone];
  const StatusIcon = style.icon;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100 ${style.iconColor}`}
          >
            <StatusIcon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                {reviewer}
              </p>
              <Badge
                variant="secondary"
                className="rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-semibold tracking-wide px-2 py-0"
              >
                {reviewerIcon}
                Verifikator
              </Badge>
            </div>
            <p className="mt-2 text-[15px] font-semibold leading-5 text-slate-900">
              {reviewerName ?? "Belum ada reviewer ditugaskan"}
            </p>
            {reviewerName ? (
              <p className="mt-1 text-[11px] text-slate-500">
                {reviewedAt ? (
                  <>
                    Ditinjau pada{" "}
                    <strong className="text-slate-700">
                      {new Intl.DateTimeFormat("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(reviewedAt))}
                    </strong>
                  </>
                ) : (
                  <span className="italic">Belum ada jadwal detail review</span>
                )}
              </p>
            ) : (
              <p className="mt-1 text-[11px] italic text-slate-400 leading-5">
                Admin akan menugaskan reviewer ketika profil &amp; dokumen administrasi sekolah sudah dianggap cukup untuk diverifikasi.
              </p>
            )}
          </div>
        </div>
        <Badge
          className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-wide shadow-sm ${style.badge}`}
        >
          {status.label}
        </Badge>
      </div>

      {parsed.globalNote.trim() || hasAnyDetail ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
          {parsed.globalNote.trim() ? (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <MessageSquareWarning className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  Catatan Umum Reviewer
                </span>
              </div>
              <div className="block text-[13px] leading-6 whitespace-pre-wrap rounded-lg bg-white border border-slate-200 px-3.5 py-3 text-slate-800 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                {parsed.globalNote.trim()}
              </div>
            </div>
          ) : null}

          {hasAnyDetail ? (
            <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2 text-[11px]">
              {docCount > 0 ? (
                <span className="inline-flex items-center rounded-md px-2.5 py-1 font-semibold border border-blue-200 bg-blue-50 text-blue-700">
                  <FileSpreadsheet className="mr-1 h-3 w-3" />
                  {docCount} Dokumen Punya Catatan
                </span>
              ) : null}
              {concentrationCount > 0 ? (
                <span className="inline-flex items-center rounded-md px-2.5 py-1 font-semibold border border-violet-200 bg-violet-50 text-violet-700">
                  <Blocks className="mr-1 h-3 w-3" />
                  {concentrationCount} KK Punya Catatan Konsentrasi
                </span>
              ) : null}
              {conditionCount > 0 ? (
                <span className="inline-flex items-center rounded-md px-2.5 py-1 font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700">
                  <Building2 className="mr-1 h-3 w-3" />
                  {conditionCount} Kondisi Ruang Punya Catatan
                </span>
              ) : null}
              {proposalCount > 0 ? (
                <span className="inline-flex items-center rounded-md px-2.5 py-1 font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700">
                  <Wrench className="mr-1 h-3 w-3" />
                  {proposalCount} Pengajuan Alat Punya Catatan
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {docCount > 0 ? (
        <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-700" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-900">
                Catatan Review Dokumen Administrasi
              </p>
            </div>
            <Badge className="bg-white border-blue-200 text-blue-800 text-[11px]">
              {docCount} item
            </Badge>
          </div>
          <div className="space-y-2">
            {Object.entries(parsed.documents).map(([key, entry], idx) => {
              const statusStyle = getStatusBadgeStyle(entry.status);
              return (
                <div
                  key={`doc-${key}-${idx}`}
                  className="rounded-[14px] border border-blue-200/80 bg-white p-3 space-y-1.5 shadow-[0_1px_0_rgba(59,130,246,0.06)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-slate-800">
                      {resolveDocumentLabel(key)}
                    </p>
                    <Badge
                      className={`text-[10px] font-bold tracking-wide ${statusStyle.className}`}
                    >
                      {statusStyle.label}
                    </Badge>
                  </div>
                  {entry.note?.trim() ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-700 whitespace-pre-wrap">
                      {entry.note.trim()}
                    </div>
                  ) : (
                    <p className="text-[11px] italic text-slate-400">
                      Hanya status {statusStyle.label.toLowerCase()}, tanpa catatan tambahan.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {concentrationCount > 0 ? (
        <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Blocks className="h-3.5 w-3.5 text-violet-700" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-900">
                Catatan Review Konsentrasi Keahlian (KK)
              </p>
            </div>
            <Badge className="bg-white border-violet-200 text-violet-800 text-[11px]">
              {concentrationCount} item
            </Badge>
          </div>
          <div className="space-y-2">
            {Object.entries(parsed.concentrations).map(([key, entry], idx) => {
              const statusStyle = getStatusBadgeStyle(entry.status);
              return (
                <div
                  key={`kk-${key}-${idx}`}
                  className="rounded-[14px] border border-violet-200/80 bg-white p-3 space-y-1.5 shadow-[0_1px_0_rgba(139,92,246,0.06)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-slate-800">
                      {resolveConcentrationLabel(key)}
                    </p>
                    <Badge
                      className={`text-[10px] font-bold tracking-wide ${statusStyle.className}`}
                    >
                      {statusStyle.label}
                    </Badge>
                  </div>
                  {entry.note?.trim() ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-700 whitespace-pre-wrap">
                      {entry.note.trim()}
                    </div>
                  ) : (
                    <p className="text-[11px] italic text-slate-400">
                      Hanya status {statusStyle.label.toLowerCase()}, tanpa catatan tambahan.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {conditionCount > 0 ? (
        <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-indigo-700" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-900">
                Catatan Review Kondisi Ruang Praktik
              </p>
            </div>
            <Badge className="bg-white border-indigo-200 text-indigo-800 text-[11px]">
              {conditionCount} item
            </Badge>
          </div>
          <div className="space-y-2">
            {Object.entries(parsed.conditions).map(([key, entry], idx) => {
              const statusStyle = getStatusBadgeStyle(entry.status);
              return (
                <div
                  key={`cond-${key}-${idx}`}
                  className="rounded-[14px] border border-indigo-200/80 bg-white p-3 space-y-1.5 shadow-[0_1px_0_rgba(99,102,241,0.06)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-slate-800">
                      {resolveConditionLabel(key)}
                    </p>
                    <Badge
                      className={`text-[10px] font-bold tracking-wide ${statusStyle.className}`}
                    >
                      {statusStyle.label}
                    </Badge>
                  </div>
                  {entry.note?.trim() ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-700 whitespace-pre-wrap">
                      {entry.note.trim()}
                    </div>
                  ) : (
                    <p className="text-[11px] italic text-slate-400">
                      Hanya status {statusStyle.label.toLowerCase()}, tanpa catatan tambahan.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {proposalCount > 0 ? (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5 text-emerald-700" />
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-900">
                Catatan Review Pengajuan Alat
              </p>
            </div>
            <Badge className="bg-white border-emerald-200 text-emerald-800 text-[11px]">
              {proposalCount} item
            </Badge>
          </div>
          <div className="space-y-2">
            {Object.entries(parsed.proposals).map(([key, entry], idx) => {
              const statusStyle = getStatusBadgeStyle(entry.status);
              return (
                <div
                  key={`prop-${key}-${idx}`}
                  className="rounded-[14px] border border-emerald-200/80 bg-white p-3 space-y-1.5 shadow-[0_1px_0_rgba(16,185,129,0.06)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-slate-800">
                      {resolveProposalLabel(key)}
                    </p>
                    <Badge
                      className={`text-[10px] font-bold tracking-wide ${statusStyle.className}`}
                    >
                      {statusStyle.label}
                    </Badge>
                  </div>
                  {entry.note?.trim() ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] leading-5 text-slate-700 whitespace-pre-wrap">
                      {entry.note.trim()}
                    </div>
                  ) : (
                    <p className="text-[11px] italic text-slate-400">
                      Hanya status {statusStyle.label.toLowerCase()}, tanpa catatan tambahan.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!reviewerName && !hasAnyNote ? (
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3.5 py-3 text-[12px] italic text-slate-500 leading-5">
          <ShieldQuestion className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
          Belum ada aktivitas verifikasi online dari reviewer {reviewer} untuk sekolah Anda.
        </div>
      ) : null}
    </div>
  );
}

function RingkasCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="flex items-start gap-3 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-primary">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p className="mt-1.5 truncate text-lg font-semibold text-slate-950">{value}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export { FileBarChart2 };
