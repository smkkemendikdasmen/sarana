"use client";

import {
  AlertCircle,
  BadgeCheck,
  Building2,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  adminUsersRequest,
  bulkSekolahSetActiveRequest,
  createAdminUserRequest,
  deleteAdminUserRequest,
  resetPasswordDefaultAdminRequest,
  updateAdminUserRequest,
  workspaceAssignmentSourceRequest,
  type AdminRoleOption,
  type AdminSchoolOption,
  type AdminUserInput,
  type AdminUserRecord,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/auth-store";

type FormState = {
  username: string;
  fullName: string;
  roleCode: string;
  schoolId: string;
  password: string;
  isActive: boolean;
  email: string;
};

type UserTabKey =
  | "ADMIN"
  | "FASILITATOR_ADMINISTRASI"
  | "FASILITATOR_ALAT"
  | "SEKOLAH_ABT";

type GeneratedAkunSekolah = {
  no: number;
  npsn: string;
  nama: string;
  provinsi: string;
  kabKota: string;
  username: string;
  password: string;
  userId?: string;
  status: "PENDING" | "BERHASIL" | "DUPLICATE";
  error?: string;
};

type SourceSekolahRow = {
  no?: number;
  npsn?: string;
  nama_sekolah?: string;
  provinsi?: string;
  kab_kota?: string;
  kecamatan?: string;
  catatan?: string;
  status_penerima_abt?: string;
  col_0?: string;
  col_1?: string;
  col_2?: string;
  col_3?: string;
  [key: string]: unknown;
};

const USER_TABS: Array<{
  key: UserTabKey;
  label: string;
  icon: typeof Users;
  hint: string;
  filterFn?: (users: AdminUserRecord[]) => AdminUserRecord[];
  isSekolahSource?: "bantuan" | "abt";
  roleCodeForCreateSekolah?: string;
}> = [
  {
    key: "ADMIN",
    label: "Admin",
    icon: ShieldCheck,
    hint: "Super admin / master data",
    filterFn: (users) => users.filter((u) => u.roleCode === "ADMIN"),
  },
  {
    key: "FASILITATOR_ADMINISTRASI",
    label: "Fasilitator Administrasi",
    icon: Shield,
    hint: "Pendamping administrasi sekolah",
    filterFn: (users) => users.filter((u) => u.roleCode === "FASILITATOR_ADMINISTRASI"),
  },
  {
    key: "FASILITATOR_ALAT",
    label: "Fasilitator Alat",
    icon: BadgeCheck,
    hint: "Pendamping data sarana & verifikasi online",
    filterFn: (users) => users.filter((u) => u.roleCode === "FASILITATOR_ALAT"),
  },
  {
    key: "SEKOLAH_ABT",
    label: "Sekolah ABT",
    icon: Building2,
    hint: "Akun sekolah penerima Bantuan Sarana ABT (131 sekolah). Sumber data diambil dari database (tabel workspace sekolah penerima ABT — 131 NPSN & Nama SMK sudah terdaftar).",
    filterFn: (users) => users.filter((u) => u.roleCode === "SEKOLAH"),
    isSekolahSource: "abt",
    roleCodeForCreateSekolah: "SEKOLAH",
  },
];

const emptyForm: FormState = {
  username: "",
  fullName: "",
  roleCode: "ADMIN",
  schoolId: "",
  password: "",
  isActive: true,
  email: "",
};

function toFormState(user: AdminUserRecord): FormState {
  return {
    username: user.username,
    fullName: user.fullName,
    roleCode: user.roleCode,
    schoolId: user.schoolId ?? "",
    password: "",
    isActive: user.isActive,
    email: user.email ?? "",
  };
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function normalizeText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function pickSchoolNpsn(row: SourceSekolahRow): string {
  const val = normalizeText(row.npsn ?? row.col_2 ?? row["NPSN"]);
  if (/^\d+(\.0+)?$/.test(val)) return String(Number(val));
  return val.replace(/[^0-9]/g, "");
}

function generateSecurePassword(length = 16): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%^&";
  const out: string[] = [];
  if (typeof window !== "undefined" && typeof window.crypto?.getRandomValues === "function") {
    const buf = new Uint32Array(length);
    window.crypto.getRandomValues(buf);
    for (let i = 0; i < length; i += 1) out.push(charset[buf[i] % charset.length]);
  } else {
    for (let i = 0; i < length; i += 1) out.push(charset[Math.floor(Math.random() * charset.length)]);
  }
  return out.join("");
}

function triggerTsvDownload(rows: GeneratedAkunSekolah[]) {
  const headers = ["No", "NPSN", "Nama Sekolah", "Provinsi", "Kab/Kota", "Username", "Password", "Status", "Catatan"];
  const lines = [headers.join("\t")];
  for (const row of rows) {
    const fields = [
      String(row.no),
      row.npsn,
      row.nama.replace(/\t/g, " ").replace(/\r?\n/g, " "),
      row.provinsi.replace(/\t/g, " "),
      row.kabKota.replace(/\t/g, " "),
      row.username,
      row.password,
      row.status,
      row.error ?? "",
    ];
    lines.push(fields.map((f) => `"${f.replaceAll('"', '""')}"`).join("\t"));
  }
  const text = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([text], { type: "text/tab-separated-values;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  anchor.download = `daftar-akun-sekolah-abt-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.tsv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function csvEscape(value: string | number | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  const needsQuote = /[",\r\n]/.test(text);
  const escaped = text.replaceAll('"', '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

function triggerCsvDownloadAkunSekolahAktif(rows: AdminUserRecord[]) {
  const headers = ["NPSN", "Nama Sekolah", "Password Aktif"];
  const lines = [headers.map(csvEscape).join(",")];
  for (const user of rows) {
    const npsn = user.username;
    const nama = user.fullName ?? "";
    const passwordAktif = user.passwordCurrent && user.passwordCurrent.trim()
      ? user.passwordCurrent
      : user.passwordDefault && user.passwordDefault.trim()
        ? user.passwordDefault
        : "-";
    lines.push([npsn, nama, passwordAktif].map(csvEscape).join(","));
  }
  const text = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  anchor.download = `daftar-npsn-password-aktif-sekolah-abt-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function UsersManagement() {
  const { hydrate, hydrated, session } = useAuthStore();
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [roles, setRoles] = useState<AdminRoleOption[]>([]);
  const [schools, setSchools] = useState<AdminSchoolOption[]>([]);
  const [activeTab, setActiveTab] = useState<UserTabKey>("ADMIN");
  const [loading, setLoading] = useState(true);
  const [sourceSekolahRows, setSourceSekolahRows] = useState<SourceSekolahRow[]>([]);
  const [loadingSource, setLoadingSource] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [generatedRows, setGeneratedRows] = useState<GeneratedAkunSekolah[]>([]);
  const [creatingBulk, setCreatingBulk] = useState(false);
  const [bulkProgressText, setBulkProgressText] = useState("");
  const [passwordVisibleRows, setPasswordVisibleRows] = useState<Set<number>>(new Set());
  const [passwordVisibleUserIds, setPasswordVisibleUserIds] = useState<Set<string>>(new Set());
  const [passwordActiveVisibleUserIds, setPasswordActiveVisibleUserIds] = useState<Set<string>>(new Set());
  const [creatingRowNo, setCreatingRowNo] = useState<number | null>(null);
  const [resettingRowNo, setResettingRowNo] = useState<number | null>(null);
  const [deletingRowNo, setDeletingRowNo] = useState<number | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [togglingActiveUserId, setTogglingActiveUserId] = useState<string | null>(null);
  const [resetPasswordFeedback, setResetPasswordFeedback] = useState<{
    userName: string;
    npsnUsername: string;
    newPassword: string;
  } | null>(null);

  const activeTabDef = USER_TABS.find((tab) => tab.key === activeTab) ?? USER_TABS[0]!;

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const HIDDEN_ROLES = ["SUPERADMIN", "KOORDINATOR_ALAT", "PPK"];

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const payload = await adminUsersRequest();
      setUsers(payload.users.filter((u) => !HIDDEN_ROLES.includes(u.roleCode)));
      setRoles(payload.roles.filter((r) => !HIDDEN_ROLES.includes(r.code)));
      setSchools(payload.schools);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Gagal memuat data pengguna.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    const token = session?.token;
    const sekolahSource = activeTabDef.isSekolahSource;
    if (!hydrated || !sekolahSource) {
      setSourceSekolahRows([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingSource(true);
      try {
        let rows: SourceSekolahRow[] = [];
        if (token) {
          rows = (await workspaceAssignmentSourceRequest(token, sekolahSource)) as SourceSekolahRow[];
        }
        if (!cancelled) setSourceSekolahRows(Array.isArray(rows) ? rows : []);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setSourceSekolahRows([]);
        }
      } finally {
        if (!cancelled) setLoadingSource(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.token, activeTab, activeTabDef.isSekolahSource]);

  useEffect(() => {
    if (!activeTabDef.isSekolahSource) return;
    if (sourceSekolahRows.length === 0 || creatingBulk) return;
    if (generatedRows.length > 0) return;
    prepareBulkRows();
  }, [activeTab, activeTabDef.isSekolahSource, sourceSekolahRows.length, creatingBulk, generatedRows.length]);

  const usersForTab = useMemo<AdminUserRecord[]>(() => activeTabDef.filterFn ? activeTabDef.filterFn(users) : users, [users, activeTabDef]);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return usersForTab;
    }

    return usersForTab.filter((user) =>
      [user.username, user.fullName, user.roleName, user.schoolName ?? ""].join(" ").toLowerCase().includes(normalizedQuery),
    );
  }, [query, usersForTab]);

  const countStats = useMemo(() => {
    const byRole: Record<string, number> = {};
    for (const u of users) byRole[u.roleCode] = (byRole[u.roleCode] ?? 0) + 1;
    return {
      total: users.length,
      admin: byRole["ADMIN"] ?? 0,
      fasilitatorAdministrasi: byRole["FASILITATOR_ADMINISTRASI"] ?? 0,
      fasilitatorAlat: byRole["FASILITATOR_ALAT"] ?? 0,
      sekolah: byRole["SEKOLAH"] ?? 0,
      sekolahAbt: users.filter((u) => u.roleCode === "SEKOLAH").length,
      sourceAbt: sourceSekolahRows.length,
    };
  }, [users, sourceSekolahRows]);

  function openCreateForm() {
    setEditingUserId(null);
    const defaultRole = activeTab === "SEKOLAH_ABT"
      ? "SEKOLAH"
      : activeTab === "FASILITATOR_ADMINISTRASI"
        ? "FASILITATOR_ADMINISTRASI"
        : activeTab === "FASILITATOR_ALAT"
          ? "FASILITATOR_ALAT"
          : roles[0]?.code ?? "ADMIN";
    setForm({
      ...emptyForm,
      roleCode: defaultRole,
    });
    setFeedback(null);
    setIsFormOpen(true);
  }

  function openEditForm(user: AdminUserRecord) {
    setEditingUserId(user.id);
    setForm(toFormState(user));
    setFeedback(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingUserId(null);
    setForm(emptyForm);
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    const payload: AdminUserInput = {
      username: form.username,
      fullName: form.fullName,
      roleCode: form.roleCode,
      schoolId: form.roleCode === "SEKOLAH" ? form.schoolId || null : null,
      password: form.password || undefined,
      isActive: form.isActive,
      email: form.email.trim() ? form.email.trim() : null,
    };

    setSubmitting(true);
    setFeedback(null);

    try {
      const savedUser = editingUserId
        ? await updateAdminUserRequest(editingUserId, payload)
        : await createAdminUserRequest(payload);

      void loadData();

      setFeedback({
        type: "success",
        text: editingUserId ? "Perubahan pengguna berhasil disimpan." : "Pengguna baru berhasil dibuat.",
      });

      if (!editingUserId) {
        setForm({
          ...emptyForm,
          roleCode: roles[0]?.code ?? "ADMIN",
        });
      }
      void savedUser;
    } catch (submitError) {
      setFeedback({
        type: "error",
        text: submitError instanceof Error ? submitError.message : "Gagal menyimpan pengguna.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPasswordDefault(user: AdminUserRecord) {
    const token = session?.token;
    if (!token) {
      setFeedback({ type: "error", text: "Anda harus login ulang untuk mengakses fungsi ini." });
      return;
    }
    const confirmed = window.confirm(
      `Reset password pengguna ${user.fullName} (${user.username}) ke password BARU RANDOM unik?\n\nPassword TIDAK ADA yang sama untuk setiap akun. Sistem akan membuat password baru dan menampilkannya setelah reset BERHASIL. Simpan password tersebut dan beritahukan ke pengguna agar login lalu ganti password sendiri.`,
    );
    if (!confirmed) return;
    setResettingUserId(user.id);
    setFeedback(null);
    try {
      const result = await resetPasswordDefaultAdminRequest(token, user.id);
      void loadData();
      setResetPasswordFeedback({
        userName: result.user.fullName,
        npsnUsername: result.user.username,
        newPassword: result.newPassword,
      });
      setFeedback({
        type: "success",
        text: "Password DEFAULT telah di-reset. Harap beritahukan username (NPSN) & password baru ke sekolah yang bersangkutan.",
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal reset password ke default.",
      });
    } finally {
      setResettingUserId(null);
    }
  }

  function togglePasswordVisibleUser(userId: string) {
    setPasswordVisibleUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function togglePasswordActiveVisibleUser(userId: string) {
    setPasswordActiveVisibleUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleDelete(user: AdminUserRecord) {
    const confirmed = window.confirm(`Hapus pengguna ${user.fullName} (${user.username})?`);
    if (!confirmed) {
      return;
    }

    setDeletingUserId(user.id);
    setFeedback(null);

    try {
      await deleteAdminUserRequest(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setFeedback({ type: "success", text: "Pengguna berhasil dihapus." });

      if (editingUserId === user.id) {
        closeForm();
      }
    } catch (deleteError) {
      setFeedback({
        type: "error",
        text: deleteError instanceof Error ? deleteError.message : "Gagal menghapus pengguna.",
      });
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleToggleActive(user: AdminUserRecord) {
    const nextActive = !user.isActive;
    const confirmText = nextActive
      ? `Aktifkan pengguna ${user.fullName} (${user.username})? Pengguna dapat login kembali setelah diaktifkan.`
      : `Nonaktifkan pengguna ${user.fullName} (${user.username})?\n\nJika role SEKOLAH, saat login sekolah akan melihat pesan:\n"Maaf, sementara website ditutup dan akan dibuka lagi pada Senin, 31 Agustus Pukul 09.00 WIB."`;
    if (!window.confirm(confirmText)) return;
    setTogglingActiveUserId(user.id);
    setFeedback(null);
    try {
      const payload: AdminUserInput = {
        username: user.username,
        fullName: user.fullName,
        roleCode: user.roleCode,
        schoolId: user.schoolId ?? null,
        isActive: nextActive,
        email: user.email ?? null,
      };
      const saved = await updateAdminUserRequest(user.id, payload);
      void loadData();
      setFeedback({
        type: "success",
        text: nextActive
          ? `Pengguna ${user.username} berhasil diaktifkan.`
          : `Pengguna ${user.username} berhasil dinonaktifkan.`,
      });
      void saved;
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal mengubah status aktif pengguna.",
      });
    } finally {
      setTogglingActiveUserId(null);
    }
  }

  async function handleBulkSetAktiveSekolah(toActive: boolean) {
    const token = session?.token;
    if (!token) {
      setFeedback({ type: "error", text: "Anda harus login ulang untuk mengakses fungsi ini." });
      return;
    }
    const totalTarget = users.filter((u) => u.roleCode === "SEKOLAH" && (toActive ? !u.isActive : u.isActive)).length;
    if (totalTarget <= 0) {
      setFeedback({
        type: "error",
        text: toActive
          ? "Tidak ada akun Sekolah SMK (ABT) yang berstatus Nonaktif untuk di-ON-kan."
          : "Tidak ada akun Sekolah SMK (ABT) yang berstatus Aktif untuk di-OFF-kan.",
      });
      return;
    }
    const confirm = window.confirm(
      toActive
        ? `AKTIFKAN SEMUA (${totalTarget}) Akun Sekolah SMK (ABT)?\n\nSemua akun sekolah yang berstatus OFF akan di-setel ke ON (bisa login). Lanjutkan?`
        : `⚠️ NONAKTIFKAN SEMUA (${totalTarget}) Akun Sekolah SMK (ABT)?\n\nSemua akun sekolah ABT yang saat ini AKTIF akan di-setel OFF (tidak bisa login).\n\nSaat login, sekolah akan melihat pesan:\n"Maaf, sementara website ditutup dan akan dibuka lagi pada Senin, 31 Agustus Pukul 09.00 WIB."\n\nLANJUTKAN?`,
    );
    if (!confirm) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await bulkSekolahSetActiveRequest(token, "SEKOLAH", toActive);
      void loadData();
      setFeedback({
        type: "success",
        text: toActive
          ? `✅ Berhasil AKTIFKAN SEMUA: Ditemukan ${result.totalFound} akun, berubah status = ${result.totalChanged}.`
          : `⛔ Berhasil NONAKTIFKAN SEMUA: Ditemukan ${result.totalFound} akun, berubah status = ${result.totalChanged}. Sekolah tidak dapat login sampai 27 Agustus 2026 23.59 WIB.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Gagal bulk set status aktif semua akun sekolah.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const sekolahNpsnSudahPunyaAkun = useMemo(() => {
    const npsnMap = new Map<string, AdminUserRecord>();
    for (const u of users) {
      if (u.roleCode === "SEKOLAH") {
        const match = schools.find((s) => s.id === u.schoolId);
        if (match?.npsn) npsnMap.set(match.npsn, u);
      }
    }
    return npsnMap;
  }, [users, schools]);

  const sekolahById = useMemo(() => {
    const map = new Map<string, AdminSchoolOption>();
    for (const s of schools) map.set(s.id, s);
    return map;
  }, [schools]);

  function prepareBulkRows() {
    const token = session?.token;
    if (!token || !activeTabDef.isSekolahSource) return;
    if (generatedRows.length > 0 && !creatingBulk) {
      return;
    }
    const rows: GeneratedAkunSekolah[] = [];
    let no = 0;
    for (const raw of sourceSekolahRows) {
      const npsn = pickSchoolNpsn(raw);
      const nama = normalizeText(
        raw.nama_sekolah ?? raw["NAMA SMK"] ?? raw["nama"] ?? raw["name"] ?? raw["school_name"] ?? raw["Nama Sekolah"],
      );
      if (!npsn && !nama) continue;
      no += 1;
      const provinsi = normalizeText(
        raw.provinsi ??
          raw["Provinsi"] ??
          raw.province ??
          raw["Province"] ??
          raw["PROPINSI"] ??
          raw["propinsi"] ??
          raw["Prov"] ??
          raw["PROV"],
      );
      const kabKota = normalizeText(
        raw.kab_kota ??
          raw["Kab/Kota"] ??
          raw["Kabupaten"] ??
          raw["KABUPATEN"] ??
          raw["Kota"] ??
          raw["KOTA"] ??
          raw.city ??
          raw["City"] ??
          raw["kabupaten_kota"] ??
          raw["Kabupaten/Kota"],
      );
      const existing = sekolahNpsnSudahPunyaAkun.get(npsn);
      const username = npsn || `sekolah-${Date.now().toString(36).slice(2, 7)}-${no}`;
      rows.push({
        no,
        npsn,
        nama: nama || "-",
        provinsi,
        kabKota,
        username,
        password: generateSecurePassword(),
        status: existing ? "DUPLICATE" : "PENDING",
        userId: existing?.id,
        error: existing ? "Akun SEKOLAH dengan NPSN tersebut sudah pernah dibuat. Klik Reset Password untuk password baru." : undefined,
      });
    }
    setGeneratedRows(rows);
  }

  function togglePasswordVisibility(no: number) {
    const next = new Set(passwordVisibleRows);
    if (next.has(no)) {
      next.delete(no);
    } else {
      next.add(no);
    }
    setPasswordVisibleRows(next);
  }

  function updateGeneratedRowByNo(no: number, patch: Partial<GeneratedAkunSekolah>) {
    setGeneratedRows((prev) => prev.map((r) => (r.no === no ? { ...r, ...patch } : r)));
  }

  async function createAkunSekolahPerRow(row: GeneratedAkunSekolah) {
    if (!session?.token) return;
    if (row.status !== "PENDING") return;
    try {
      setCreatingRowNo(row.no);
      setFeedback(null);
      const input: AdminUserInput = {
        username: row.username,
        fullName: row.nama,
        roleCode: "SEKOLAH",
        schoolId: null,
        password: row.password,
        isActive: true,
      };
      const created = await createAdminUserRequest(input);
      updateGeneratedRowByNo(row.no, {
        userId: created.id,
        status: "BERHASIL",
        error: undefined,
      });
      setFeedback({ type: "success", text: `Akun ${row.npsn} berhasil dibuat.` });
      await loadData();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Gagal simpan ke database";
      updateGeneratedRowByNo(row.no, {
        status: "PENDING",
        error: errorMsg,
      });
      setFeedback({ type: "error", text: `Gagal buat akun NPSN ${row.npsn}: ${errorMsg}` });
    } finally {
      setCreatingRowNo(null);
    }
  }

  async function resetPasswordAkunSekolah(row: GeneratedAkunSekolah) {
    if (!session?.token || !row.userId) {
      const newPwd = generateSecurePassword();
      updateGeneratedRowByNo(row.no, { password: newPwd, error: undefined });
      return;
    }
    const targetUser = users.find((u) => u.id === row.userId);
    if (!targetUser) {
      setFeedback({ type: "error", text: "User tidak ditemukan di database." });
      return;
    }
    try {
      setResettingRowNo(row.no);
      setFeedback(null);
      const newPassword = generateSecurePassword();
      await updateAdminUserRequest(row.userId, {
        username: targetUser.username,
        fullName: targetUser.fullName,
        roleCode: targetUser.roleCode,
        schoolId: targetUser.schoolId ?? null,
        isActive: targetUser.isActive,
        password: newPassword,
      });
      updateGeneratedRowByNo(row.no, {
        password: newPassword,
        status: "BERHASIL",
        error: "Password berhasil di-reset, simpan password baru ini untuk sekolah.",
      });
      setFeedback({ type: "success", text: `Password NPSN ${row.npsn} berhasil di-reset. Jangan lupa simpan password baru!` });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Gagal reset password";
      updateGeneratedRowByNo(row.no, { error: errorMsg });
      setFeedback({ type: "error", text: `Gagal reset password: ${errorMsg}` });
    } finally {
      setResettingRowNo(null);
    }
  }

  function openEditAkunSekolah(row: GeneratedAkunSekolah) {
    if (!row.userId) return;
    const target = users.find((u) => u.id === row.userId);
    if (!target) {
      setFeedback({ type: "error", text: "User tidak ditemukan di database." });
      return;
    }
    openEditForm(target);
  }

  async function hapusAkunSekolah(row: GeneratedAkunSekolah) {
    if (!row.userId) {
      // cuma hapus dari list prepared (hapus row? Atau set PENDING?)
      if (!window.confirm(`Hapus persiapan akun NPSN ${row.npsn} dari daftar?`)) return;
      setGeneratedRows((prev) => prev.filter((r) => r.no !== row.no));
      return;
    }
    if (!window.confirm(
      `Hapus akun SEKOLAH ${row.npsn} "${row.nama}"? Data sekolah di schools table TIDAK akan dihapus, hanya user login. Nanti bisa dibuat ulang akunnya kapan saja.`,
    )) {
      return;
    }
    try {
      setDeletingRowNo(row.no);
      setFeedback(null);
      await deleteAdminUserRequest(row.userId);
      updateGeneratedRowByNo(row.no, {
        userId: undefined,
        status: "PENDING",
        password: generateSecurePassword(),
        error: "Akun sebelumnya dihapus, siap dibuat ulang.",
      });
      setFeedback({ type: "success", text: `Akun ${row.npsn} dihapus. Dapat dibuat ulang kapan saja.` });
      await loadData();
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Gagal hapus akun";
      updateGeneratedRowByNo(row.no, { error: errorMsg });
      setFeedback({ type: "error", text: `Gagal hapus: ${errorMsg}` });
    } finally {
      setDeletingRowNo(null);
    }
  }

  async function handleBulkCreateAkunSekolah() {
    if (!session?.token || generatedRows.length === 0) return;
    if (!window.confirm(
      "Buat akun sekolah secara massal? Username diambil dari NPSN masing-masing, password dibuat acak. Tunggu sampai proses selesai (131 rows membutuhkan waktu).",
    )) {
      return;
    }
    setCreatingBulk(true);
    setBulkProgressText("Memproses...");
    setFeedback(null);
    let success = 0;
    let failed = 0;
    let duplicate = 0;
    const next: GeneratedAkunSekolah[] = structuredClone(generatedRows);
    for (let i = 0; i < next.length; i += 1) {
      const row = next[i]!;
      if (row.status === "DUPLICATE") {
        duplicate += 1;
        setBulkProgressText(`Progress ${i + 1}/${next.length} (SUKSES=${success} | GAGAL=${failed} | DUPLIKAT=${duplicate})`);
        continue;
      }
      try {
        const input: AdminUserInput = {
          username: row.username,
          fullName: row.nama,
          roleCode: "SEKOLAH",
          schoolId: null,
          password: row.password,
          isActive: true,
        };
        const created = await createAdminUserRequest(input);
        row.userId = created.id;
        row.status = "BERHASIL";
        success += 1;
      } catch (e) {
        failed += 1;
        row.status = "PENDING";
        row.error = e instanceof Error ? e.message : "Gagal simpan ke database";
      } finally {
        setBulkProgressText(`Progress ${i + 1}/${next.length} (SUKSES=${success} | GAGAL=${failed} | DUPLIKAT=${duplicate})`);
      }
    }
    setGeneratedRows(next);
    setCreatingBulk(false);
    setFeedback({
      type: failed > 0 ? "error" : "success",
      text: `Bulk create SELESAI: SUKSES=${success} | GAGAL=${failed} | DUPLICATE=${duplicate}. Segera download TSV di bawah (username+password) untuk dikirim ke sekolah.`,
    });
    await loadData();
  }

  const totalBulkPending = generatedRows.filter((r) => r.status === "PENDING").length;
  const totalBulkBerhasil = generatedRows.filter((r) => r.status === "BERHASIL").length;
  const totalBulkDuplikat = generatedRows.filter((r) => r.status === "DUPLICATE").length;

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <label className="grid gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Cari Pengguna</span>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari username, nama, role, atau sekolah..."
                className="max-w-xl"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={openCreateForm}>
              <UserPlus className="h-4 w-4" />
              Tambah Pengguna
            </Button>
            {activeTab === "SEKOLAH_ABT" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => triggerCsvDownloadAkunSekolahAktif(filteredUsers)}
                disabled={filteredUsers.length === 0}
                className="border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900"
              >
                <Download className="h-4 w-4" />
                Download NPSN, Nama &amp; Password Aktif
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="secondary">{countStats.total} Total Pengguna</Badge>
          <Badge variant="secondary">{countStats.admin} Admin</Badge>
          <Badge variant="secondary">{countStats.fasilitatorAdministrasi} Fasilitator Adm</Badge>
          <Badge variant="secondary">{countStats.fasilitatorAlat} Fasilitator Alat</Badge>
          <Badge variant="secondary">{countStats.sekolah} Akun Sekolah</Badge>
          {activeTabDef.isSekolahSource ? (
            <Badge variant="outline">{countStats.sourceAbt} Sekolah di Sumber {activeTabDef.isSekolahSource === "abt" ? "ABT" : "Reguler"}</Badge>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {USER_TABS.map((tab) => {
          const active = tab.key === activeTab;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setGeneratedRows([]);
                setFeedback(null);
              }}
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
          {activeTabDef.label}
        </p>
        <p className="mt-2 leading-6">
          {activeTabDef.hint}
        </p>
        {creatingBulk ? (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            <span className="text-sm text-emerald-800">{bulkProgressText}</span>
          </div>
        ) : null}
      </div>

      {isFormOpen ? (
        <div className="rounded-[24px] border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/70">Form Pengguna</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">
                {editingUserId ? "Edit Pengguna" : "Tambah Pengguna Baru"}
              </h3>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={closeForm}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {feedback ? (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-danger/15 bg-danger/[0.08] text-danger"
              }`}
            >
              {feedback.text}
            </div>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Username</span>
              <Input value={form.username} onChange={(event) => updateForm("username", event.target.value)} />
            </label>

            <label className="grid gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Nama Lengkap</span>
              <Input value={form.fullName} onChange={(event) => updateForm("fullName", event.target.value)} />
            </label>

            <label className="grid gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Role</span>
              <select
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary"
                value={form.roleCode}
                onChange={(event) => updateForm("roleCode", event.target.value)}
              >
                {roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">
                {editingUserId ? "Password Baru (opsional)" : "Password"}
              </span>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => updateForm("password", event.target.value)}
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Email (opsional)</span>
              <Input
                type="email"
                autoComplete="email"
                placeholder="nama@sekolah.sch.id"
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-600">
              <span className="font-medium text-slate-900">Status</span>
              <select
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary"
                value={form.isActive ? "ACTIVE" : "INACTIVE"}
                onChange={(event) => updateForm("isActive", event.target.value === "ACTIVE")}
              >
                <option value="ACTIVE">Aktif</option>
                <option value="INACTIVE">Nonaktif</option>
              </select>
            </label>

            {form.roleCode === "SEKOLAH" ? (
              <label className="grid gap-2 text-sm text-slate-600 md:col-span-2">
                <span className="font-medium text-slate-900">Sekolah</span>
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary"
                  value={form.schoolId}
                  onChange={(event) => updateForm("schoolId", event.target.value)}
                >
                  <option value="">Pilih sekolah</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name} | {school.npsn}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {editingUserId ? "Simpan Perubahan" : "Simpan Pengguna"}
            </Button>
            <Button type="button" variant="outline" onClick={closeForm} disabled={submitting}>
              Batal
            </Button>
          </div>
        </div>
      ) : feedback ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-danger/15 bg-danger/[0.08] text-danger"
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {activeTabDef.isSekolahSource && activeTab !== "SEKOLAH_ABT" ? (
        generatedRows.length > 0 ? (
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
              <h3 className="text-lg font-semibold text-slate-950">
                Daftar Akun Sekolah {activeTabDef.isSekolahSource === "abt" ? "ABT" : "Reguler"}
              </h3>
              <div className="ml-auto flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">{generatedRows.length} Total</Badge>
                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">{totalBulkBerhasil} Berhasil</Badge>
                <Badge variant="secondary" className="bg-amber-50 text-amber-700">{totalBulkDuplikat} Sudah Ada</Badge>
                <Badge variant="secondary" className="bg-sky-50 text-sky-700">{totalBulkPending} Pending</Badge>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[1600px]">
                <div className="grid grid-cols-[70px_140px_minmax(260px,1.2fr)_180px_180px_180px_280px_140px_200px_340px] gap-3 border-b border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <span>No</span>
                  <span>NPSN</span>
                  <span>Nama Sekolah</span>
                  <span>Provinsi</span>
                  <span>Kab/Kota</span>
                  <span>Username</span>
                  <span>Password</span>
                  <span>Status</span>
                  <span>Catatan</span>
                  <span>Aksi</span>
                </div>
                <div className="divide-y divide-slate-200 max-h-[620px] overflow-y-auto">
                  {generatedRows.map((row) => {
                    const isPwdVisible = passwordVisibleRows.has(row.no);
                    return (
                      <div
                        key={`${row.npsn}-${row.no}`}
                        className="grid grid-cols-[70px_140px_minmax(260px,1.2fr)_180px_180px_180px_280px_140px_200px_340px] gap-3 px-5 py-3 text-sm items-center"
                      >
                        <div className="font-mono text-slate-500">{row.no}</div>
                        <div className="font-semibold text-slate-900">{row.npsn || "-"}</div>
                        <div className="text-slate-800">{row.nama}</div>
                        <div className="text-slate-600">{row.provinsi || "-"}</div>
                        <div className="text-slate-600">{row.kabKota || "-"}</div>
                        <div className="font-mono text-primary-900 select-all">{row.username}</div>
                        <div>
                          <div className="flex items-center gap-2 w-full">
                            <div className="font-mono text-slate-800 select-all flex-1 truncate">
                              {row.password && isPwdVisible
                                ? row.password
                                : row.password
                                  ? "•".repeat(row.password.length)
                                  : "-"}
                            </div>
                            {row.password ? (
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibility(row.no)}
                                title={isPwdVisible ? "Sembunyikan password" : "Lihat password (copy paste)"}
                                className="shrink-0 rounded-md border border-slate-200 p-1.5 text-slate-500 hover:text-primary hover:border-primary/40 transition"
                              >
                                {isPwdVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div>
                          <Badge
                            variant="secondary"
                            className={
                              row.status === "BERHASIL"
                                ? "bg-emerald-50 text-emerald-700"
                                : row.status === "DUPLICATE"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-sky-50 text-sky-700 border-sky-200"
                            }
                          >
                            {row.status === "BERHASIL"
                              ? "Sudah Dibuat"
                              : row.status === "DUPLICATE"
                                ? "Sudah Ada Akun"
                                : "Siap Dibuat"}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-500 leading-5 max-w-[200px] truncate" title={row.error ?? "-"}>
                          {row.error ?? "-"}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {row.status === "PENDING" ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void createAkunSekolahPerRow(row)}
                              disabled={creatingRowNo === row.no || creatingBulk}
                            >
                              {creatingRowNo === row.no ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserPlus className="h-4 w-4" />
                              )}
                              Buat Akun
                            </Button>
                          ) : (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => openEditAkunSekolah(row)}
                                disabled={!row.userId}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void resetPasswordAkunSekolah(row)}
                                disabled={resettingRowNo === row.no || creatingBulk}
                                className="text-violet-700 border-violet-200 hover:bg-violet-50"
                              >
                                {resettingRowNo === row.no ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <KeyRound className="h-4 w-4" />
                                )}
                                Reset Password
                              </Button>
                            </>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void hapusAkunSekolah(row)}
                            disabled={deletingRowNo === row.no || creatingBulk}
                            className="text-slate-500 hover:text-danger"
                          >
                            {deletingRowNo === row.no ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Hapus
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[24px] border border-dashed border-primary/30 bg-primary/[0.04] p-5 text-sm text-slate-600">
            <p className="font-semibold text-primary">
              {activeTabDef.label} — Sumber Data Sekolah {activeTabDef.isSekolahSource === "abt" ? "ABT" : "Reguler"}
            </p>
            <p className="mt-2 leading-6">
              Tab ini memuat <strong>{sourceSekolahRows.length}</strong> sekolah dari database sumber.
              Klik tombol <strong>Buat Akun Semua (Bulk)</strong> di atas untuk membuat akun SEKOLAH sekaligus:
              Username = NPSN sekolah; Password dibuat acak aman (16 karakter, campur huruf besar/kecil, angka, simbol).
              Setelah selesai, Download TSV untuk mendapatkan list username + password setiap sekolah.
            </p>
            {loadingSource ? (
              <div className="mt-3 flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Memuat sumber data sekolah...</span>
              </div>
            ) : null}
          </div>
        )
      ) : null}

      {resetPasswordFeedback ? (
        <dialog
          open
          className="backdrop:bg-slate-900/40 rounded-[24px] border border-emerald-200 bg-white p-0 shadow-2xl w-[92vw] max-w-[540px]"
        >
          <form method="dialog" className="space-y-0">
            <div className="flex items-center justify-between gap-3 border-b border-emerald-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Reset Password Berhasil</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">Password Default Baru</h3>
              </div>
              <button
                type="submit"
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                onClick={() => setResetPasswordFeedback(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Sekolah</p>
                <p className="mt-1 font-semibold text-slate-900">{resetPasswordFeedback.userName}</p>
                <p className="mt-0.5 text-sm text-slate-600">Username (NPSN): <span className="font-mono font-semibold text-slate-900 select-all">{resetPasswordFeedback.npsnUsername}</span></p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 mb-2">
                  Password Default Baru (Copy & Simpan Baik-Baik)
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="flex-1 font-mono text-lg font-bold text-primary-900 select-all break-all">
                    {resetPasswordFeedback.newPassword}
                  </p>
                </div>
                <p className="mt-2 text-xs text-slate-500 leading-5">
                  Segera beritahukan username (NPSN) &amp; password default ini ke sekolah yang bersangkutan melalui WA / email resmi.
                  Sekolah HARUS mengganti password saat login pertama kali.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button
                type="submit"
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition"
                onClick={() => setResetPasswordFeedback(null)}
              >
                Tutup &amp; Simpan
              </button>
            </div>
          </form>
        </dialog>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-3 rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat data pengguna...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-danger/15 bg-danger/[0.08] px-4 py-3 text-sm text-danger">{error}</div>
      ) : activeTab === "SEKOLAH_ABT" ? (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-gradient-to-r from-indigo-50 via-white to-indigo-50 px-5 py-4">
            <div className="flex-1 min-w-[220px]">
              <h3 className="text-lg font-semibold text-slate-950">
                Daftar Akun Sekolah SMK (ABT)
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Total {filteredUsers.length} akun sekolah. Gunakan toggle Aksi untuk mengaktifkan / menonaktifkan satu per satu, atau gunakan tombol massal di bawah.
              </p>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{users.filter((u) => u.roleCode === "SEKOLAH" && u.isActive).length} ON · Aktif</Badge>
              <Badge variant="secondary" className="bg-slate-50 text-slate-700 border-slate-200">
                {users.filter((u) => u.roleCode === "SEKOLAH" && !u.isActive).length} OFF · Nonaktif
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-white px-5 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleBulkSetAktiveSekolah(false)}
              disabled={submitting || users.filter((u) => u.roleCode === "SEKOLAH" && u.isActive).length === 0}
              className="border-rose-400 bg-rose-50 text-rose-800 hover:bg-rose-100 hover:text-rose-900 shadow-sm"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PowerOff className="h-4 w-4" />
              )}
              ⛔ Nonaktifkan SEMUA Akun Sekolah SMK (ABT)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleBulkSetAktiveSekolah(true)}
              disabled={submitting || users.filter((u) => u.roleCode === "SEKOLAH" && !u.isActive).length === 0}
              className="border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 shadow-sm"
            >
              <Power className="h-4 w-4" />
              ✅ Aktifkan SEMUA Akun Sekolah SMK (ABT)
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter NPSN / Nama Sekolah..."
                className="w-[280px]"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void loadData()}
                disabled={loading}
                className="text-slate-500 hover:text-primary"
                title="Refresh daftar pengguna"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[1720px]">
              <div className="grid grid-cols-[70px_140px_minmax(260px,1.2fr)_240px_240px_minmax(240px,1.1fr)_280px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>No</span>
                <span>NPSN</span>
                <span>Nama Sekolah</span>
                <span>Password Default</span>
                <span>Password Aktif</span>
                <span>Email</span>
                <span>Aksi</span>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredUsers.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-600">Belum ada pengguna sekolah ABT yang cocok. Gunakan Bulk Create di atas atau Tambah Pengguna.</div>
                ) : (
                  filteredUsers.map((user, index) => {
                    const isPwdVisible = passwordVisibleUserIds.has(user.id);
                    const isPwdActiveVisible = passwordActiveVisibleUserIds.has(user.id);
                    const pwdDefault = user.passwordDefault ?? "—";
                    const pwdCurrent = user.passwordCurrent;
                    const sudahDiganti = !user.mustChangePassword;
                    return (
                      <div
                        key={user.id}
                        className="grid grid-cols-[70px_140px_minmax(260px,1.2fr)_240px_240px_minmax(240px,1.1fr)_280px] gap-3 px-5 py-4 text-sm items-center"
                      >
                        <div>
                          <p className="font-mono font-semibold text-slate-500">{index + 1}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 font-mono">{user.username}</p>
                          {!user.isActive ? <p className="text-xs text-slate-400 mt-0.5">Nonaktif</p> : null}
                        </div>
                        <div className="font-medium text-slate-900 leading-6">
                          {user.fullName}
                          {sudahDiganti ? (
                            <div className="mt-1">
                              <Badge
                                variant="secondary"
                                className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                              >
                                Sudah Diganti
                              </Badge>
                            </div>
                          ) : (
                            <div className="mt-1">
                              <Badge
                                variant="secondary"
                                className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                              >
                                Masih Default
                              </Badge>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 w-full">
                            <div className="font-mono text-slate-800 select-all flex-1 truncate" title={isPwdVisible ? pwdDefault : ""}>
                              {isPwdVisible
                                ? <span className="text-primary-900 font-bold break-all">{pwdDefault}</span>
                                : <span className="tracking-[0.25em] text-slate-700">{"•".repeat(Math.min(pwdDefault.length, 10))}</span>
                              }
                            </div>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibleUser(user.id)}
                              title={isPwdVisible ? "Sembunyikan password default" : "Lihat password default"}
                              className="shrink-0 rounded-md border border-slate-200 p-1.5 text-slate-500 hover:text-primary hover:border-primary/40 transition"
                            >
                              {isPwdVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <div>
                          {pwdCurrent ? (
                            <div className="flex items-center gap-2 w-full">
                              <div className="font-mono text-slate-800 select-all flex-1 truncate" title={isPwdActiveVisible ? pwdCurrent : ""}>
                                {isPwdActiveVisible
                                  ? <span className="text-emerald-800 font-bold break-all">{pwdCurrent}</span>
                                  : <span className="tracking-[0.25em] text-slate-700">{"•".repeat(Math.min(pwdCurrent.length, 10))}</span>
                                }
                              </div>
                              <button
                                type="button"
                                onClick={() => togglePasswordActiveVisibleUser(user.id)}
                                title={isPwdActiveVisible ? "Sembunyikan password aktif" : "Lihat password aktif (password pengganti)"}
                                className="shrink-0 rounded-md border border-emerald-200 p-1.5 text-emerald-700 hover:text-emerald-800 hover:border-emerald-400 transition"
                              >
                                {isPwdActiveVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic leading-5">
                              {sudahDiganti
                                ? <>Perlu update ganti pwd ulang</>
                                : <>Belum ada</>
                              }
                            </div>
                          )}
                        </div>
                        <div className="text-slate-700 leading-5 break-all">
                          {user.email ? (
                            <span className="text-primary-900">{user.email}</span>
                          ) : (
                            <span className="text-slate-400 italic">Belum diisi</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={user.isActive}
                            onClick={() => void handleToggleActive(user)}
                            disabled={togglingActiveUserId === user.id}
                            className={`group relative inline-flex h-7 w-20 shrink-0 items-center rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-300 disabled:opacity-60 ${
                              user.isActive
                                ? "bg-emerald-600 border-emerald-700 shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"
                                : "bg-slate-200 border-slate-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]"
                            }`}
                          >
                            <span
                              className={`absolute top-0 h-full w-10 flex items-center justify-center text-[10px] font-bold tracking-widest transition-opacity ${
                                user.isActive ? "left-0 text-emerald-50 opacity-90" : "left-0 text-slate-400 opacity-0"
                              }`}
                            >
                              ON
                            </span>
                            <span
                              className={`absolute top-0 h-full w-10 flex items-center justify-center text-[10px] font-bold tracking-widest transition-opacity ${
                                user.isActive
                                  ? "right-0 text-emerald-50 opacity-0"
                                  : "right-0 text-slate-500 opacity-90"
                              }`}
                            >
                              OFF
                            </span>
                            <span
                              className={`pointer-events-none inline-flex h-6 w-6 transform items-center justify-center rounded-full border bg-white shadow-md transition-all duration-200 ${
                                togglingActiveUserId === user.id ? "animate-pulse" : ""
                              } ${
                                user.isActive
                                  ? "translate-x-[calc(100%-2px)] border-emerald-200 text-emerald-700"
                                  : "translate-x-0 border-slate-200 text-slate-400"
                              }`}
                            >
                              {togglingActiveUserId === user.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : user.isActive ? (
                                <BadgeCheck className="h-3.5 w-3.5" />
                              ) : (
                                <ShieldAlert className="h-3.5 w-3.5" />
                              )}
                            </span>
                          </button>
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                              user.isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-500 border-slate-200"
                            }`}
                          >
                            {user.isActive ? "Aktif" : "Tidak Aktif"}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleResetPasswordDefault(user)}
                            disabled={resettingUserId === user.id}
                            className="text-violet-700 border-violet-200 hover:bg-violet-50"
                          >
                            {resettingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                            Reset
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleDelete(user)}
                            disabled={deletingUserId === user.id}
                            className="text-slate-500 hover:text-danger"
                          >
                            {deletingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Hapus
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[1560px]">
              <div className="grid grid-cols-[220px_minmax(220px,1fr)_200px_minmax(220px,1fr)_120px_220px_220px_180px_180px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <span>Username</span>
                <span>Nama Lengkap</span>
                <span>Role</span>
                <span>Sekolah</span>
                <span>Status</span>
                <span>Password Default</span>
                <span>Password Aktif</span>
                <span>Dibuat</span>
                <span>Aksi</span>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredUsers.length === 0 ? (
                  <div className="px-5 py-6 text-sm text-slate-600">Belum ada pengguna yang cocok untuk tab ini.</div>
                ) : (
                  filteredUsers.map((user) => {
                    const isPwdVisible = passwordVisibleUserIds.has(user.id);
                    const isPwdActiveVisible = passwordActiveVisibleUserIds.has(user.id);
                    const pwdDefault = user.passwordDefault ?? "—";
                    const pwdCurrent = user.passwordCurrent;
                    return (
                      <div
                        key={user.id}
                        className="grid grid-cols-[220px_minmax(220px,1fr)_200px_minmax(220px,1fr)_120px_220px_220px_180px_180px] gap-3 px-5 py-4 text-sm items-center"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{user.username}</p>
                        </div>
                        <div className="font-medium text-slate-900">{user.fullName}</div>
                        <div className="text-slate-700">{user.roleName}</div>
                        <div className="text-slate-700">{user.schoolName ?? "-"}</div>
                        <div>
                          <Badge variant={user.isActive ? "secondary" : "outline"}>
                            {user.isActive ? "Aktif" : "Nonaktif"}
                          </Badge>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 w-full">
                            <div className="font-mono text-slate-800 select-all flex-1 truncate" title={isPwdVisible ? pwdDefault : ""}>
                              {isPwdVisible
                                ? <span className="text-primary-900 font-bold break-all">{pwdDefault}</span>
                                : <span className="tracking-[0.25em] text-slate-700">{"•".repeat(Math.min(pwdDefault.length, 10))}</span>
                              }
                            </div>
                            {user.passwordDefault ? (
                              <button
                                type="button"
                                onClick={() => togglePasswordVisibleUser(user.id)}
                                title={isPwdVisible ? "Sembunyikan password default" : "Lihat password default"}
                                className="shrink-0 rounded-md border border-slate-200 p-1.5 text-slate-500 hover:text-primary hover:border-primary/40 transition"
                              >
                                {isPwdVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div>
                          {pwdCurrent ? (
                            <div className="flex items-center gap-2 w-full">
                              <div className="font-mono text-slate-800 select-all flex-1 truncate" title={isPwdActiveVisible ? pwdCurrent : ""}>
                                {isPwdActiveVisible
                                  ? <span className="text-emerald-800 font-bold break-all">{pwdCurrent}</span>
                                  : <span className="tracking-[0.25em] text-slate-700">{"•".repeat(Math.min(pwdCurrent.length, 10))}</span>
                                }
                              </div>
                              <button
                                type="button"
                                onClick={() => togglePasswordActiveVisibleUser(user.id)}
                                title={isPwdActiveVisible ? "Sembunyikan password aktif" : "Lihat password aktif (password pengganti)"}
                                className="shrink-0 rounded-md border border-emerald-200 p-1.5 text-emerald-700 hover:text-emerald-800 hover:border-emerald-400 transition"
                              >
                                {isPwdActiveVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic">
                              Belum ada
                            </div>
                          )}
                        </div>
                        <div className="text-slate-600">{formatDate(user.createdAt)}</div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={user.isActive ? "outline" : "default"}
                            onClick={() => void handleToggleActive(user)}
                            disabled={togglingActiveUserId === user.id}
                            className={
                              user.isActive
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                : "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-700"
                            }
                          >
                            {togglingActiveUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : user.isActive ? (
                              <ShieldAlert className="h-4 w-4" />
                            ) : (
                              <BadgeCheck className="h-4 w-4" />
                            )}
                            {user.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => openEditForm(user)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void handleDelete(user)}
                            disabled={deletingUserId === user.id}
                            className="text-slate-500 hover:text-danger"
                          >
                            {deletingUserId === user.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Hapus
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
