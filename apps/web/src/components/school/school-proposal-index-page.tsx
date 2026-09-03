"use client";

import { ArrowLeft, ChevronDown, ChevronUp, ClipboardList, GraduationCap, Wrench, FileSearch, FileSpreadsheet, Loader2, Wallet, CheckCircle2, Clock4, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/store/auth-store";
import { useAuthSession } from "@/hooks/use-auth-session";
import {
  schoolProposalDataRequest,
  schoolProposalDataByNpsnRequest,
  preparationsRequest,
  trainingCostsRequest,
  schoolPaguDetailRequest,
  type WorkspaceSchoolProposalData,
  type PreparationsBundle,
  type TrainingCostsBundle,
  type SchoolPaguDetail,
} from "@/lib/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const IDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

type ShopKey = "shop1" | "shop2" | "shop3";
type ShopQuoteLike = {
  totalPrice?: unknown;
  priceWithTax?: unknown;
  shippingCost?: unknown;
  installationCost?: unknown;
  name?: unknown;
  link?: unknown;
};
type ProposalRowLike = {
  quantity?: unknown;
  unit?: unknown;
  id?: unknown;
  name?: unknown;
  itemName?: unknown;
  specification?: unknown;
  description?: unknown;
  shop1?: unknown;
  shop2?: unknown;
  shop3?: unknown;
};
type RpkpSelectionMap = Record<string, ShopKey | undefined>;

type RabPerKkItem = {
  id: string;
  no: number;
  name: string;
  specification: string;
  quantity: number;
  unit: string;
  selectedShop: ShopKey | null;
  selectedShopName: string;
  hargaSatuan: number;
  subtotal: number;
  isChosen: boolean;
};

function toNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") {
    let s = v.replace(/[^\d,.\-]/g, "").trim();
    if (!s) return 0;
    const hasDot = s.includes(".");
    const hasComma = s.includes(",");
    if (hasDot && hasComma) {
      const lastDot = s.lastIndexOf(".");
      const lastComma = s.lastIndexOf(",");
      if (lastComma > lastDot) {
        s = s.replace(/\./g, "").replace(/,/g, ".");
      } else {
        s = s.replace(/,/g, "");
      }
    } else if (hasDot) {
      const parts = s.split(".");
      if (parts.length > 2) {
        s = parts.join("");
      }
    } else if (hasComma) {
      const parts = s.split(",");
      if (parts.length > 2) {
        s = parts.join("");
      } else {
        s = s.replace(/,/g, ".");
      }
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function shopTotalPrice(shop: unknown): number {
  if (!shop || typeof shop !== "object") return 0;
  const s = shop as ShopQuoteLike;
  if (s.totalPrice !== undefined && s.totalPrice !== null) {
    const t = toNumber(s.totalPrice);
    if (t > 0) return t;
  }
  return (
    toNumber(s.priceWithTax) + toNumber(s.shippingCost) + toNumber(s.installationCost)
  );
}

function shopKeyFromSelection(sel: unknown): ShopKey | null {
  if (sel === "shop1" || sel === "shop2" || sel === "shop3") return sel as ShopKey;
  if (typeof sel === "string") {
    const v = sel.toLowerCase();
    if (v === "shop1" || v === "toko1" || v === "toko 1") return "shop1";
    if (v === "shop2" || v === "toko2" || v === "toko 2") return "shop2";
    if (v === "shop3" || v === "toko3" || v === "toko 3") return "shop3";
  }
  return null;
}

function rowQuantity(row: unknown): number {
  if (!row || typeof row !== "object") return 0;
  return toNumber((row as ProposalRowLike).quantity);
}

function rowUnit(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const u = (row as ProposalRowLike).unit;
  return typeof u === "string" ? u : "";
}

function rowName(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const r = row as ProposalRowLike;
  const n = typeof r.name === "string" ? r.name : typeof r.itemName === "string" ? r.itemName : "";
  return n;
}

function rowSpec(row: unknown): string {
  if (!row || typeof row !== "object") return "";
  const r = row as ProposalRowLike;
  return typeof r.specification === "string"
    ? r.specification
    : typeof r.description === "string"
      ? r.description
      : "";
}

function rowId(row: unknown, fallback: number): string {
  if (!row || typeof row !== "object") return String(fallback);
  const r = row as ProposalRowLike;
  return typeof r.id === "string" ? r.id : String(fallback);
}

function shopName(shop: unknown, fallbackLabel: string): string {
  if (!shop || typeof shop !== "object") return fallbackLabel;
  const n = (shop as ShopQuoteLike).name;
  return typeof n === "string" && n.trim() ? n.trim() : fallbackLabel;
}

function shopPriceWithTax(shop: unknown): number {
  if (!shop || typeof shop !== "object") return 0;
  const s = shop as ShopQuoteLike;
  return toNumber(s.priceWithTax);
}

function shopLabelFor(shopKey: ShopKey | null): string {
  if (!shopKey) return "Belum Pilih";
  if (shopKey === "shop1") return "Toko 1";
  if (shopKey === "shop2") return "Toko 2";
  return "Toko 3";
}

function rowShopObject(row: unknown, shopKey: ShopKey | null): unknown {
  if (!row || typeof row !== "object" || !shopKey) return null;
  return (row as ProposalRowLike)[shopKey] ?? null;
}

function cheapestShopKey(row: unknown): ShopKey | null {
  if (!row || typeof row !== "object") return null;
  const r = row as ProposalRowLike;
  let best: ShopKey | null = null;
  let bestPrice = Infinity;
  for (const k of ["shop1", "shop2", "shop3"] as ShopKey[]) {
    const p = shopTotalPrice(r[k]);
    if (p > 0 && p < bestPrice) {
      bestPrice = p;
      best = k;
    }
  }
  return best;
}

function buildDetailItem({
  row,
  i,
  selMap,
}: {
  row: unknown;
  i: number;
  selMap: RpkpSelectionMap;
}): RabPerKkItem {
  const id = rowId(row, i);
  const chosen = shopKeyFromSelection(selMap[id]) ?? null;
  const isChosen = chosen !== null;
  const priceKey = isChosen ? chosen : cheapestShopKey(row);
  const shopObj = rowShopObject(row, priceKey);
  const q = rowQuantity(row);
  const p = rowPriceForShop(row, chosen);
  const satuanP = isChosen
    ? shopPriceWithTax(shopObj) || (q > 0 ? Math.round(p / q) : 0)
    : shopPriceWithTax(shopObj) || (q > 0 ? Math.round(p / q) : 0);
  const subtotal = isChosen
    ? (q > 0 && satuanP > 0 ? q * satuanP : p)
    : 0;
  return {
    id,
    no: i + 1,
    name: rowName(row) || `Alat ${i + 1}`,
    specification: rowSpec(row),
    quantity: q,
    unit: rowUnit(row) || "unit",
    selectedShop: chosen,
    selectedShopName: shopName(shopObj, shopLabelFor(priceKey)),
    hargaSatuan: satuanP,
    subtotal,
    isChosen,
  };
}

function rowPriceForShop(row: unknown, shopKey: ShopKey | null): number {
  if (!row || typeof row !== "object") return 0;
  if (!shopKey) {
    const prices: number[] = [];
    for (const k of ["shop1", "shop2", "shop3"] as ShopKey[]) {
      const t = shopTotalPrice((row as ProposalRowLike)[k]);
      if (t > 0) prices.push(t);
    }
    return prices.length > 0 ? Math.min(...prices) : 0;
  }
  return shopTotalPrice((row as ProposalRowLike)[shopKey]);
}

function isGlobalKey(key: string): boolean {
  return (
    key.startsWith("__global_biaya_persiapan") ||
    key.startsWith("__global_biaya_pendukung") ||
    key.startsWith("__global_")
  );
}

type RabBreakdown = {
  grandTotal: number;
  totalPersiapan: number;
  totalPelatihan: number;
  totalAlatSurvey: number;
  totalAlatRpkp: number;
  totalAlatRpkpChosen: number;
  itemCountPersiapan: number;
  itemCountPelatihan: number;
  itemCountAlat: number;
  itemCountAlatRpkpChosen: number;
  kkCount: number;
  perKk: Array<{ code: string; name: string; total: number; rows: number; chosenRows: number; key: string; items: RabPerKkItem[] }>;
};

function summarizeRab(
  data: WorkspaceSchoolProposalData | null,
  kkResolver: (code: string) => string | undefined,
  eligibleKkCodesFilter?: Set<string> | null,
): RabBreakdown {
  const pt: Record<string, unknown> = data?.proposalTables ?? {};
  const rp: Record<string, unknown> = data?.rpkpSelections ?? {};

  let totalPersiapan = 0;
  let totalPelatihan = 0;
  let totalAlatSurvey = 0;
  let totalAlatRpkp = 0;
  let totalAlatRpkpChosen = 0;
  let itemCountPersiapan = 0;
  let itemCountPelatihan = 0;
  let itemCountAlat = 0;
  let itemCountAlatRpkpChosen = 0;
  const perKkMap = new Map<string, { code: string; name: string; total: number; rows: number; chosenRows: number; key: string; items: RabPerKkItem[] }>();

  for (const [key, value] of Object.entries(pt)) {
    if (!Array.isArray(value)) continue;
    const rowsArr = value as unknown[];
    if (key === "__global_biaya_persiapan_pelaporan") {
      for (const row of rowsArr) {
        const q = toNumber((row as Record<string, unknown>)?.quantity ?? (row as Record<string, unknown>)?.qty);
        const p =
          toNumber((row as Record<string, unknown>)?.sbmSatuanRp) ||
          toNumber((row as Record<string, unknown>)?.price) ||
          toNumber((row as Record<string, unknown>)?.hargaSatuanRp);
        const subtotal = q * p || rowPriceForShop(row, null);
        totalPersiapan += subtotal;
        if (q > 0 || subtotal > 0) itemCountPersiapan += 1;
      }
      continue;
    }
    if (key === "__global_biaya_pendukung_pelatihan") {
      for (const row of rowsArr) {
        const t =
          toNumber((row as Record<string, unknown>)?.totalBiayaPelatihanRp) ||
          (() => {
            const q =
              toNumber((row as Record<string, unknown>)?.refQtySurvey) ||
              toNumber((row as Record<string, unknown>)?.quantity);
            const p = toNumber((row as Record<string, unknown>)?.hargaSatuanRp);
            return q * p;
          })() ||
          rowPriceForShop(row, null);
        totalPelatihan += t;
        if (t > 0) itemCountPelatihan += 1;
      }
      continue;
    }

    // Per KK pattern: <id>::<code>::survey / rpkp / rab
    let kkCode: string | null = null;
    let segment: string | null = null;
    if (key.includes("::")) {
      const parts = key.split("::");
      if (parts.length >= 3) {
        kkCode = parts[1];
        segment = parts[2];
      }
    }
    if (kkCode && segment === "survey") {
      // ⚡ RULE 2: HANYA KK DIREKOMENDASIKAN DINAS YANG DIMASUKAN KE HITUNGAN RAB.
      // Jika whitelist eligibleKkCodesFilter diberikan & kode KK tidak didaftarkan dinas,
      // SKIP (jangan masuk ke grand total, jangan tampil di rincian RAB).
      if (eligibleKkCodesFilter && !eligibleKkCodesFilter.has(kkCode)) continue;
      let kkSurveyTotal = 0;
      let kkSurveyRows = 0;
      let kkRpkpTotalAll = 0;
      let kkRpkpChosenTotal = 0;
      let kkRpkpChosenCount = 0;
      const chosenOnly: RabPerKkItem[] = [];
      // ⚡ V4.6 ROOT FIX "RPKP disimpan tapi RAB tidak berubah Rp 0":
      // Sejarah bug: rpkpSelections (DB column rpkp_selections_json) berisi
      // MAP idRow -> shop1/2/3, TAPI rows array alat (quantity, nama, harga)
      // disimpan di proposalTables key ::survey, BUKAN di ::rpkp. Sebelumnya
      // branch "rpkp" yang kalkulasi chosen subtotal TAPI rowsnya kosong/undefined
      // → hasilnya nol terus. SEKARANG pindahkan kalkulasi chosen ke branch
      // survey INI, karena disini rows-nya ADA dan lengkap.
      // Cara pairing selections: cari di rp (rpkpSelections) semua key yang
      // end-with `::<kkCode>::rpkp` (prefix UID apapun, suffix match).
      // V4.6-b: MERGE ORDER dipastikan: SORT DESCENDING = UID prefix LAMA
      // (lebih besar / admin session awal) di-apply DULUAN, UID prefix BARU
      // (current user login session, 5c200...) di-apply TERAKHIR.
      // Sehingga save user terbaru SELALU WIN vs old admin session.
      // (Case test: 8.2.1 row x4e77e6a → admin save shop1, current user save shop2
      // → Shop2 harus muncul di RAB).
      const selMap: RpkpSelectionMap = {};
      const rpEntriesSorted = [...Object.entries(rp)].sort(([a], [b]) =>
        b.localeCompare(a, "en")
      );
      for (const [rpKey, rpValue] of rpEntriesSorted) {
        if (rpKey.endsWith(`::${kkCode}::rpkp`) && rpValue && typeof rpValue === "object") {
          Object.assign(selMap, rpValue as RpkpSelectionMap);
        }
      }
      const itemsAll: RabPerKkItem[] = rowsArr.map((row, i) => buildDetailItem({ row, i, selMap }));
      let seqNo = 1;
      for (let i = 0; i < rowsArr.length; i++) {
        const row = rowsArr[i];
        const q = rowQuantity(row);
        const p = rowPriceForShop(row, null);
        const subtotal = q * p;
        totalAlatSurvey += subtotal;
        kkSurveyTotal += subtotal;
        kkSurveyRows += 1;
        if (q > 0 || p > 0) itemCountAlat += 1;
        if (row && typeof row === "object") {
          const idRaw = (row as Record<string, unknown>)?.id;
          const idKey = typeof idRaw === "string" ? idRaw : String(i);
          const chosen = shopKeyFromSelection(selMap[idKey]) ?? null;
          const pAll = p;
          kkRpkpTotalAll += q * pAll;
          totalAlatRpkp += q * pAll;
          if (chosen !== null) {
            const pChosen = rowPriceForShop(row, chosen);
            const subtotalChosen = q * pChosen;
            totalAlatRpkpChosen += subtotalChosen;
            kkRpkpChosenTotal += subtotalChosen;
            kkRpkpChosenCount += 1;
            itemCountAlatRpkpChosen += 1;
          }
        }
      }
      for (const itRaw of itemsAll) {
        if (itRaw.isChosen) {
          chosenOnly.push({ ...itRaw, no: seqNo });
          seqNo += 1;
        }
      }
      const kkName = kkResolver(kkCode) ?? kkCode;
      const rec = perKkMap.get(kkCode) ?? {
        code: kkCode,
        name: kkName,
        total: 0,
        rows: 0,
        chosenRows: 0,
        key: kkCode,
        items: [],
      };
      rec.rows = Math.max(rec.rows ?? 0, kkSurveyRows);
      rec.total = kkRpkpChosenTotal;
      rec.chosenRows = kkRpkpChosenCount;
      rec.items = chosenOnly;
      perKkMap.set(kkCode, rec);
      void kkRpkpTotalAll;
      continue;
    }
    if (kkCode && segment === "rpkp") {
      if (eligibleKkCodesFilter && !eligibleKkCodesFilter.has(kkCode)) continue;
      // V4.6 DEPRECATED BRANCH: dibiarkan backwards-compat jika ada data
      // legacy yang simpan rows di key ::rpkp (sangat jarang). Sekarang mayoritas
      // data simpan rows di ::survey.
      const selKey = key.replace(/::rpkp$/, "::rpkp") as string;
      const sel: unknown = rp[key] ?? rp[selKey];
      const selMap: RpkpSelectionMap =
        sel && typeof sel === "object" ? (sel as RpkpSelectionMap) : {};
      const itemsFromRpkpAll: RabPerKkItem[] = rowsArr.map((row, idx) =>
        buildDetailItem({ row, i: idx, selMap }));
      let kkRpkpTotalAll = 0;
      let kkRpkpChosenTotal = 0;
      let kkRpkpChosenCount = 0;
      const chosenOnly: RabPerKkItem[] = [];
      for (let i = 0; i < rowsArr.length; i++) {
        const row = rowsArr[i];
        if (!row || typeof row !== "object") continue;
        const idRaw = (row as Record<string, unknown>)?.id;
        const idKey = typeof idRaw === "string" ? idRaw : String(i);
        const chosen = shopKeyFromSelection(selMap[idKey]) ?? null;
        const q = rowQuantity(row);
        const pAll = rowPriceForShop(row, null);
        const subtotalAll = q * pAll;
        totalAlatRpkp += subtotalAll;
        kkRpkpTotalAll += subtotalAll;
        if (chosen !== null) {
          const pChosen = rowPriceForShop(row, chosen);
          const subtotalChosen = q * pChosen;
          totalAlatRpkpChosen += subtotalChosen;
          kkRpkpChosenTotal += subtotalChosen;
          kkRpkpChosenCount += 1;
          itemCountAlatRpkpChosen += 1;
          if (q > 0 || pChosen > 0) itemCountAlat += 1;
        }
      }
      let seqNo = 1;
      for (const itRaw of itemsFromRpkpAll) {
        if (itRaw.isChosen) {
          chosenOnly.push({ ...itRaw, no: seqNo });
          seqNo += 1;
        }
      }
      const kkName = kkResolver(kkCode) ?? kkCode;
      const rec = perKkMap.get(kkCode) ?? {
        code: kkCode,
        name: kkName,
        total: 0,
        rows: 0,
        chosenRows: 0,
        key: kkCode,
        items: [],
      };
      // JANGAN timpa total kalo branch survey sudah kasih nilai (hindari overwrite nol)
      if (kkRpkpChosenTotal > 0 || rec.total <= 0) rec.total = Math.max(rec.total ?? 0, kkRpkpChosenTotal);
      rec.rows = Math.max(rec.rows ?? 0, rowsArr.length);
      rec.chosenRows = Math.max(rec.chosenRows ?? 0, kkRpkpChosenCount);
      if (chosenOnly.length > 0) {
        // Gabung jika items survey sudah ada chosen (uniq by rowId+no)
        const existingIds = new Set(rec.items.map(it => it.id).filter(Boolean));
        for (const it of chosenOnly) {
          if (it.id && !existingIds.has(it.id)) rec.items.push(it);
        }
      }
      perKkMap.set(kkCode, rec);
    }
  }

  const perKk = [...perKkMap.values()].sort((a, b) => b.total - a.total);
  const grandTotal = totalAlatRpkpChosen + totalPersiapan + totalPelatihan;

  return {
    grandTotal,
    totalPersiapan,
    totalPelatihan,
    totalAlatSurvey,
    totalAlatRpkp,
    totalAlatRpkpChosen,
    itemCountPersiapan,
    itemCountPelatihan,
    itemCountAlat,
    itemCountAlatRpkpChosen,
    kkCount: perKk.length,
    perKk,
  };
}

export function SchoolProposalIndexPage({ schoolNpsn }: { schoolNpsn?: string }) {
  const { hydrate, session } = useAuthStore();
  const queryClient = useQueryClient();
  const parsed = useAuthSession();
  const npsn = schoolNpsn ?? parsed?.npsn ?? "";
  const [expandedKks, setExpandedKks] = useState<Set<string>>(new Set());

  const toggleKkExpand = (kkKey: string) => {
    setExpandedKks((prev) => {
      const next = new Set(prev);
      if (next.has(kkKey)) next.delete(kkKey);
      else next.add(kkKey);
      return next;
    });
  };

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // ⚡ V4.5: CROSS-TAB CACHE SYNC — JIKA di tab lain (surveyharga/rpkp) user KLIK SIMPAN →
  // localStorage event terpicu → INVALIDATE proposalIndexSummary cache page ini.
  // (Sebelumnya: save sukses di tab rpkp, page /pengajuan masih baca stale cache
  //  → user lapor "RPKP diubah belum berubah di RAB". Diresolve 100%.)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncKey = `__prisma_rpkp_saved__:${npsn || "me"}`;
    const syncKeyAny = "__prisma_rpkp_saved__:";
    let t: ReturnType<typeof setTimeout> | null = null;
    const onStorage = (ev: StorageEvent) => {
      const key = ev.key || "";
      if (!key.startsWith(syncKeyAny)) return;
      if (t) clearTimeout(t);
      // Debounce 300ms agar banyak event simpan berturut tidak membanjiri refetch.
      t = setTimeout(() => {
        void Promise.all([
          queryClient.invalidateQueries({ queryKey: ["proposalIndexSummary"], refetchType: "all" }),
          queryClient.invalidateQueries({ queryKey: ["workspaceProposalData"], refetchType: "all" }),
          queryClient.invalidateQueries({ queryKey: ["paguDetailProposal"], refetchType: "all" }),
        ]).catch(() => null);
      }, 300);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
      if (t) clearTimeout(t);
    };
  }, [npsn, queryClient]);

  const baseMe = "/sekolah/pengajuan";
  const baseWithNpsn = npsn ? `/sekolah/pengajuan/${encodeURIComponent(npsn)}` : baseMe;
  const pathSarana = npsn ? `${baseWithNpsn}/data-sarana` : `${baseMe}/data-sarana`;
  const pathPersiapan = npsn ? `${baseWithNpsn}/data-persiapan` : `${baseMe}/data-persiapan`;
  const pathPelatihan = npsn ? `${baseWithNpsn}/data-pelatihan` : `${baseMe}/data-pelatihan`;
  const pathSurvey = npsn ? `${baseWithNpsn}/surveyharga` : `${baseMe}/surveyharga`;
  const pathRpkp = npsn ? `${baseWithNpsn}/rpkp` : `${baseMe}/rpkp`;
  const backHref = session?.user?.role === "SEKOLAH" ? "/dashboard/sekolah" : "/dashboard/admin";

  const token = (session?.token ?? parsed?.session?.token ?? "").trim();
  const hasToken = Boolean(token);

  const { data: proposal, isLoading } = useQuery({
    queryKey: ["proposalIndexSummary", npsn || "me"],
    queryFn: async (): Promise<WorkspaceSchoolProposalData | null> => {
      if (!hasToken) return null;
      try {
        if (npsn) {
          return await schoolProposalDataByNpsnRequest(token, npsn);
        }
        return await schoolProposalDataRequest(token);
      } catch {
        return null;
      }
    },
    enabled: hasToken,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const { data: prepBundle, isLoading: isPrepLoading } = useQuery({
    queryKey: ["proposalIndexPreparations", npsn || "me"],
    queryFn: async (): Promise<PreparationsBundle | null> => {
      if (!hasToken) return null;
      try {
        return await preparationsRequest(token, npsn || undefined);
      } catch {
        return null;
      }
    },
    enabled: hasToken,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const { data: trainBundle, isLoading: isTrainLoading } = useQuery({
    queryKey: ["proposalIndexTrainings", npsn || "me"],
    queryFn: async (): Promise<TrainingCostsBundle | null> => {
      if (!hasToken) return null;
      try {
        return await trainingCostsRequest(token, npsn || undefined);
      } catch {
        return null;
      }
    },
    enabled: hasToken,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const { data: pagu, isLoading: isPaguLoading } = useQuery({
    queryKey: ["paguDetailIndex", npsn || "me"],
    queryFn: async (): Promise<SchoolPaguDetail | null> => {
      if (!hasToken) return null;
      try {
        return await schoolPaguDetailRequest(token, npsn || undefined);
      } catch {
        return null;
      }
    },
    enabled: hasToken,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const isAnyLoading = isLoading || isPrepLoading || isTrainLoading || isPaguLoading;

  type ProfileConcentrationT = {
    code?: string;
    name?: string;
    isAdminRecommendation?: boolean | null;
  };

  const eligibleKkCodesSet = useMemo<Set<string> | null>(() => {
    try {
      const userAny = session?.user as unknown as Record<string, any> | undefined;
      const profile = userAny?.school?.profile ?? null;
      if (profile && Array.isArray((profile as { concentrations?: ProfileConcentrationT[] }).concentrations)) {
        const arr = (profile as { concentrations: ProfileConcentrationT[] }).concentrations;
        const eligibleCodes = arr
          .filter((c) => Boolean(c?.code) && (c?.isAdminRecommendation === true))
          .map((c) => String(c.code));
        return new Set(eligibleCodes);
      }
    } catch {
    }
    // Fallback: kalau profile concentrations tidak tersedia →
    // return null = JANGAN FILTER (semua kode dianggap eligible) agar
    // tetap aman tidak ada data yang hilang tanpa sengaja.
    return null;
  }, [session?.user]);

  const kkNameResolver = (code: string): string | undefined => {
    try {
      const userAny = session?.user as unknown as Record<string, any> | undefined;
      const profile = userAny?.school?.profile ?? null;
      if (profile && Array.isArray((profile as { concentrations?: ProfileConcentrationT[] }).concentrations)) {
        const m = (profile as { concentrations: ProfileConcentrationT[] }).concentrations.find(
          (c) => c.code === code,
        );
        return m?.name;
      }
    } catch {
    }
    return undefined;
  };

  const rab = useMemo(() => {
    const base = summarizeRab(proposal ?? null, kkNameResolver, eligibleKkCodesSet);

    let prepSum = 0;
    let prepItems = 0;
    if (prepBundle && Array.isArray(prepBundle.groups) && prepBundle.groups.length > 0) {
      for (const g of prepBundle.groups) {
        if (!Array.isArray(g?.items)) continue;
        for (const it of g.items) {
          const q = Math.max(0, Number(it?.quantity) || 0);
          const p = Math.max(0, Number(it?.unitPrice) || 0);
          prepSum += q * p;
          if (q > 0 || p > 0) prepItems += 1;
        }
      }
    }
    if (prepSum > 0 || prepItems > 0) {
      base.totalPersiapan = prepSum;
      base.itemCountPersiapan = prepItems;
    }

    let trainSum = 0;
    let trainItems = 0;
    if (trainBundle && Array.isArray(trainBundle.costs) && trainBundle.costs.length > 0) {
      for (const tc of trainBundle.costs) {
        const req = tc?.requiresTraining === true;
        const unitP = Math.max(0, Number(tc?.unitPrice) || 0);
        const tCalc = req ? Math.ceil((unitP * 15) / 1000) : 0;
        trainSum += tCalc;
        if (req && unitP > 0) trainItems += 1;
      }
    }
    if (trainSum > 0 || trainItems > 0) {
      base.totalPelatihan = trainSum;
      base.itemCountPelatihan = trainItems;
    }

    return base;
  }, [proposal, prepBundle, trainBundle, eligibleKkCodesSet]);

  const cards = [
    {
      href: pathPersiapan,
      eyebrow: "Tahap 1",
      title: "Persiapan",
      subtitle: "Biaya Administratif & Pelaporan",
      description:
        "Rapat Koordinasi, Pendataan KK, Penyusunan LPJ 0%/50%/100%, dan Pertanggungjawaban Pelaporan Keuangan.",
      icon: ClipboardList,
      accent: "from-emerald-100 to-emerald-50 text-emerald-900 border-emerald-200",
      dotAccent: "bg-emerald-500",
      metric: isAnyLoading ? null : rab.itemCountPersiapan > 0 ? `${rab.itemCountPersiapan} butir` : "Belum ada data",
      amount: isAnyLoading ? null : rab.totalPersiapan > 0 ? IDR.format(rab.totalPersiapan) : null,
    },
    {
      href: pathSurvey,
      eyebrow: "Tahap 2",
      title: "Survey Harga",
      subtitle: "Perbandingan Harga 3 Toko per Alat",
      description:
        "Isi harga satuan, ongkos kirim, dan pasang untuk setiap alat per KK dari minimal 3 toko online SIPLah / marketplace.",
      icon: FileSearch,
      accent: "from-rose-100 to-rose-50 text-rose-900 border-rose-200",
      dotAccent: "bg-rose-500",
      metric: isAnyLoading ? null : rab.itemCountAlat > 0 ? `${rab.itemCountAlat} baris alat` : "Belum ada survey",
      amount: isAnyLoading ? null : rab.totalAlatSurvey > 0 ? IDR.format(rab.totalAlatSurvey) : null,
    },
    {
      href: pathRpkp,
      eyebrow: "Tahap 3",
      title: "RPKP",
      subtitle: "Rencana Pemenuhan Kebutuhan Peralatan",
      description:
        "Tentukan pilihan toko (Shop 1 / Shop 2 / Shop 3) untuk setiap alat per KK yang akan dijadikan dasar perhitungan RAB final.",
      icon: FileSpreadsheet,
      accent: "from-indigo-100 to-indigo-50 text-indigo-900 border-indigo-200",
      dotAccent: "bg-indigo-500",
      metric: isAnyLoading
        ? null
        : rab.kkCount > 0
          ? `${rab.kkCount} KK · ${Object.keys(proposal?.rpkpSelections ?? {}).length || 0} tabel`
          : "Belum dipilih",
      amount: isAnyLoading ? null : rab.totalAlatRpkp > 0 ? IDR.format(rab.totalAlatRpkp) : null,
    },
    {
      href: pathPelatihan,
      eyebrow: "Tahap 4",
      title: "Pelatihan",
      subtitle: "Biaya Pendukung Uji Fungsi & Bimtek",
      description:
        "Estimasi 1,5% per item alat yang membutuhkan pendukung uji fungsi, pelatihan penggunaan, dan pra-bimtek guru.",
      icon: GraduationCap,
      accent: "from-sky-100 to-sky-50 text-sky-900 border-sky-200",
      dotAccent: "bg-sky-500",
      metric: isAnyLoading ? null : rab.itemCountPelatihan > 0 ? `${rab.itemCountPelatihan} pos` : "Belum ada data",
      amount: isAnyLoading ? null : rab.totalPelatihan > 0 ? IDR.format(rab.totalPelatihan) : null,
    },
  ] as const;

  const grandFinal =
    rab.totalAlatRpkpChosen > 0
      ? rab.totalAlatRpkpChosen + rab.totalPersiapan + rab.totalPelatihan
      : rab.totalPersiapan + rab.totalPelatihan;
  const hasAnyPersistedData =
    rab.kkCount > 0 ||
    rab.itemCountPersiapan > 0 ||
    rab.itemCountPelatihan > 0 ||
    rab.totalAlatSurvey > 0 ||
    rab.totalAlatRpkp > 0 ||
    rab.totalPersiapan > 0 ||
    rab.totalPelatihan > 0;

  const paguTotalMax = Number(pagu?.data?.pagu?.total ?? 0);
  const paguAlatMax = Number(pagu?.data?.pagu?.alat ?? 0);
  const paguPersiapanMax = Number(pagu?.data?.pagu?.persiapan ?? 0);
  const paguPelatihanMax = Number(pagu?.data?.pagu?.pelatihan ?? 0);

  const totalTerpakai = grandFinal;
  const totalSisa = paguTotalMax > 0 ? paguTotalMax - totalTerpakai : 0;
  const totalOver = paguTotalMax > 0 && totalTerpakai > paguTotalMax;

  const alatTerpakai = rab.totalAlatRpkpChosen;
  const alatSisa = paguAlatMax > 0 ? paguAlatMax - alatTerpakai : 0;
  const alatOver = paguAlatMax > 0 && alatTerpakai > paguAlatMax;
  const alatPct = paguAlatMax > 0 ? Math.max(0, Math.min(100, (alatTerpakai / paguAlatMax) * 100)) : 0;

  const persiapanTerpakai = rab.totalPersiapan;
  const persiapanSisa = paguPersiapanMax > 0 ? paguPersiapanMax - persiapanTerpakai : 0;
  const persiapanOver = paguPersiapanMax > 0 && persiapanTerpakai > paguPersiapanMax;
  const persiapanPct = paguPersiapanMax > 0 ? Math.max(0, Math.min(100, (persiapanTerpakai / paguPersiapanMax) * 100)) : 0;

  const pelatihanTerpakai = rab.totalPelatihan;
  const pelatihanSisa = paguPelatihanMax > 0 ? paguPelatihanMax - pelatihanTerpakai : 0;
  const pelatihanOver = paguPelatihanMax > 0 && pelatihanTerpakai > paguPelatihanMax;
  const pelatihanPct = paguPelatihanMax > 0 ? Math.max(0, Math.min(100, (pelatihanTerpakai / paguPelatihanMax) * 100)) : 0;

  const totalPct = paguTotalMax > 0 ? Math.max(0, Math.min(100, (totalTerpakai / paguTotalMax) * 100)) : 0;

  const statusLabel =
    !hasAnyPersistedData
      ? { text: "Draf Awal", className: "bg-slate-100 text-slate-700 border-slate-200", Icon: Clock4 }
      : grandFinal > 0
        ? { text: "Dalam Penyusunan", className: "bg-amber-100 text-amber-800 border-amber-200", Icon: AlertTriangle }
        : { text: "Siap Diserahkan", className: "bg-emerald-100 text-emerald-800 border-emerald-200", Icon: CheckCircle2 };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
            Pusat Data Pengajuan Sarana Sekolah
          </p>
          <h1 className="display-font text-3xl font-semibold text-slate-950">
            Data Pengajuan Sarana Sekolah
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Lengkapi 4 tahapan pengajuan berikut secara berurutan, lalu lihat ringkasan Rencana Anggaran
            Belanja (RAB) keseluruhan sekolah di panel bawah.
          </p>
          {npsn && (
            <p className="font-mono text-xs text-slate-500">
              Mode Lihat Sekolah · NPSN <span className="font-semibold text-slate-800">{npsn}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={backHref}>
            <Button variant="outline" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              <span>Kembali ke Dashboard</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Card Utama (Compact Layout) */}
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="group block">
            <Card
              className={`h-full overflow-hidden border bg-gradient-to-br ${c.accent} transition-all duration-150 group-hover:-translate-y-0.5 group-hover:shadow-md active:translate-y-0`}
            >
              <CardContent className="flex h-full flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/75 shadow-sm ring-1 ring-black/5">
                      <c.icon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${c.dotAccent}`} />
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-75">
                          {c.eyebrow}
                        </span>
                      </div>
                      <h2 className="truncate text-[15px] font-semibold leading-tight text-slate-950">
                        {c.title}
                      </h2>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-white/75 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] opacity-80 shadow-sm ring-1 ring-black/5 transition group-hover:bg-white group-hover:opacity-100">
                    Buka →
                  </span>
                </div>

                <div className="mt-1 rounded-lg bg-white/50 px-2 py-1.5 ring-1 ring-black/5">
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-[9.5px] font-semibold uppercase tracking-[0.15em] opacity-60">
                        Resume
                      </p>
                      {isAnyLoading ? (
                        <p className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                          <Loader2 className="h-3 w-3 animate-spin opacity-60" />
                          Memuat
                        </p>
                      ) : (
                        <p className="truncate text-xs font-semibold text-slate-900">{c.metric}</p>
                      )}
                    </div>
                    {c.amount ? (
                      <p className="shrink-0 text-right text-[13px] font-bold leading-none text-slate-950">
                        {c.amount.replace("Rp", "Rp").replace(/,00$/, "")}
                      </p>
                    ) : (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide opacity-50">
                        Rp 0
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Detail RAB Card */}
      <Card className="overflow-hidden rounded-[28px] border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.03)]">
        <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 bg-gradient-to-br from-emerald-50 via-white to-white px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200">
              <Wallet className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="display-font text-xl font-semibold text-slate-950">
                  Detail RAB
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`gap-1.5 border ${statusLabel.className}`}
                >
                  <statusLabel.Icon className="h-3 w-3" />
                  {statusLabel.text}
                </Badge>
              </div>
              <CardDescription className="text-sm leading-6 text-slate-600">
                Ringkasan Rencana Anggaran Belanja (RAB) pengajuan sarana seluruh Konsentrasi Keahlian di
                sekolah ini dihitung otomatis dari pilihan RPKP + Biaya Persiapan + Biaya Pelatihan.
              </CardDescription>
            </div>
          </div>

          <div className={`rounded-2xl border px-4 py-3 shadow-sm ring-1 ${totalOver ? "border-red-200 bg-red-50/90 ring-red-100" : "border-emerald-200 bg-white/90 ring-emerald-100"}`}>
            <div className="flex items-center gap-1.5">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${totalOver ? "text-red-700" : "text-emerald-700"}`}>
                Total Anggaran
              </p>
              {pagu?.data?.setByAdmin?.id ? (
                <Badge variant="outline" className="h-4 px-1 text-[9px] border-emerald-300 text-emerald-700 bg-emerald-50">
                  Pagu Dinas
                </Badge>
              ) : null}
            </div>
            <p className={`display-font mt-1 text-2xl font-bold leading-none ${totalOver ? "text-red-900" : "text-emerald-900"}`}>
              {isPaguLoading || isAnyLoading
                ? "—"
                : paguTotalMax > 0
                  ? IDR.format(paguTotalMax)
                  : grandFinal > 0
                    ? IDR.format(grandFinal)
                    : "Rp 0"}
            </p>
            {paguTotalMax > 0 ? (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] text-slate-500">
                  Batas maksimum pagu Dinas (tidak dapat diubah sekolah)
                </p>
                <div className="flex items-end justify-between gap-2 text-[10px] font-medium">
                  <div className="space-y-0.5">
                    <p className="text-slate-600">
                      Terpakai: <span className="font-semibold text-slate-800">{IDR.format(totalTerpakai)}</span>
                    </p>
                  </div>
                  <div className="text-right space-y-0.5">
                    {totalOver ? (
                      <p className="text-red-700">
                        Melebihi: <span className="font-semibold">{IDR.format(Math.abs(totalSisa))}</span>
                      </p>
                    ) : (
                      <p className="text-emerald-700">
                        Sisa Kuota: <span className="font-semibold">{IDR.format(totalSisa)}</span>
                      </p>
                    )}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 mt-1">
                  <div
                    className={`h-full rounded-full ${totalOver ? "bg-gradient-to-r from-red-400 to-red-600" : totalPct >= 90 ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-emerald-400 to-emerald-600"}`}
                    style={{ width: `${Math.max(4, totalPct)}%` }}
                  />
                </div>
                <p className="text-right text-[9.5px] font-semibold text-slate-500 tracking-wide">
                  {totalPct.toFixed(1)}% dari pagu
                </p>
              </div>
            ) : (
              <p className="mt-1 text-[10px] text-slate-500">
                Belum ada pagu ditetapkan Dinas untuk sekolah ini.
              </p>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 px-6 py-6">
          {isAnyLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin opacity-60" />
              Memuat ringkasan RAB...
            </div>
          ) : !hasAnyPersistedData ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              Belum ada data pengajuan tersimpan. Mulai dari <b>Survey Harga</b> di atas terlebih dahulu,
              simpan, lalu kembali ke halaman ini untuk melihat ringkasan RAB.
            </div>
          ) : (
            <>
              {/* 3 kolom rangkuman */}
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" />
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700">
                      Nilai Alat (RPKP)
                    </p>
                  </div>
                  <p className="display-font mt-2 flex flex-wrap items-baseline gap-1.5 text-xl font-semibold text-indigo-950">
                    {rab.totalAlatRpkpChosen > 0 ? (
                      <>
                        <span>{IDR.format(rab.totalAlatRpkpChosen)}</span>
                        <span className="text-xs font-normal text-indigo-700">(Sudah Dipilih Toko)</span>
                      </>
                    ) : rab.totalAlatRpkp > 0 ? (
                      <>
                        <span>Rp 0</span>
                        <span className="text-xs font-normal text-amber-700">(Belum ada pilihan toko · Estimasi survey {IDR.format(rab.totalAlatSurvey)})</span>
                      </>
                    ) : rab.totalAlatSurvey > 0 ? (
                      <>
                        <span>Rp 0</span>
                        <span className="text-xs font-normal text-amber-700">(Menunggu tahap RPKP pilih toko · Survey {IDR.format(rab.totalAlatSurvey)})</span>
                      </>
                    ) : (
                      "Rp 0"
                    )}
                  </p>
                  <p className="mt-1 text-xs text-indigo-700/80">
                    {rab.totalAlatRpkpChosen > 0
                      ? `${rab.itemCountAlatRpkpChosen} item terpilih · ${rab.kkCount} KK`
                      : rab.kkCount > 0
                        ? `Sudah diajukan ${rab.kkCount} KK — Pilih toko per item di modul RPKP agar nilai final keluar.`
                        : "Pilih toko per item di modul RPKP agar nilai final keluar."}
                  </p>
                  {paguAlatMax > 0 ? (
                    <div className="mt-3 pt-3 border-t border-indigo-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <div className="space-y-0.5">
                          <p className="text-indigo-700">
                            Batas Pagu: <span className="font-semibold">{IDR.format(paguAlatMax)}</span>
                          </p>
                          <p className="text-slate-600">
                            Terpakai: <span className="font-semibold text-slate-800">{IDR.format(alatTerpakai)}</span>
                          </p>
                        </div>
                        <div className="text-right space-y-0.5">
                          {alatOver ? (
                            <p className="text-red-700 font-medium">
                              Melebihi: <span className="font-semibold">{IDR.format(Math.abs(alatSisa))}</span>
                            </p>
                          ) : (
                            <p className="text-emerald-700">
                              Sisa: <span className="font-semibold">{IDR.format(alatSisa)}</span>
                            </p>
                          )}
                          <p className="text-[9.5px] text-slate-500 font-semibold tracking-wide">
                            {alatPct.toFixed(1)}% dari pagu
                          </p>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full rounded-full ${alatOver ? "bg-gradient-to-r from-red-400 to-red-600" : alatPct >= 90 ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-indigo-400 to-indigo-600"}`}
                          style={{ width: `${Math.max(4, alatPct)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      Biaya Persiapan
                    </p>
                  </div>
                  <p className="display-font mt-2 text-xl font-semibold text-emerald-950">
                    {rab.totalPersiapan > 0 ? IDR.format(rab.totalPersiapan) : "Rp 0"}
                  </p>
                  <p className="mt-1 text-xs text-emerald-700/80">
                    {rab.itemCountPersiapan > 0
                      ? `${rab.itemCountPersiapan} butir item administratif & pelaporan`
                      : "Isi item Biaya Persiapan di modul Persiapan."}
                  </p>
                  {paguPersiapanMax > 0 ? (
                    <div className="mt-3 pt-3 border-t border-emerald-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <div className="space-y-0.5">
                          <p className="text-emerald-700">
                            Batas Pagu: <span className="font-semibold">{IDR.format(paguPersiapanMax)}</span>
                          </p>
                          <p className="text-slate-600">
                            Terpakai: <span className="font-semibold text-slate-800">{IDR.format(persiapanTerpakai)}</span>
                          </p>
                        </div>
                        <div className="text-right space-y-0.5">
                          {persiapanOver ? (
                            <p className="text-red-700 font-medium">
                              Melebihi: <span className="font-semibold">{IDR.format(Math.abs(persiapanSisa))}</span>
                            </p>
                          ) : (
                            <p className="text-emerald-700">
                              Sisa: <span className="font-semibold">{IDR.format(persiapanSisa)}</span>
                            </p>
                          )}
                          <p className="text-[9.5px] text-slate-500 font-semibold tracking-wide">
                            {persiapanPct.toFixed(1)}% dari pagu
                          </p>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full rounded-full ${persiapanOver ? "bg-gradient-to-r from-red-400 to-red-600" : persiapanPct >= 90 ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-emerald-400 to-emerald-600"}`}
                          style={{ width: `${Math.max(4, persiapanPct)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-sky-500" />
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                      Biaya Pelatihan
                    </p>
                  </div>
                  <p className="display-font mt-2 text-xl font-semibold text-sky-950">
                    {rab.totalPelatihan > 0 ? IDR.format(rab.totalPelatihan) : "Rp 0"}
                  </p>
                  <p className="mt-1 text-xs text-sky-700/80">
                    {rab.itemCountPelatihan > 0
                      ? `${rab.itemCountPelatihan} pos uji fungsi & bimtek`
                      : "Atur item Pelatihan di modul Pelatihan (1,5% per alat)."}
                  </p>
                  {paguPelatihanMax > 0 ? (
                    <div className="mt-3 pt-3 border-t border-sky-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <div className="space-y-0.5">
                          <p className="text-sky-700">
                            Batas Pagu: <span className="font-semibold">{IDR.format(paguPelatihanMax)}</span>
                          </p>
                          <p className="text-slate-600">
                            Terpakai: <span className="font-semibold text-slate-800">{IDR.format(pelatihanTerpakai)}</span>
                          </p>
                        </div>
                        <div className="text-right space-y-0.5">
                          {pelatihanOver ? (
                            <p className="text-red-700 font-medium">
                              Melebihi: <span className="font-semibold">{IDR.format(Math.abs(pelatihanSisa))}</span>
                            </p>
                          ) : (
                            <p className="text-emerald-700">
                              Sisa: <span className="font-semibold">{IDR.format(pelatihanSisa)}</span>
                            </p>
                          )}
                          <p className="text-[9.5px] text-slate-500 font-semibold tracking-wide">
                            {pelatihanPct.toFixed(1)}% dari pagu
                          </p>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white">
                        <div
                          className={`h-full rounded-full ${pelatihanOver ? "bg-gradient-to-r from-red-400 to-red-600" : pelatihanPct >= 90 ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-sky-400 to-sky-600"}`}
                          style={{ width: `${Math.max(4, pelatihanPct)}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Per KK breakdown jika ada */}
              {rab.perKk.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Rincian RAB per Konsentrasi Keahlian</p>
                      <p className="text-xs text-slate-500">
                        Berdasarkan pilihan toko di RPKP — klik "Buka →" pada card RPKP untuk mengubah.
                      </p>
                    </div>
                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                      {rab.perKk.length} KK
                    </Badge>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {rab.perKk.slice(0, 6).map((kk) => {
                      const isOpen = expandedKks.has(kk.key);
                      return (
                        <div key={kk.key} className="text-sm">
                          <button
                            type="button"
                            onClick={() => toggleKkExpand(kk.key)}
                            className="grid w-full grid-cols-12 items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50"
                          >
                            <div className="col-span-12 flex items-center justify-between gap-3 md:col-span-7">
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="flex h-8 min-w-[3.5rem] shrink-0 items-center justify-center rounded-xl bg-slate-100 px-2 font-mono text-[10.5px] font-semibold tracking-tight text-slate-700">
                                  {kk.code || "—"}
                                </span>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-slate-900">
                                    {kk.name || kk.code}
                                  </p>
                                  <p className="truncate text-xs text-slate-500">
                                    {kk.chosenRows > 0 && kk.rows > 0 ? (
                                      <span className="text-emerald-700 font-medium">
                                        ✅ {kk.chosenRows} dari {kk.rows} item sudah dipilih toko
                                      </span>
                                    ) : kk.rows > 0 ? (
                                      <span className="text-amber-700 font-medium">
                                        ⏳ {kk.rows} item diajukan · Belum ada yang dipilih toko
                                      </span>
                                    ) : (
                                      "Belum ada item"
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500">
                                {isOpen ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </div>
                            </div>
                            <div className="col-span-12 flex items-center justify-between gap-3 md:col-span-5 md:justify-end">
                              <div className="flex flex-1 items-center gap-2 md:flex-none md:justify-end">
                                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 md:w-40 md:flex-none">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-indigo-500"
                                    style={{
                                      width: `${Math.max(
                                        4,
                                        Math.min(100, (kk.total / (grandFinal || kk.total || 1)) * 100),
                                      )}%`,
                                    }}
                                  />
                                </div>
                              </div>
                              <p className="display-font whitespace-nowrap text-right text-base font-semibold text-slate-950 md:w-44">
                                {kk.total > 0 ? IDR.format(kk.total) : "Rp 0"}
                              </p>
                            </div>
                          </button>
                          {isOpen ? (
                            kk.items && kk.items.length > 0 ? (
                            <div className="border-t border-dashed border-slate-200 bg-slate-50/60 px-5 py-4">
                              <div className="overflow-x-auto">
                                <table className="min-w-full border-separate border-spacing-0 text-xs">
                                  <thead>
                                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500">
                                      <th className="w-12 px-2 py-2 font-semibold">No</th>
                                      <th className="px-2 py-2 font-semibold">Nama Alat</th>
                                      <th className="max-w-[240px] px-2 py-2 font-semibold">Spesifikasi</th>
                                      <th className="w-16 px-2 py-2 text-right font-semibold">Jumlah</th>
                                      <th className="w-28 px-2 py-2 font-semibold">Satuan</th>
                                      <th className="w-40 px-2 py-2 font-semibold">Pilihan Toko</th>
                                      <th className="w-36 px-2 py-2 text-right font-semibold">Harga Satuan</th>
                                      <th className="w-40 px-2 py-2 text-right font-semibold">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {kk.items.map((it) => (
                                      <tr
                                        key={it.id}
                                        className="border-t border-slate-200/70 align-top text-slate-800"
                                      >
                                        <td className="px-2 py-2 text-[11px] font-mono text-slate-500">
                                          {it.no}
                                        </td>
                                        <td className="px-2 py-2 font-medium text-slate-900">
                                          {it.name}
                                        </td>
                                        <td className="max-w-[240px] truncate px-2 py-2 text-slate-600" title={it.specification}>
                                          {it.specification || "—"}
                                        </td>
                                        <td className="px-2 py-2 text-right tabular-nums text-slate-900">
                                          {it.quantity.toLocaleString("id-ID")}
                                        </td>
                                        <td className="px-2 py-2 text-slate-700">
                                          {it.unit || "unit"}
                                        </td>
                                        <td className="px-2 py-2">
                                          <div className="flex flex-col gap-0.5">
                                            <span
                                              className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                                                it.selectedShop === "shop1"
                                                  ? "bg-emerald-100 text-emerald-800"
                                                  : it.selectedShop === "shop2"
                                                    ? "bg-sky-100 text-sky-800"
                                                    : it.selectedShop === "shop3"
                                                      ? "bg-amber-100 text-amber-800"
                                                      : "bg-slate-100 text-slate-600"
                                              }`}
                                            >
                                              {it.selectedShop ? it.selectedShopName : "Belum Pilih"}
                                            </span>
                                            {it.selectedShop ? (
                                              <span className="text-[10px] text-slate-500">
                                                {it.selectedShop === "shop1" ? "Sumber: Toko 1" : it.selectedShop === "shop2" ? "Sumber: Toko 2" : "Sumber: Toko 3"}
                                              </span>
                                            ) : null}
                                          </div>
                                        </td>
                                        <td className="px-2 py-2 text-right tabular-nums text-slate-900">
                                          {it.hargaSatuan > 0 ? IDR.format(it.hargaSatuan) : "—"}
                                        </td>
                                        <td className="px-2 py-2 text-right font-semibold tabular-nums text-slate-950">
                                          {it.subtotal > 0 ? IDR.format(it.subtotal) : "Rp 0"}
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="border-t-2 border-slate-200 bg-white text-sm">
                                      <td
                                        colSpan={7}
                                        className="px-2 py-2 text-right font-semibold text-slate-800"
                                      >
                                        Total {kk.name || kk.code}
                                      </td>
                                      <td className="px-2 py-2 text-right font-bold text-slate-950">
                                        {kk.total > 0 ? IDR.format(kk.total) : "Rp 0"}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <div className="border-t border-dashed border-slate-200 bg-amber-50/60 px-5 py-5">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200">
                                    <Clock4 className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-amber-900">
                                      Belum ada alat yang dipilih tokonya di Konsentrasi Keahlian ini
                                    </p>
                                    <p className="mt-0.5 text-xs text-amber-800/90 leading-6">
                                      Detail RAB hanya menampilkan item yang <b>sudah dipilih toko (Toko 1 / 2 / 3)</b> di menu RPKP.
                                      {kk.rows > 0 ? ` Tersisa ${kk.rows} item lagi untuk ditentukan pilihan tokonya.` : ""}
                                    </p>
                                  </div>
                                </div>
                                <Link href={pathRpkp}>
                                  <Button variant="outline" size="sm" className="shrink-0 gap-1 border-amber-300 bg-white text-amber-800 hover:bg-amber-50 hover:text-amber-900">
                                    <Wrench className="h-4 w-4" />
                                    <span>Buka RPKP → Pilih Toko</span>
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          )
                          ) : null}
                        </div>
                      );
                    })}
                    {rab.perKk.length > 6 ? (
                      <div className="px-5 py-2 text-xs text-slate-500">
                        + {rab.perKk.length - 6} konsentrasi lainnya — lihat rincian lengkap di modul{" "}
                        <Link href={pathRpkp} className="font-semibold text-primary hover:underline">
                          RPKP
                        </Link>.
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Footer meta */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-slate-200 pt-4 text-xs text-slate-500">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    Versi data:{" "}
                    <span className="font-mono font-semibold text-slate-700">
                      v{proposal?.version ?? 1}
                    </span>
                  </span>
                  {proposal?.updatedAt ? (
                    <span>
                      Update terakhir:{" "}
                      <span className="font-semibold text-slate-700">
                        {new Date(proposal.updatedAt).toLocaleString("id-ID")}
                      </span>
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  <Wrench className="h-3 w-3" />
                  <span>Pusat Data Pengajuan Sarana · {npsn || "—"}</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
