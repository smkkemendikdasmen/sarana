# 🏫 SCHOOL WORKSPACE DEVELOPER GUIDELINES v5
**Panduan untuk menambah / edit fitur halaman sekolah**  
**Target Halaman**: `/sekolah/profil`, `/sekolah/alat`, `/sekolah/pengajuan/*`, `/dashboard/sekolah`  
**Dokumen Acuan**: [ARCHITECTURE_BLUEPRINT_v5.md](./ARCHITECTURE_BLUEPRINT_v5.md)

---

## 🎯 ATURAN UTAMA: SINGLE SOURCE OF TRUTH (SSOT)
✅ **WAJIB**: Semua state halaman sekolah MENGGUNAKAN `SchoolWorkspaceProvider` (React Context).  
❌ **DILARANG**: Buat `useState` / `useReducer` LOKAL untuk DATA UTAMA (proposalTables, equipmentTables, concentrations, etc). State UI toggle (open dialog, filter, sort) BOLEH lokal.

Cara menggunakan Provider di komponen baru:
```tsx
"use client";
import { useSchoolWorkspace } from "@/components/school/school-workspace-provider";

export function MyNewSchoolFeature() {
  const {
    proposal,       // WorkspaceSchoolProposalData (version, integritySha, proposalTables, rpkpSelections)
    equipment,      // WorkspaceSchoolEquipmentData
    profile,        // SchoolProfileRecord
    documents,      // SchoolAdministrativeDocumentRecord[]
    dirty,          // Partial<Record<SchoolSectionId, boolean>>
    saving,         // Partial<Record<SchoolSectionId, boolean>> → mutex K5
    markDirty,      // (sectionId, true/false) => void
    saveProposal,   // wrapper save dengan optimistic lock + mutex
    saveEquipment,  // wrapper save
    saveProfile,    // wrapper save
  } = useSchoolWorkspace();

  // ... logic ...
}
```

---

## 🧭 SECTION ID STANDAR (JANGAN BUAT ID BARU SEMBARANGAN!)
```ts
type SchoolSectionId =
  | "profile"              // Nama, NPSN, alamat, kepsek, dll (FORM UTAMA PROFIL)
  | "concentrations"       // Daftar konsentrasi keahlian di profil
  | "documents"            // Dokumen administrasi (akreditasi, ijazah, SK)
  | "equipment"            // /sekolah/alat → equipmentTables
  | "proposal"             // /sekolah/pengajuan → proposalTables + rpkpSelections
  | "dashboard-summary";   // /dashboard/sekolah READ ONLY
```

Gunakan ID ini saat: `markDirty(section, true)`, `saving[section]`, cache invalidate.

---

## 💾 ATURAN CACHE INVALIDATION (FIX K4)
✅ **BENAR**: Selalu pakai `invalidateScopedCacheByPrefix(token, URL_BASE_PREFIX)`
```ts
import { invalidateScopedCacheByPrefix } from "@/lib/api";

// INVALIDASI SELURUH scope + URL prefix base
invalidateScopedCacheByPrefix(token, `${API_URL}/workspace-data/school-proposals`);
invalidateScopedCacheByPrefix(token, `${API_URL}/dashboard`);
```

❌ **SALAH — DILARANG!** Format pipe mismatch → stale permanen:
```ts
// JANGAN LAKUKAN INI:
clearClientGetCache(`${API_URL}/workspace-data/school-proposals/me|`);
```

---

## 🚀 ATURAN SAVE DATA — 5 RITUAL WAJIB
### 1. Pakai Provider save wrapper (BUKAN langsung panggil api.ts save)
```ts
// ✅ BENAR (mutex aktif, optimistic lock otomatis)
const saved = await saveProposal({ proposalTables: next, rpkpSelections: rpkp });

// ❌ SALAH (double save bisa race)
const saved = await saveSchoolProposalDataRequest(token, payload);
```

### 2. Mark DIRTY sebelum edit apa pun, CLEAN saat save sukses
```ts
const handleEditCell = (newVal: any) => {
  nextEquipment = { ...nextEquipment, rows: [...updated] };
  markDirty("equipment", true);  // 👈 WAJIB
};
// save sukses → Provider otomatis mark dirty=false
```

### 3. Show Loading & Disabled Button saat `saving[section] == true`
```tsx
<Button
  disabled={saving.equipment === true || dirty.equipment === false}
  onClick={handleSaveClick}
>
  {saving.equipment ? "Menyimpan..." : "💾 Simpan Perubahan"}
</Button>
```

### 4. Gunakan `PATCH /delta` untuk perubahan KECIL (≤20% data)
✅ **Gunakan PATCH** bila edit 1-5 baris (hemat 95% bandwidth):
```ts
import {
  computeTopLevelPatchDiff,
  patchSchoolEquipmentDataRequest,
} from "@/lib/api";

// Sebelum edit: oldEquipment, setelah edit: newEquipment
const diff = computeTopLevelPatchDiff(
  oldEquipment?.equipmentTables ?? {},
  newEquipment?.equipmentTables ?? {},
);
if (diff.patchRatio < 0.20) {
  // Worth it pakai PATCH (payload kecil)
  await patchSchoolEquipmentDataRequest(token, {
    changedKeys: diff.changedKeys,
    deletedKeys: diff.deletedKeys,
    expectedVersion: oldEquipment?.version ?? 0, // 👈 optimistic lock
  });
} else {
  // Bila berubah banyak → PUT full saja
  await saveEquipment({ equipmentTables: newEquipment });
}
```

### 5. Draft localStorage → WAJIB DraftSizeGuard V2
```ts
import {
  readLocalDraft,
  computeDraftSizeGuardDecision,
  writeLocalDraft,
} from "@/components/school/school-workspace-provider";

const decision = computeDraftSizeGuardDecision(serverState, draft);
if (decision.shouldConfirm) {
  // 👈 WAJIB: TAMPILKAN DIALOG KONFIRMASI ke user
  // draft jauh LEBIH KECIL dari server (ratio 0.20) → kemungkinan draft corrupt / data lama
  const ok = window.confirm(
    `⚠️ Draft lokal hanya ${Math.round(decision.draftBytes/1024)}KB,` +
    ` server punya ${Math.round(decision.serverBytes/1024)}KB.` +
    ` Terapkan draft INI? Data besar server AKAN TERHAPUS permanen!`,
  );
  if (!ok) return; // JANGAN APPLY
}
applyDraft(draft);
```

---

## 🔍 BroadcastChannel Cross-Tab (Fix K16)
**Sudah otomatis di Provider.** Setiap write sukses di tab A → Provider emit:
```
BroadcastChannel("saranasmk-school-workspace-sync")
  → { type: "workspace-changed", changestamp: "YYYYMMDDHHmmss-random6" }
```
Tab B lain yang sama user → akan auto `invalidateScopedCacheByPrefix()` + trigger re-read state fresh.

TIDAK PERLU coding khusus untuk cross-tab. **Sudah jalan otomatis.**

---

## 🧪 TEST CASE WAJIB JALANKAN SEBELUM PR / DEPLOY
1. **Double Save Test**: Klik 5x tombol "Simpan" dengan cepat → **HANYA 1 request network keluar** (mutex K5 berjalan).
2. **Cross-Tab Sync**: Buka 2 window `/sekolah/profil`, edit di tab A save → dalam ≤ 2 detik tab B **auto lihat perubahan TERBARU** (tanpa reload).
3. **Draft Guard Test**: Hapus 80% data di localStorage draft → reload page → MUNCUL DIALOG CONFIRM (tidak auto-apply).
4. **Optimistic Lock Test**: Buka 2 tab edit yang sama section, save tab A lalu save tab B → Tab B DAPAT ERROR 409 Conflict (expectedVersion mismatch).
5. **Partial Patch Test**: Edit 1 baris di alat → Lihat Network tab → **REQUEST BODY SIZE ≤ 25KB** (PATCH /delta aktif, bukan PUT 30MB).
6. **Cache Invalidation**: Save edit di halaman profil → Buka dashboard sekolah → **DATA SUDAH FRESH TANPA reload manual**.

---

## 🗂️ TAMBAH FITUR BARU? IKUTI FLOW INI:
```
1. Tambah SectionId baru (BILA BENAR-BENAR PERLU) di school-workspace-provider.tsx
2. Tambah state field baru di LoadedState interface
3. Tambah Reducer action + handler
4. Tambah setter di Context value
5. Tambah invalidate prefix di `invalidateScopedCacheByPrefix`
6. Tambah save wrapper (dengan mutex + optimistic lock)
7. Tulis test case 6 point di atas untuk section baru
8. Update SECTION TABLE di dokumen ini + ARCHITECTURE BLUEPRINT
```

---

## 🔐 LIST HARD GUARD YANG TIDAK BOLEH DIHAPUS
Sebelum menghapus salah satu dari ini, **DISKUSI DULU PIC infrastruktur**:

| Guard Name | Lokasi | Fungsi |
|---|---|---|
| `preservePayloadObject` | `workspace-data.service.ts` upsertProposal/Equipment | Cegah partial write → JSON field TIDAK di overwrite blank |
| `hasOwnProperty(payload,'concentrations')` | `school-profile.service.ts updateMyProfile` | Cegah field concentrations terhapus bila payload tidak include key |
| Drastic Shrink 25% Guard | Backend upsert method | Cegah save payload 1KB timpa server 30MB (data hilang) |
| DraftSizeGuard 20% | Frontend Provider | Cegah localStorage blind restore timpa server BESAR |
| `version WHERE check` | Upsert SQL | Optimistic lock, last write BUKAN wins |
| `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` | Txn top write | Cegah write skew antar paralel txn |
| Cache sep `"::"` (bukan `"|"`) | Frontend api.ts + scopedCacheKey | Hindari prefix invalidation mismatch K4 |

---

## ✅ CHECKLIST SEBELUM MERGE / DEPLOY
- [ ] Semua state data utama pakai Provider, TIDAK useState lokal.
- [ ] Save pakai Provider wrapper (saveProfile / saveEquipment / saveProposal).
- [ ] Perubahan kecil ≤ 20% → pakai PATCH `/delta` (bukan PUT full).
- [ ] `markDirty(section, true)` terpanggil tiap onChage handler edit.
- [ ] Button save disabled saat `saving[section] === true`.
- [ ] Error 409 Conflict (optimistic lock mismatch) DITANGKAP → user message "Data diubah ditempat lain, reload halaman".
- [ ] Cross-tab sync tested.
- [ ] `npm run check:web` 0 error.
- [ ] `npm run check:api` 0 error.
