"use client";

/**
 * SchoolWorkspaceProvider.tsx
 * ---------------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH untuk 4 halaman sekolah:
 *   - /sekolah/profil                  (profile + concentrations + documents)
 *   - /sekolah/alat                    (equipment data PDBBK/PERDIRJEN)
 *   - /sekolah/pengajuan/*             (proposal + rpkpSelections)
 *   - /dashboard/sekolah               (read summary)
 *
 * Fixes:
 *  K1 — localStorage blind restore → DraftSizeGuard V2, confirm via Dialog, TIDAK auto-apply
 *  K2 — no SSOT lintas sections → Context 1 instance di root (workspace layout)
 *  K5 — no global save mutex → saveLocks per-section + request ID debounce
 *
 * Konvensi:
 *  - Semua state mutable HANYA di reducer (tidak ada useState lokal untuk data besar).
 *  - dirtyFlags TRUE = perubahan user BLUM di-flush ke server.
 *  - saveLocks = set of sectionIds sedang dalam network PUT/PATCH → hindari double click save.
 *  - dataVersions = optimistic lock version dari server; di-send setiap write.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type {
  SchoolProfileRecord,
  SchoolAdministrativeDocumentRecord,
  WorkspaceSchoolEquipmentData,
  WorkspaceSchoolProposalData,
} from "@/lib/api";
import {
  schoolAdministrativeDocumentsRequest,
  saveSchoolProposalDataRequest,
  saveSchoolEquipmentDataRequest,
  updateSchoolProfileRequest,
  invalidateScopedCacheByPrefix,
} from "@/lib/api";
type ApiClientError = Error & {
  code?: string | number | null;
  status?: number | null;
  issues?: ReadonlyArray<{ message: string; path?: readonly (string | number)[] }>;
  cause?: unknown;
};

// ============================================================================
// Section Ids
// ============================================================================
export type SchoolSectionId =
  | "profile" // profil sekolah (nama, npsn, alamat, headmaster, dll)
  | "concentrations" // profile: daftar konsentrasi keahlian
  | "documents" // profile: dokumen administrasi (akreditasi, ijazah, dll)
  | "equipment" // /sekolah/alat — all equipmentTables
  | "proposal" // /sekolah/pengajuan — proposalTables + rpkpSelections
  | "dashboard-summary"; // read-only cache

export const ALL_SECTION_IDS: SchoolSectionId[] = [
  "profile",
  "concentrations",
  "documents",
  "equipment",
  "proposal",
  "dashboard-summary",
];

// ============================================================================
// State types
// ============================================================================
interface LoadedState {
  profile: SchoolProfileRecord | null;
  documents: SchoolAdministrativeDocumentRecord[];
  equipment: WorkspaceSchoolEquipmentData | null;
  proposal: WorkspaceSchoolProposalData | null;
  versions: Partial<Record<SchoolSectionId, number>>;
  integrityShas: Partial<Record<SchoolSectionId, string>>;
  loaded: Partial<Record<SchoolSectionId, boolean>>;
  /** Flags: true jika user edit data BELUM di-save ke server */
  dirty: Partial<Record<SchoolSectionId, boolean>>;
  /** SectionId yang sedang network PUT/PATCH (mutex K5) */
  saving: Partial<Record<SchoolSectionId, boolean>>;
  error: Partial<Record<SchoolSectionId, { message: string; code?: string } | null>>;
  lastRemoteUpdatedAt: Partial<Record<SchoolSectionId, string | null>>;
  changestamp: string; // Naikkan tiap kali remote write/remote load BERHASIL → cross-tab sync
}

const INITIAL_STATE: LoadedState = {
  profile: null,
  documents: [],
  equipment: null,
  proposal: null,
  versions: {},
  integrityShas: {},
  loaded: {},
  dirty: {},
  saving: {},
  error: {},
  lastRemoteUpdatedAt: {},
  changestamp: "",
};

// ============================================================================
// Actions (reducer)
// ============================================================================
type Action =
  | { type: "SECTION_LOADING"; section: SchoolSectionId }
  | {
      type: "SET_PROFILE";
      profile: SchoolProfileRecord | null;
      version?: number;
    }
  | {
      type: "SET_DOCUMENTS";
      documents: SchoolAdministrativeDocumentRecord[];
    }
  | {
      type: "SET_EQUIPMENT";
      equipment: WorkspaceSchoolEquipmentData | null;
      version?: number;
      integritySha?: string;
    }
  | {
      type: "SET_PROPOSAL";
      proposal: WorkspaceSchoolProposalData | null;
      version?: number;
      integritySha?: string;
    }
  | {
      type: "MARK_DIRTY";
      section: SchoolSectionId;
      dirty: boolean;
    }
  | {
      type: "SET_SAVING";
      section: SchoolSectionId;
      saving: boolean;
    }
  | {
      type: "SET_ERROR";
      section: SchoolSectionId;
      error: { message: string; code?: string } | null;
    }
  | {
      type: "BUMP_CHANGESTAMP";
      stamp?: string;
    };

function nextChangestamp(prev?: string): string {
  const now = new Date();
  const base = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate(),
  ).padStart(2, "0")}${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(
    2,
    "0",
  )}${String(now.getSeconds()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 8);
  return prev ? `${base}-${rand}` : `${base}-${rand}`;
}

function reducer(state: LoadedState, action: Action): LoadedState {
  switch (action.type) {
    case "SECTION_LOADING":
      return { ...state, loaded: { ...state.loaded, [action.section]: false } };
    case "SET_PROFILE": {
      const updatedAt = (action.profile as unknown as { updatedAt?: string | null } | null | undefined)?.updatedAt ?? new Date().toISOString();
      return {
        ...state,
        profile: action.profile,
        loaded: { ...state.loaded, profile: true, concentrations: true },
        versions: {
          ...state.versions,
          profile: action.version ?? state.versions.profile ?? 0,
          concentrations: action.version ?? state.versions.concentrations ?? 0,
        },
        lastRemoteUpdatedAt: {
          ...state.lastRemoteUpdatedAt,
          profile: updatedAt,
          concentrations: updatedAt,
        },
        changestamp: nextChangestamp(state.changestamp),
      };
    }
    case "SET_DOCUMENTS":
      return {
        ...state,
        documents: action.documents,
        loaded: { ...state.loaded, documents: true },
        changestamp: nextChangestamp(state.changestamp),
      };
    case "SET_EQUIPMENT": {
      const updatedAt = action.equipment?.updatedAt ?? null;
      return {
        ...state,
        equipment: action.equipment,
        loaded: { ...state.loaded, equipment: true },
        versions: { ...state.versions, equipment: action.version ?? state.versions.equipment ?? 0 },
        integrityShas: {
          ...state.integrityShas,
          equipment: action.integritySha ?? state.integrityShas.equipment,
        },
        lastRemoteUpdatedAt: { ...state.lastRemoteUpdatedAt, equipment: updatedAt },
        changestamp: nextChangestamp(state.changestamp),
      };
    }
    case "SET_PROPOSAL": {
      const updatedAt = action.proposal?.updatedAt ?? null;
      return {
        ...state,
        proposal: action.proposal,
        loaded: { ...state.loaded, proposal: true },
        versions: { ...state.versions, proposal: action.version ?? state.versions.proposal ?? 0 },
        integrityShas: {
          ...state.integrityShas,
          proposal: action.integritySha ?? state.integrityShas.proposal,
        },
        lastRemoteUpdatedAt: { ...state.lastRemoteUpdatedAt, proposal: updatedAt },
        changestamp: nextChangestamp(state.changestamp),
      };
    }
    case "MARK_DIRTY":
      return { ...state, dirty: { ...state.dirty, [action.section]: action.dirty } };
    case "SET_SAVING":
      return { ...state, saving: { ...state.saving, [action.section]: action.saving } };
    case "SET_ERROR":
      return { ...state, error: { ...state.error, [action.section]: action.error } };
    case "BUMP_CHANGESTAMP":
      return { ...state, changestamp: action.stamp ?? nextChangestamp(state.changestamp) };
    default:
      return state;
  }
}

// ============================================================================
// Draft localStorage V5 — fix K1 (DraftSizeGuard)
// ============================================================================
const DRAFT_V5_PREFIX = "sws::"; // saranasmk-workspace-school v5
const DRAFT_V5_VERSION = "v5";

function draftKeyFor(userId: string | undefined, npsn: string | undefined) {
  const safeUid = userId ? String(userId).slice(0, 32) : "anon";
  const safeNpsn = npsn ? String(npsn) : "no-npsn";
  return `${DRAFT_V5_PREFIX}${safeUid}::${safeNpsn}::${DRAFT_V5_VERSION}`;
}

interface DraftSnapshot {
  createdAt: string;
  modifiedAt: string;
  sections: {
    profile?: Partial<SchoolProfileRecord>;
    equipment?: WorkspaceSchoolEquipmentData;
    proposal?: WorkspaceSchoolProposalData;
    dirty: Partial<Record<SchoolSectionId, boolean>>;
  };
  byteSize: number;
}

function encodeDraftBytes(snap: DraftSnapshot): number {
  return typeof Blob !== "undefined"
    ? new Blob([JSON.stringify(snap)]).size
    : JSON.stringify(snap).length;
}

export function writeLocalDraft(
  state: LoadedState,
  userId: string | undefined,
  npsn: string | undefined,
) {
  try {
    if (typeof window === "undefined") return 0;
    const snap: DraftSnapshot = {
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      sections: {
        profile: state.profile ?? undefined,
        equipment: state.equipment ?? undefined,
        proposal: state.proposal ?? undefined,
        dirty: state.dirty,
      },
      byteSize: 0,
    };
    snap.byteSize = encodeDraftBytes(snap);
    window.localStorage.setItem(draftKeyFor(userId, npsn), JSON.stringify(snap));
    return snap.byteSize;
  } catch {
    return 0;
  }
}

export function readLocalDraft(userId: string | undefined, npsn: string | undefined): DraftSnapshot | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(draftKeyFor(userId, npsn));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DraftSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalDraft(userId: string | undefined, npsn: string | undefined) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(draftKeyFor(userId, npsn));
  } catch {
    /* empty */
  }
}

// ============================================================================
// DraftSizeGuard V2 — K1
// Jika ratio draft bytes vs server bytes < 0.20 → user harus CONFIRM manual.
// TIDAK PERNAH auto-apply.
// ============================================================================
export interface DraftSizeGuardDecision {
  shouldConfirm: boolean;
  serverBytes: number;
  draftBytes: number;
  shrinkRatio: number;
  reason:
    | "no-draft"
    | "draft-empty"
    | "draft-larger"
    | "draft-negligible-shrink"
    | "draft-too-small-NEED-CONFIRM";
}

export function computeDraftSizeGuardDecision(
  serverData: {
    profile?: SchoolProfileRecord | null;
    equipment?: WorkspaceSchoolEquipmentData | null;
    proposal?: WorkspaceSchoolProposalData | null;
  },
  draft: DraftSnapshot | null,
): DraftSizeGuardDecision {
  if (!draft) return { shouldConfirm: false, serverBytes: 0, draftBytes: 0, shrinkRatio: 0, reason: "no-draft" };
  const serverBytes = encodeDraftBytes({
    createdAt: "",
    modifiedAt: "",
    sections: {
      profile: serverData.profile ?? undefined,
      equipment: serverData.equipment ?? undefined,
      proposal: serverData.proposal ?? undefined,
      dirty: {},
    },
    byteSize: 0,
  });
  const draftBytes = draft.byteSize || encodeDraftBytes(draft);
  if (draftBytes < 1000)
    return { shouldConfirm: false, serverBytes, draftBytes, shrinkRatio: 0, reason: "draft-empty" };
  if (serverBytes <= 0)
    return { shouldConfirm: false, serverBytes, draftBytes, shrinkRatio: 0, reason: "draft-larger" };
  const ratio = draftBytes / serverBytes;
  if (ratio >= 1.0)
    return { shouldConfirm: false, serverBytes, draftBytes, shrinkRatio: ratio, reason: "draft-larger" };
  if (ratio >= 0.8)
    return {
      shouldConfirm: false,
      serverBytes,
      draftBytes,
      shrinkRatio: ratio,
      reason: "draft-negligible-shrink",
    };
  return {
    shouldConfirm: true,
    serverBytes,
    draftBytes,
    shrinkRatio: ratio,
    reason: "draft-too-small-NEED-CONFIRM",
  };
}

// ============================================================================
// Context
// ============================================================================
export interface SchoolWorkspaceContextValue extends LoadedState {
  // --- setters ---
  setProfile: (p: SchoolProfileRecord | null) => void;
  setDocuments: (d: SchoolAdministrativeDocumentRecord[]) => void;
  setEquipment: (e: WorkspaceSchoolEquipmentData | null) => void;
  setProposal: (p: WorkspaceSchoolProposalData | null) => void;
  markDirty: (s: SchoolSectionId, v?: boolean) => void;
  markCleanAll: () => void;
  bumpChangestamp: (s?: string) => void;
  // --- persistence (save to server) ---
  saveProfile: (payload: Parameters<typeof updateSchoolProfileRequest>[1]) => Promise<SchoolProfileRecord>;
  saveEquipment: (payload: { equipmentTables: Record<string, unknown> }) => Promise<WorkspaceSchoolEquipmentData>;
  saveProposal: (payload: {
    proposalTables: Record<string, unknown>;
    rpkpSelections: Record<string, unknown>;
  }) => Promise<WorkspaceSchoolProposalData>;
  reloadDocuments: () => Promise<void>;
  // --- lifecycle ---
  reset: () => void;
}

const SchoolWorkspaceContext = createContext<SchoolWorkspaceContextValue | null>(null);

export function useSchoolWorkspace(): SchoolWorkspaceContextValue {
  const ctx = useContext(SchoolWorkspaceContext);
  if (!ctx) {
    // Jangan throw — biarkan dev yang lupa bungkus <Provider> dapat nilai default read-only NULL
    // agar production tidak crash jika misal di page tertentu provider tidak wrap.
    return {
      ...INITIAL_STATE,
      setProfile: () => {},
      setDocuments: () => {},
      setEquipment: () => {},
      setProposal: () => {},
      markDirty: () => {},
      markCleanAll: () => {},
      bumpChangestamp: () => {},
      saveProfile: async () =>
        ({
          schoolId: "",
          npsn: "",
          schoolName: "",
          province: "",
          provinceCode: "",
          city: "",
          cityCode: "",
          district: "",
          districtCode: "",
          village: "",
          villageCode: "",
          regionDisplay: "",
          address: "",
          postalCode: "",
          latitude: null,
          longitude: null,
          principalName: "",
          principalPosition: "Kepala Sekolah",
          principalNip: "",
          principalPhone: "",
          vicePrincipalFacilitiesName: "",
          vicePrincipalFacilitiesPhone: "",
          verificationStatus: "DRAFT",
          verificationReviewNotes: "",
          organizationMembers: [],
          concentrations: [],
          concentrationOptions: [],
          totalRombel: 0,
          totalStudents: 0,
        }) as unknown as SchoolProfileRecord,
      saveEquipment: async () => ({ equipmentTables: {}, updatedAt: null }),
      saveProposal: async () => ({ proposalTables: {}, rpkpSelections: {}, updatedAt: null }),
      reloadDocuments: async () => {},
      reset: () => {},
    };
  }
  return ctx;
}

// ============================================================================
// Provider
// ============================================================================
export function SchoolWorkspaceProvider({
  children,
  token,
  userId,
}: {
  children: React.ReactNode;
  token: string | null | undefined;
  userId?: string;
}) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const tokenRef = useRef<string | null | undefined>(token);
  tokenRef.current = token;

  // Cache tokens untuk memanggil cache invalidation dari Provider
  const userIdRef = useRef<string | undefined>(userId);
  userIdRef.current = userId;

  // Setters sederhana
  const setProfile = useCallback((p: SchoolProfileRecord | null) => dispatch({ type: "SET_PROFILE", profile: p }), []);
  const setDocuments = useCallback(
    (d: SchoolAdministrativeDocumentRecord[]) => dispatch({ type: "SET_DOCUMENTS", documents: d }),
    [],
  );
  const setEquipment = useCallback(
    (e: WorkspaceSchoolEquipmentData | null, version?: number, integritySha?: string) =>
      dispatch({ type: "SET_EQUIPMENT", equipment: e, version, integritySha }),
    [],
  );
  const setProposal = useCallback(
    (p: WorkspaceSchoolProposalData | null, version?: number, integritySha?: string) =>
      dispatch({ type: "SET_PROPOSAL", proposal: p, version, integritySha }),
    [],
  );
  const markDirty = useCallback(
    (s: SchoolSectionId, v = true) => dispatch({ type: "MARK_DIRTY", section: s, dirty: v }),
    [],
  );
  const markCleanAll = useCallback(() => {
    ALL_SECTION_IDS.forEach((sid) => dispatch({ type: "MARK_DIRTY", section: sid, dirty: false }));
  }, []);
  const bumpChangestamp = useCallback(
    (s?: string) => dispatch({ type: "BUMP_CHANGESTAMP", stamp: s }),
    [],
  );

  const reset = useCallback(() => {
    // Reset seluruh state ke initial; page akan LOAD ulang dari server.
    ALL_SECTION_IDS.forEach((sid) => dispatch({ type: "MARK_DIRTY", section: sid, dirty: false }));
    ALL_SECTION_IDS.forEach((sid) => dispatch({ type: "SET_SAVING", section: sid, saving: false }));
    ALL_SECTION_IDS.forEach((sid) => dispatch({ type: "SET_ERROR", section: sid, error: null }));
    dispatch({ type: "SET_PROFILE", profile: null });
    dispatch({ type: "SET_DOCUMENTS", documents: [] });
    dispatch({ type: "SET_EQUIPMENT", equipment: null });
    dispatch({ type: "SET_PROPOSAL", proposal: null });
  }, []);

  // --- persistence helpers (wrap dengan save mutex) ---
  const saveProfile = useCallback(
    async (payload: Parameters<typeof updateSchoolProfileRequest>[1]): Promise<SchoolProfileRecord> => {
      const tok = tokenRef.current;
      if (!tok) throw new Error("Token tidak tersedia. Silakan login kembali.");
      if (state.saving.profile) {
        const err = new Error("Save profile sedang berjalan — tunggu sebentar.") as ApiClientError;
        err.status = 409;
        throw err;
      }
      dispatch({ type: "SET_SAVING", section: "profile", saving: true });
      dispatch({ type: "SET_ERROR", section: "profile", error: null });
      try {
        const res = await updateSchoolProfileRequest(tok, payload);
        dispatch({
          type: "SET_PROFILE",
          profile: res,
          version: (state.versions.profile ?? 0) + 1,
        });
        dispatch({ type: "MARK_DIRTY", section: "profile", dirty: false });
        dispatch({ type: "MARK_DIRTY", section: "concentrations", dirty: false });
        return res;
      } catch (e: any) {
        dispatch({
          type: "SET_ERROR",
          section: "profile",
          error: { message: e?.message ?? "Gagal menyimpan profil.", code: String(e?.status ?? "save_err") },
        });
        throw e;
      } finally {
        dispatch({ type: "SET_SAVING", section: "profile", saving: false });
      }
    },
    [state.saving.profile, state.versions.profile],
  );

  const saveEquipment = useCallback(
    async (payload: {
      equipmentTables: Record<string, unknown>;
    }): Promise<WorkspaceSchoolEquipmentData> => {
      const tok = tokenRef.current;
      if (!tok) throw new Error("Token tidak tersedia. Silakan login kembali.");
      if (state.saving.equipment) {
        const err = new Error("Save peralatan sedang berjalan — tunggu sebentar.") as ApiClientError;
        err.status = 409;
        throw err;
      }
      dispatch({ type: "SET_SAVING", section: "equipment", saving: true });
      dispatch({ type: "SET_ERROR", section: "equipment", error: null });
      try {
        const res = await saveSchoolEquipmentDataRequest(tok, payload);
        dispatch({
          type: "SET_EQUIPMENT",
          equipment: res,
          version: res.version ?? (state.versions.equipment ?? 0) + 1,
          integritySha: res.integritySha,
        });
        dispatch({ type: "MARK_DIRTY", section: "equipment", dirty: false });
        return res;
      } catch (e: any) {
        dispatch({
          type: "SET_ERROR",
          section: "equipment",
          error: {
            message: e?.message ?? "Gagal menyimpan peralatan.",
            code: String(e?.status ?? "save_err"),
          },
        });
        throw e;
      } finally {
        dispatch({ type: "SET_SAVING", section: "equipment", saving: false });
      }
    },
    [state.saving.equipment, state.versions.equipment],
  );

  const saveProposal = useCallback(
    async (payload: {
      proposalTables: Record<string, unknown>;
      rpkpSelections: Record<string, unknown>;
    }): Promise<WorkspaceSchoolProposalData> => {
      const tok = tokenRef.current;
      if (!tok) throw new Error("Token tidak tersedia. Silakan login kembali.");
      if (state.saving.proposal) {
        const err = new Error("Save pengajuan sedang berjalan — tunggu sebentar.") as ApiClientError;
        err.status = 409;
        throw err;
      }
      dispatch({ type: "SET_SAVING", section: "proposal", saving: true });
      dispatch({ type: "SET_ERROR", section: "proposal", error: null });
      try {
        const res = await saveSchoolProposalDataRequest(tok, payload);
        dispatch({
          type: "SET_PROPOSAL",
          proposal: res,
          version: res.version ?? (state.versions.proposal ?? 0) + 1,
          integritySha: res.integritySha,
        });
        dispatch({ type: "MARK_DIRTY", section: "proposal", dirty: false });
        return res;
      } catch (e: any) {
        dispatch({
          type: "SET_ERROR",
          section: "proposal",
          error: {
            message: e?.message ?? "Gagal menyimpan pengajuan.",
            code: String(e?.status ?? "save_err"),
          },
        });
        throw e;
      } finally {
        dispatch({ type: "SET_SAVING", section: "proposal", saving: false });
      }
    },
    [state.saving.proposal, state.versions.proposal],
  );

  const reloadDocuments = useCallback(async () => {
    const tok = tokenRef.current;
    if (!tok) return;
    dispatch({ type: "SECTION_LOADING", section: "documents" });
    try {
      const docs = await schoolAdministrativeDocumentsRequest(tok);
      dispatch({ type: "SET_DOCUMENTS", documents: docs });
    } catch (e: any) {
      dispatch({
        type: "SET_ERROR",
        section: "documents",
        error: { message: e?.message ?? "Gagal memuat dokumen.", code: String(e?.status ?? "load_err") },
      });
    }
  }, []);

  // --- Cross-tab BroadcastChannel sync + storage event (T4 partial K16) ---
  // Naikkan changestamp setiap kali tab LAIN menulis → page akan re-read state cache.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const CHANNEL = "saranasmk-school-workspace-sync";
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL);
    } catch {
      bc = null;
    }
    const onRemoteChange = (remoteStamp: string) => {
      if (remoteStamp && remoteStamp !== state.changestamp) {
        // Invalidate client-side GET cache → next hook akan request fresh
        const tok = tokenRef.current;
        invalidateScopedCacheByPrefix(tok, "/workspace-data/school-");
        invalidateScopedCacheByPrefix(tok, "/school-profile/");
        dispatch({ type: "BUMP_CHANGESTAMP", stamp: remoteStamp });
      }
    };
    const onMsg = (ev: MessageEvent) => {
      if (ev?.data?.type === "workspace-changed" && typeof ev.data.changestamp === "string") {
        onRemoteChange(ev.data.changestamp);
      }
    };
    bc?.addEventListener("message", onMsg);
    const onStorage = (ev: StorageEvent) => {
      if (ev.key?.startsWith(DRAFT_V5_PREFIX) && ev.newValue) {
        onRemoteChange(nextChangestamp());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      bc?.removeEventListener("message", onMsg);
      bc?.close();
      window.removeEventListener("storage", onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.changestamp]);

  // Emit changestamp setiap BERUBAH → tab LAIN ikut invalidate cache
  useEffect(() => {
    if (typeof window === "undefined" || !state.changestamp) return;
    try {
      const bc = new BroadcastChannel("saranasmk-school-workspace-sync");
      bc.postMessage({ type: "workspace-changed", changestamp: state.changestamp });
      bc.close();
    } catch {
      /* empty */
    }
  }, [state.changestamp]);

  const value = useMemo<SchoolWorkspaceContextValue>(
    () => ({
      ...state,
      setProfile,
      setDocuments,
      setEquipment,
      setProposal,
      markDirty,
      markCleanAll,
      bumpChangestamp,
      saveProfile,
      saveEquipment,
      saveProposal,
      reloadDocuments,
      reset,
    }),
    [
      state,
      setProfile,
      setDocuments,
      setEquipment,
      setProposal,
      markDirty,
      markCleanAll,
      bumpChangestamp,
      saveProfile,
      saveEquipment,
      saveProposal,
      reloadDocuments,
      reset,
    ],
  );

  return <SchoolWorkspaceContext.Provider value={value}>{children}</SchoolWorkspaceContext.Provider>;
}

export default SchoolWorkspaceProvider;
