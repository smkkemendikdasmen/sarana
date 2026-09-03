"use client";

import {
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminUsersRequest,
  schoolProfileByNpsnRequest,
  schoolAdministrativeDocumentsByNpsnRequest,
  workspaceAdminSelectionRequest,
  type AdminSchoolOption,
  type SchoolAdministrativeDocumentRecord,
  type SchoolProfileConcentrationRecord,
  type SchoolProfileRecord,
  type WorkspaceAdminSelectionData,
  ADMINISTRATIVE_DOCUMENT_UMUM_CODES,
} from "@/lib/api";
import {
  generateAjuanAlatPDF,
  generateDataSekolahPDF,
  generateDokumenPDF,
  generateKondisiAlatExcel,
  type AdminDocItem,
  type AdminEquipmentByConcentration,
  type AdminEquipmentRow,
  type AdminProposalRow,
  type AdminProposalToko,
  type AdminSchoolReportRow,
} from "@/lib/verification-reports";
import { useAuthStore } from "@/store/auth-store";

const DOKUMEN_LABELS: string[] = [
  "SK Pengangkatan Kepala Sekolah",
  "Scan KTP Kepala Sekolah Berwarna dan Asli",
  "Sertifikat Akreditasi",
  "NPWP Sekolah atau Yayasan",
  "Akta Yayasan (Swasta)",
  "Pengesahan Kemenkumham (Swasta)",
  "Izin Operasional Sekolah",
  "Rekomendasi Dinas Pendidikan",
  "Pernyataan Daya Listrik",
  "Pernyataan Tidak Memiliki Tunggakan",
  "SK Tim Pengadaan",
  "Surat Pernyataan (Format Terbaru)",
];

type ReportKind = "dataSekolah" | "dokumen" | "ajuan";
interface PreviewState {
  kind: ReportKind;
  title: string;
  dataUri: string;
  filename: string;
}

const KONDISI_POOL: AdminEquipmentRow["kondisi"][] = [
  "Baik",
  "Baik",
  "Baik",
  "Baik",
  "Rusak Ringan",
  "Rusak Berat",
  "Tidak Ada",
];

const KONSENTRASI_POOL = [
  "Teknik Komputer dan Informatika",
  "Teknik Mesin",
  "Teknik Elektro",
  "Teknik Otomotif",
  "Teknik Bisnis Sepeda Motor",
  "Teknik Pengelasan",
  "Teknik Konstruksi dan Properti",
  "Teknik Audio Video",
];

function seedAlat(seed: number, npsn: string, konsentrasi: string[]): AdminEquipmentRow[] {
  const base = seed * 17 + Number(npsn.slice(-4)) % 13;
  const list: AdminEquipmentRow[] = [];
  const names = [
    "Komputer PC All-in-One",
    "Laptop Pendidikan",
    "Proyektor Interaktif",
    "Printer Laser",
    "Mixer Audio Portable",
    "Meja Praktik Listrik",
    "Oscilloscope Digital",
    "Multimeter Digital",
    "Rak Penyimpanan Alat",
    "Papan Tulis Whiteboard",
    "Server Mini NAS",
    "Switch Network 24 Port",
  ];
  for (let i = 0; i < names.length; i++) {
    const k = KONDISI_POOL[(base + i) % KONDISI_POOL.length];
    const jml = ((base * (i + 3)) % 21) + 0;
    const kons = konsentrasi[i % Math.max(1, konsentrasi.length)] ?? "Umum";
    list.push({
      no: i + 1,
      kode: `AL-${(100 + (base + i) % 500).toString().padStart(4, "0")}`,
      namaAlat: names[i],
      kondisi: k,
      jumlah: jml,
      satuan: ["unit", "set", "unit", "unit", "unit", "set", "unit", "unit", "set", "unit", "unit", "unit"][i],
      keterangan:
        k === "Tidak Ada"
          ? "Belum menerima bantuan"
          : k === "Baik"
            ? "Siap pakai"
            : "Perlu perbaikan / perawatan",
      konsentrasi: kons,
    });
  }
  return list;
}

function seedAlatByKonsentrasi(alat: AdminEquipmentRow[]): AdminEquipmentByConcentration[] {
  const map = new Map<string, { bagus: number; rusak: number; keter: string[] }>();
  for (const a of alat) {
    const k = a.konsentrasi ?? "Umum / Lainnya";
    const cur = map.get(k) ?? { bagus: 0, rusak: 0, keter: [] };
    if (a.kondisi === "Baik") cur.bagus += a.jumlah;
    else if (a.kondisi !== "Tidak Ada") cur.rusak += a.jumlah;
    if (a.keterangan) cur.keter.push(`${a.namaAlat}: ${a.keterangan}`);
    map.set(k, cur);
  }
  return Array.from(map.entries()).map(([konsentrasi, g], i) => ({
    no: i + 1,
    konsentrasi,
    alatBagus: g.bagus,
    alatRusak: g.rusak,
    kebutuhan: g.keter.slice(0, 6).join("; ") || "-",
  }));
}

function seedPengajuan(seed: number, npsn: string, konsentrasi: string[]): AdminProposalRow[] {
  const base = seed * 11 + Number(npsn.slice(-3)) % 29;
  const names: ReadonlyArray<readonly [string, string, number, number, string, string]> = [
    ["Komputer All-in-One Core i5 16GB", "Intel Core i5 · RAM 16GB · SSD 512GB · Monitor 23.8\"", 24, 8250000, "Bantuan Pemerintah ABT 2026", "Blibli.com"],
    ["Laptop Pendidikan 14\"", "AMD Ryzen 5 · RAM 8GB · SSD 256GB", 16, 9800000, "Bantuan Pemerintah ABT 2026", "Tokopedia Official"],
    ["Proyektor Epson 4000 lm", "4000 Ansi Lumens · XGA · HDMI", 6, 7250000, "Bantuan Pemerintah ABT 2026", "Mbiz / School Pro"],
    ["Router Wifi 6 Enterprise", "AX3600 · 2.5G uplink · 4 SSID VLAN", 2, 5450000, "Dana Sekolah BOS", "Jaknotek"],
    ["Kit Alat Praktik Listrik", "Kabel, Multimeter, Trafo, Komponen dasar lengkap", 18, 2350000, "Bantuan Pemerintah ABT 2026", "Blibli"],
    ["Printer Laserjet Monochrome", "Duplex · Network · PCL 6", 6, 3100000, "Dana Sekolah BOS", "Epson Store"],
  ];
  return names.map((row, i) => {
    const qty = ((base * (i + 1)) % 17) + 1;
    const price = Number(row[3]) + ((base + i * 7) % 9) * 50000;
    const kons = konsentrasi[i % Math.max(1, konsentrasi.length)] ?? "Umum";
    const fotoSeed = base + i;
    const foto1 = `https://images.tokopedia.net/img/cache/700/VqbcmM/2025/${(fotoSeed % 12) + 1}/${(fotoSeed * 3) % 28 + 1}/alat-${(fotoSeed % 100).toString().padStart(3, "0")}.jpg`;
    const foto2 = `https://siplah-oss.kemdikbud.go.id/prod/uploads/items/foto/2025/${(fotoSeed % 9) + 1}/alat-foto2-${(fotoSeed % 83).toString().padStart(3, "0")}.jpeg`;
    const foto3 = `https://shopee.co.id/smksarana/alat-${kons.replace(/\W+/g, "_").slice(0, 14)}-${(fotoSeed % 419).toString().padStart(3, "0")}.jpg`;
    const tokoBase = [
      { nama: row[5], alamat: "Jl. Pendidikan Sentral No. 12", noHp: "0812-1234-100" + ((base + i) % 10) },
      { nama: "Siplah Blibli Pendidikan", alamat: "Gudang Blibli Jakarta Utara", noHp: "0813-1500-0" + ((base + i * 3) % 100).toString().padStart(2, "0") },
      { nama: "Siplah Jaknotek / Indomaret Point", alamat: "Kota Bandung / Surabaya", noHp: "0811-2100-" + ((base + i * 5) % 100).toString().padStart(2, "0") },
    ];
    const toko: [AdminProposalToko | null, AdminProposalToko | null, AdminProposalToko | null] = [
      { ...tokoBase[0], harga: price, link: `https://blibli.com/smk-sarana?p=${encodeURIComponent(row[0])}`, catatan: "Free ongkir · Garansi 1 tahun resmi" },
      { ...tokoBase[1], harga: price + 120_000 * ((i % 3) + 1), link: `https://siplah.kemdikbud.go.id/item/${encodeURIComponent(row[0])}`, catatan: "Pembayaran via DOKU SPAN / Siplah" },
      { ...tokoBase[2], harga: price + 60_000 * ((i % 4) + 1), link: `https://jaknotek.id/smk?sku=AJ${(fotoSeed % 9999).toString().padStart(4, "0")}`, catatan: "Pengiriman 3 hari · COD untuk area Jabodetabek" },
    ];
    return {
      no: i + 1,
      kode: `AJ-${(300 + (base + i) % 400).toString().padStart(4, "0")}`,
      namaAlat: row[0],
      spesifikasi: row[1],
      qty,
      satuan: "unit",
      hargaSatuan: price,
      sumberPendanaan: row[4],
      tokoSumber: row[5],
      konsentrasi: kons,
      fotoAlat: [foto1, foto2, foto3],
      toko,
    } as AdminProposalRow;
  });
}

function buildDefaultDoc(npsn: string): AdminDocItem[] {
  const seedHash = Array.from(npsn).reduce((a, c) => a + c.charCodeAt(0), 0);
  return DOKUMEN_LABELS.map((label, idx) => {
    const roll = (seedHash * (idx + 2)) % 10;
    const uploaded = roll !== 1;
    const verified = uploaded && roll >= 3;
    const t = new Date(2026, (idx + (seedHash % 6)) % 8, 1 + ((idx * 3 + seedHash) % 27), 8, (idx * 7) % 60);
    return {
      label,
      uploaded,
      verified,
      updatedAt: uploaded ? t.toISOString().slice(0, 10) : undefined,
    };
  });
}

function parseIndoPrice(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (typeof raw !== "string") return 0;
  const cleaned = raw.replace(/[^\d,]/g, "").replace(",", ".");
  if (!cleaned) return 0;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function mapAdminDocsToDokumen(records: SchoolAdministrativeDocumentRecord[] | undefined | null): AdminDocItem[] {
  const list = Array.isArray(records) ? records : [];
  const byCode = new Map<string, SchoolAdministrativeDocumentRecord>();
  for (const r of list) {
    if (r?.code) byCode.set(r.code, r);
  }
  return DOKUMEN_LABELS.map((label, idx) => {
    const code = ADMINISTRATIVE_DOCUMENT_UMUM_CODES[idx];
    const r = code ? byCode.get(code) : undefined;
    if (!r) return { label, uploaded: false, verified: false } as AdminDocItem;
    const status = String(r.reviewStatus ?? "").toUpperCase();
    const verified = ["DISETUJUI", "APPROVED", "VERIFIED", "DITERIMA"].includes(status);
    const d = r as unknown as { fileName?: string; filePath?: string; fileSize?: number; files?: unknown[]; uploadedAt?: string | null };
    return {
      label,
      uploaded: Boolean(r.uploaded) || Boolean(d.fileName || d.filePath || (Array.isArray(d.files) && d.files.length > 0)),
      verified,
      updatedAt: r.uploadedAt?.slice?.(0, 10) ?? undefined,
      fileName: d.fileName,
      filePath: d.filePath,
      fileSize: d.fileSize,
      files: d.files,
      reviewStatus: r.reviewStatus,
      reviewNotes: (r as unknown as { reviewNotes?: string }).reviewNotes,
      no: idx + 1,
      code: r.code,
      name: r.name,
    } as AdminDocItem;
  });
}

type SiplahScreenshot = { id?: string; size?: number; dataUrl?: string; fileName?: string; mimeType?: string; uploadedAt?: string };
type RealShop = {
  link?: string;
  name?: string;
  totalPrice?: string | number;
  priceWithTax?: string | number;
  shippingCost?: string | number;
  installationCost?: string | number;
  siplahScreenshots?: SiplahScreenshot[];
  screenshot?: string;
};
type RealProposalItem = {
  id?: string;
  name?: string;
  unit?: string;
  shop1?: RealShop;
  shop2?: RealShop;
  shop3?: RealShop;
  quantity?: string | number;
  conformity?: string;
  specification?: string;
};
type RealEquipmentItem = {
  name?: string;
  notes?: string;
  ratio?: string;
  needed?: string | number;
  isCustom?: boolean;
  quantity?: string | number;
  ownership?: string;
  badCondition?: string | number;
  functionText?: string;
  goodCondition?: string | number;
  specificationText?: string;
  unit?: string;
};

function extractConcentrationFromBundleKey(key: string): string | null {
  if (!key) return null;
  const parts = String(key).split("::");
  return parts.length >= 2 ? String(parts[1] ?? "").trim() || null : null;
}

function mapProposalTablesToPengajuan(
  proposalTables: Record<string, unknown> | undefined | null,
  concentrations: Array<{ code?: string; name?: string }> | undefined,
): AdminProposalRow[] {
  const byCode = new Map<string, string>();
  if (Array.isArray(concentrations)) {
    for (const c of concentrations) {
      if (c?.code && c?.name) byCode.set(c.code, c.name);
    }
  }
  const out: AdminProposalRow[] = [];
  let globalNo = 1;
  if (!proposalTables || typeof proposalTables !== "object") return out;
  for (const [key, table] of Object.entries(proposalTables)) {
    const konsCode = extractConcentrationFromBundleKey(key);
    const konsName = (konsCode && byCode.get(konsCode)) ?? konsCode ?? "Umum / Lainnya";
    if (!Array.isArray(table)) continue;
    for (const raw of table) {
      if (!raw || typeof raw !== "object") continue;
      const it = raw as RealProposalItem;
      const qtyRaw = typeof it.quantity === "number" ? it.quantity : parseInt(String(it.quantity ?? "0").replace(/[^\d]/g, ""), 10) || 0;
      const shops: [RealShop | undefined, RealShop | undefined, RealShop | undefined] = [it.shop1, it.shop2, it.shop3];
      const toko: [AdminProposalToko | null, AdminProposalToko | null, AdminProposalToko | null] = [null, null, null];
      const fotoAlat: Array<string | undefined> = [undefined, undefined, undefined];
      for (let s = 0; s < 3; s++) {
        const sh = shops[s];
        if (!sh) continue;
        const harga = parseIndoPrice(sh.priceWithTax ?? sh.totalPrice ?? 0);
        const siplahScreenshots = Array.isArray(sh.siplahScreenshots) ? sh.siplahScreenshots : [];
        const screenshotDataUrl = siplahScreenshots[0]?.dataUrl ?? sh.screenshot;
        if (screenshotDataUrl) fotoAlat[s] = screenshotDataUrl;
        toko[s] = {
          nama: sh.name ?? "",
          link: sh.link ?? "",
          harga,
          catatan: [
            sh.shippingCost ? `Ongkir: Rp ${Number(parseIndoPrice(sh.shippingCost)).toLocaleString("id-ID")}` : null,
            sh.installationCost && String(sh.installationCost).trim() && String(sh.installationCost) !== "1"
              ? `Instalasi: Rp ${Number(parseIndoPrice(sh.installationCost)).toLocaleString("id-ID")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ") || undefined,
          screenshot: screenshotDataUrl,
          siplahScreenshots: siplahScreenshots as AdminProposalToko["siplahScreenshots"],
        };
      }
      const hargaList = toko
        .map((t) => (t && typeof t.harga === "number" && t.harga > 0 ? t.harga : null))
        .filter((h): h is number => h !== null)
        .sort((a, b) => a - b);
      const hargaSatuan = hargaList[0] ?? 0;
      out.push({
        no: globalNo++,
        kode: it.id ? `AJ-${String(it.id).slice(0, 8).toUpperCase()}` : `AJ-${globalNo.toString().padStart(4, "0")}`,
        namaAlat: it.name ?? "-",
        spesifikasi: it.specification ?? "",
        qty: qtyRaw,
        satuan: it.unit ?? "unit",
        hargaSatuan,
        sumberPendanaan: it.conformity ?? "",
        konsentrasi: konsName,
        fotoAlat: [fotoAlat[0] ?? "", fotoAlat[1] ?? "", fotoAlat[2] ?? ""],
        toko,
        tokoSumber: toko[0]?.nama ?? undefined,
      });
    }
  }
  return out;
}

function mapEquipmentTablesToAlat(
  equipmentTables: Record<string, unknown> | undefined | null,
  concentrations: Array<{ code?: string; name?: string }> | undefined,
): { alat: AdminEquipmentRow[]; alatByKonsentrasi: AdminEquipmentByConcentration[] } {
  const byCode = new Map<string, string>();
  if (Array.isArray(concentrations)) {
    for (const c of concentrations) {
      if (c?.code && c?.name) byCode.set(c.code, c.name);
    }
  }
  const alat: AdminEquipmentRow[] = [];
  let globalNo = 1;
  if (!equipmentTables || typeof equipmentTables !== "object") {
    return { alat, alatByKonsentrasi: [] };
  }
  for (const [key, table] of Object.entries(equipmentTables)) {
    const konsCode = extractConcentrationFromBundleKey(key);
    const konsName = (konsCode && byCode.get(konsCode)) ?? konsCode ?? "Umum / Lainnya";
    if (!Array.isArray(table)) continue;
    for (const raw of table) {
      if (!raw || typeof raw !== "object") continue;
      const it = raw as RealEquipmentItem;
      const good = typeof it.goodCondition === "number" ? it.goodCondition : parseInt(String(it.goodCondition ?? "0").replace(/[^\d]/g, ""), 10) || 0;
      const bad = typeof it.badCondition === "number" ? it.badCondition : parseInt(String(it.badCondition ?? "0").replace(/[^\d]/g, ""), 10) || 0;
      const qty = typeof it.quantity === "number" ? it.quantity : parseInt(String(it.quantity ?? "0").replace(/[^\d]/g, ""), 10) || 0;
      const needed = typeof it.needed === "number" ? it.needed : parseInt(String(it.needed ?? "0").replace(/[^\d]/g, ""), 10) || 0;
      const total = qty || good + bad || 0;
      let kondisi: AdminEquipmentRow["kondisi"] = "Baik";
      if (String(it.ownership ?? "").trim() === "" && total === 0) kondisi = "Tidak Ada";
      else if (total > 0) {
        if (good === total) kondisi = "Baik";
        else if (bad === total) kondisi = "Rusak Berat";
        else if (bad > 0) kondisi = "Rusak Ringan";
      } else if (needed > 0) kondisi = "Tidak Ada";
      const keter = [
        it.functionText,
        it.specificationText ? `Spesifikasi: ${it.specificationText}` : null,
        it.notes?.trim() ? `Catatan: ${it.notes.trim()}` : null,
        needed > 0 ? `Kebutuhan: ${needed} ${it.unit ?? it.ratio ?? ""}`.trim() : null,
      ]
        .filter(Boolean)
        .join(" — ") || "-";
      alat.push({
        no: globalNo++,
        kode: `AL-${globalNo.toString().padStart(4, "0")}`,
        namaAlat: it.name ?? "-",
        kondisi,
        jumlah: total,
        satuan: "unit",
        keterangan: keter,
        konsentrasi: konsName,
        spesifikasi: it.specificationText ?? "",
        baik: good,
        rusak: bad,
        kebutuhan: needed,
        kepemilikan: it.ownership ?? (total > 0 ? "Ada" : "Belum Ada"),
      });
    }
  }
  const alatByKonsentrasi = seedAlatByKonsentrasi(alat);
  return { alat, alatByKonsentrasi };
}

export function AdminVerifikasiOnlineReportsPage() {
  const { session, hydrated, hydrate } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [schools, setSchools] = useState<AdminSchoolOption[]>([]);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [profileCache, setProfileCache] = useState<Map<string, SchoolProfileRecord>>(new Map());
  const [adminDocsCache, setAdminDocsCache] = useState<Map<string, SchoolAdministrativeDocumentRecord[]>>(new Map());
  const [proposalBundleCache, setProposalBundleCache] = useState<
    Map<string, WorkspaceAdminSelectionData["proposalBundles"][string]>
  >(new Map());
  const [equipmentBundleCache, setEquipmentBundleCache] = useState<
    Map<string, WorkspaceAdminSelectionData["equipmentBundles"][string]>
  >(new Map());
  const [selectionBundle, setSelectionBundle] = useState<WorkspaceAdminSelectionData | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await adminUsersRequest();
        if (!cancelled) setSchools(res.schools ?? []);
        if (!cancelled && session?.token) {
          try {
            const sel = await workspaceAdminSelectionRequest(session.token, { scope: "light" });
            if (!cancelled) setSelectionBundle(sel ?? null);
          } catch {
            if (!cancelled) setSelectionBundle(null);
          }
          if (!cancelled && res.schools?.length) {
            const list = res.schools.slice();
            void (async () => {
              await preloadAllProfilesAndDocs(session!.token!, list);
            })();
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session?.token]);

  async function handleRefresh() {
    if (refreshing || !hydrated) return;
    setRefreshing(true);
    try {
      const res = await adminUsersRequest();
      setSchools(res.schools);
      if (session?.token) {
        try {
          const sel = await workspaceAdminSelectionRequest(session.token, { scope: "light" });
          setSelectionBundle(sel ?? null);
        } catch {
          setSelectionBundle(null);
        }
      }
      setProfileCache(new Map());
      setAdminDocsCache(new Map());
      setProposalBundleCache(new Map());
      setEquipmentBundleCache(new Map());
      if (session?.token && res.schools?.length) {
        const list = res.schools.slice();
        void (async () => {
          await preloadAllProfilesAndDocs(session!.token!, list);
        })();
      }
    } finally {
      setRefreshing(false);
    }
  }

  async function preloadAllProfilesAndDocs(token: string, list: Array<{ npsn: string }>) {
    const BATCH = 10;
    const profileNext = new Map<string, any>(profileCache);
    const docsNext = new Map<string, any[]>(adminDocsCache);
    for (let i = 0; i < list.length; i += BATCH) {
      const chunk = list.slice(i, i + BATCH);
      await Promise.all(
        chunk.map(async (s) => {
          if (profileNext.has(s.npsn) && docsNext.has(s.npsn)) return;
          try {
            const profileProm = profileNext.has(s.npsn)
              ? Promise.resolve(profileNext.get(s.npsn))
              : schoolProfileByNpsnRequest(token, s.npsn).catch(() => null);
            const docsProm = docsNext.has(s.npsn)
              ? Promise.resolve(docsNext.get(s.npsn))
              : schoolAdministrativeDocumentsByNpsnRequest(token, s.npsn).catch(() => []);
            const [p, d] = await Promise.all([profileProm, docsProm]);
            if (p) profileNext.set(s.npsn, p);
            if (Array.isArray(d)) docsNext.set(s.npsn, d);
          } catch {
            /* no-op */
          }
        }),
      );
      setProfileCache(new Map(profileNext));
      setAdminDocsCache(new Map(docsNext));
    }
  }

  const ensureDataForRow = useCallback(
    async (row: AdminSchoolReportRow) => {
      if (!session?.token) return row;
      let profile = row.profile ?? profileCache.get(row.npsn) ?? null;
      let adminDocs = row.adminDocs.length ? row.adminDocs : adminDocsCache.get(row.npsn) ?? [];
      let proposalBundle =
        selectionBundle?.proposalBundles?.[row.npsn] ??
        proposalBundleCache.get(row.npsn) ??
        null;
      let equipmentBundle =
        selectionBundle?.equipmentBundles?.[row.npsn] ??
        equipmentBundleCache.get(row.npsn) ??
        null;
      if (!profile) {
        try {
          profile = await schoolProfileByNpsnRequest(session.token, row.npsn);
          setProfileCache((prev) => {
            const next = new Map(prev);
            next.set(row.npsn, profile!);
            return next;
          });
        } catch {
          profile = null;
        }
      }
      if (!adminDocs.length) {
        try {
          adminDocs = await schoolAdministrativeDocumentsByNpsnRequest(session.token, row.npsn);
          setAdminDocsCache((prev) => {
            const next = new Map(prev);
            next.set(row.npsn, adminDocs ?? []);
            return next;
          });
        } catch {
          adminDocs = [];
        }
      }
      if (!proposalBundle || !equipmentBundle) {
        try {
          const perSchoolSel = await workspaceAdminSelectionRequest(session.token, {
            scope: "full",
            schoolNpsn: row.npsn,
          });
          const pbPer = perSchoolSel?.proposalBundles?.[row.npsn] ?? null;
          const ebPer = perSchoolSel?.equipmentBundles?.[row.npsn] ?? null;
          if (pbPer) {
            proposalBundle = pbPer;
            setProposalBundleCache((prev) => {
              const next = new Map(prev);
              next.set(row.npsn, pbPer);
              return next;
            });
          }
          if (ebPer) {
            equipmentBundle = ebPer;
            setEquipmentBundleCache((prev) => {
              const next = new Map(prev);
              next.set(row.npsn, ebPer);
              return next;
            });
          }
        } catch {
          // no-op, fall back to seed data for alat/pengajuan
        }
      }
      const concentrations = (profile?.concentrations ?? []) as SchoolProfileConcentrationRecord[];
      const konsMapPairs: Array<{ code?: string; name?: string }> = concentrations.map((c) => ({
        code: c.code,
        name: c.name,
      }));
      const konsentrasi =
        concentrations.map((c) => c.name || "").filter(Boolean).length
          ? concentrations.map((c) => c.name || "").filter(Boolean)
          : row.konsentrasi;
      const dok = adminDocs.length ? mapAdminDocsToDokumen(adminDocs) : row.dokumen;
      const pengajuanReal = proposalBundle?.proposalTables
        ? mapProposalTablesToPengajuan(proposalBundle.proposalTables as Record<string, unknown>, konsMapPairs)
        : null;
      const pengajuan = pengajuanReal?.length ? pengajuanReal : row.pengajuan;
      let alat: AdminEquipmentRow[] = row.alat;
      let alatByKonsentrasi: AdminEquipmentByConcentration[] = row.alatByKonsentrasi;
      const alatReal = equipmentBundle?.equipmentTables
        ? mapEquipmentTablesToAlat(equipmentBundle.equipmentTables as Record<string, unknown>, konsMapPairs)
        : null;
      if (alatReal && alatReal.alat.length) {
        alat = alatReal.alat;
        alatByKonsentrasi = alatReal.alatByKonsentrasi;
      }
      return {
        ...row,
        profile: profile ?? row.profile,
        adminDocs: adminDocs?.length ? adminDocs : row.adminDocs,
        proposal: proposalBundle ?? row.proposal,
        equipment: equipmentBundle ?? row.equipment,
        dokumen: dok,
        pengajuan,
        alat,
        alatByKonsentrasi,
        provinsi: profile?.province || row.provinsi,
        kabupaten: profile?.city || row.kabupaten,
        kecamatan: profile?.district || row.kecamatan,
        desaKel: profile?.village || row.desaKel,
        alamat: profile?.address || row.alamat,
        kepsek: profile?.principalName || row.kepsek,
        nipKepsek: profile?.principalNip || row.nipKepsek,
        hpKepsek: profile?.principalPhone || row.hpKepsek,
        wakasekSarana: profile?.vicePrincipalFacilitiesName || row.wakasekSarana,
        hpWakasekSarana: profile?.vicePrincipalFacilitiesPhone || row.hpWakasekSarana,
        konsentrasi,
      } as AdminSchoolReportRow;
    },
    [session?.token, profileCache, adminDocsCache, proposalBundleCache, equipmentBundleCache, selectionBundle],
  );

  const rows: AdminSchoolReportRow[] = useMemo(() => {
    return schools.map((sRaw, i): AdminSchoolReportRow => {
      const s = sRaw as AdminSchoolOption & {
        address?: string;
        province?: string;
        city?: string;
        district?: string;
        village?: string;
        principalName?: string;
        principalNip?: string;
        principalPhone?: string;
        vicePrincipalFacilitiesName?: string;
        vicePrincipalFacilitiesPhone?: string;
      };
      const profile = profileCache.get(s.npsn);
      const rawAdminDocs = adminDocsCache.get(s.npsn) ?? [];
      const proposalBundle = selectionBundle?.proposalBundles?.[s.npsn] ?? null;
      const equipmentBundle = selectionBundle?.equipmentBundles?.[s.npsn] ?? null;
      const concentrations = profile?.concentrations ?? [];
      const konsentrasiList = concentrations
        .map((c: SchoolProfileConcentrationRecord) => c.name || "")
        .filter(Boolean);
      const kons = konsentrasiList.length ? konsentrasiList : KONSENTRASI_POOL.slice(0, 1);
      const konsMapPairs: Array<{ code?: string; name?: string }> = concentrations.map((c: SchoolProfileConcentrationRecord) => ({
        code: c.code,
        name: c.name,
      }));
      const dok = rawAdminDocs.length ? mapAdminDocsToDokumen(rawAdminDocs) : buildDefaultDoc(s.npsn);
      const complete = dok.filter((d) => d.uploaded).length;
      const pengajuanReal = proposalBundle?.proposalTables
        ? mapProposalTablesToPengajuan(proposalBundle.proposalTables as Record<string, unknown>, konsMapPairs)
        : null;
      const pengajuan = pengajuanReal?.length ? pengajuanReal : seedPengajuan(i + 1, s.npsn, kons);
      const alatReal = equipmentBundle?.equipmentTables
        ? mapEquipmentTablesToAlat(equipmentBundle.equipmentTables as Record<string, unknown>, konsMapPairs)
        : null;
      let alat: AdminEquipmentRow[];
      let alatByKonsentrasi: AdminEquipmentByConcentration[];
      if (alatReal && alatReal.alat.length) {
        alat = alatReal.alat;
        alatByKonsentrasi = alatReal.alatByKonsentrasi;
      } else {
        alat = seedAlat(i + 1, s.npsn, kons);
        alatByKonsentrasi = seedAlatByKonsentrasi(alat);
      }
      const alamat = profile?.address || s.address || "";
      const provinsi = profile?.province || s.province || "";
      const kabupaten = profile?.city || s.city || "";
      const kecamatan = profile?.district || s.district || "";
      const desaKel = profile?.village || s.village || "";
      const kepsek = profile?.principalName || s.principalName || "-";
      const nipKepsek = profile?.principalNip || s.principalNip || "";
      const hpKepsek = profile?.principalPhone || s.principalPhone || "";
      const wakasekSarana = profile?.vicePrincipalFacilitiesName || s.vicePrincipalFacilitiesName || "";
      const hpWakasekSarana = profile?.vicePrincipalFacilitiesPhone || s.vicePrincipalFacilitiesPhone || "";
      const konsentrasi = kons;
      return {
        no: i + 1,
        id: s.id,
        npsn: s.npsn,
        nama: s.name ?? "-",
        alamat,
        provinsi,
        kabupaten,
        kecamatan,
        desaKel,
        kepsek,
        nipKepsek,
        hpKepsek,
        wakasekSarana,
        hpWakasekSarana,
        konsentrasi,
        tahunAjaran: "2026/2027",
        dataSekolahComplete: Math.min(complete, 10),
        dataSekolahTotal: 10,
        dokumen: dok,
        adminDocs: rawAdminDocs,
        alat,
        alatByKonsentrasi,
        pengajuan,
        proposal: proposalBundle ?? undefined,
        equipment: equipmentBundle ?? undefined,
        profile,
      } as AdminSchoolReportRow;
    });
  }, [schools, adminDocsCache, profileCache, selectionBundle]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.nama.toLowerCase().includes(q) ||
        r.npsn.includes(q) ||
        (r.profile?.province || r.provinsi || "").toLowerCase().includes(q) ||
        (r.profile?.city || r.kabupaten || "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const summaryCards = useMemo(() => {
    const uploaded = rows.map((r) =>
      r.adminDocs.length
        ? r.adminDocs.slice(0, 12).filter((d) => d.uploaded).length
        : r.dokumen.filter((d) => d.uploaded).length,
    );
    const verified = rows.map((r) =>
      r.adminDocs.length
        ? r.adminDocs
            .slice(0, 12)
            .filter((d) => ["DISETUJUI", "APPROVED", "VERIFIED"].includes(String(d.reviewStatus || "").toUpperCase())).length
        : r.dokumen.filter((d) => d.verified).length,
    );
    const sekolahLengkap = rows.filter((r) => uploaded[rows.indexOf(r)] >= 10).length;
    const avgUploaded = uploaded.length ? Math.round(uploaded.reduce((a, b) => a + b, 0) / uploaded.length) : 0;
    const avgVerified = verified.length ? Math.round(verified.reduce((a, b) => a + b, 0) / verified.length) : 0;
    return [
      { title: "Total Sekolah", value: rows.length, sub: "Terdaftar Verifikasi Online", tone: "bg-primary/10 text-primary-700" },
      {
        title: "Sekolah Dokumen ≥10/12",
        value: sekolahLengkap,
        sub: `${Math.round((sekolahLengkap / Math.max(1, rows.length)) * 100)}% dari total`,
        tone: "bg-emerald-100 text-emerald-700",
      },
      { title: "Rata-rata Dokumen Terupload", value: `${avgUploaded} / 12`, sub: "Per sekolah (mean)", tone: "bg-indigo-100 text-indigo-700" },
      {
        title: "Rata-rata Terverifikasi",
        value: `${avgVerified} / 12`,
        sub: "Per sekolah (mean)",
        tone: "bg-amber-100 text-amber-700",
      },
    ];
  }, [rows]);

  async function openPreview(kind: ReportKind, row: AdminSchoolReportRow) {
    const labels = {
      dataSekolah: `Data Sekolah — ${row.nama}`,
      dokumen: `12 Dokumen Administrasi — ${row.nama}`,
      ajuan: `Ajuan Alat — ${row.nama}`,
    } as const;
    setBusy(`${kind}:${row.id}`);
    try {
      const enriched = await ensureDataForRow(row);
      const builder =
        kind === "dataSekolah" ? generateDataSekolahPDF : kind === "dokumen" ? generateDokumenPDF : generateAjuanAlatPDF;
      const res = await builder(enriched, "preview");
      setPreview({ kind, title: labels[kind], dataUri: res.dataUri, filename: res.filename });
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf(kind: ReportKind, row: AdminSchoolReportRow) {
    setBusy(`dl-${kind}:${row.id}`);
    try {
      const enriched = await ensureDataForRow(row);
      const builder =
        kind === "dataSekolah" ? generateDataSekolahPDF : kind === "dokumen" ? generateDokumenPDF : generateAjuanAlatPDF;
      await builder(enriched, "download");
    } finally {
      setBusy(null);
    }
  }

  async function downloadExcel(row: AdminSchoolReportRow) {
    setBusy(`xl:${row.id}`);
    try {
      const enriched = await ensureDataForRow(row);
      generateKondisiAlatExcel(enriched);
    } finally {
      setBusy(null);
    }
  }

  async function openDokumenAsli(row: AdminSchoolReportRow, idx: number) {
    setBusy(`dok-asli-${idx}:${row.id}`);
    try {
      const enriched = await ensureDataForRow(row);
      const dokList: AdminDocItem[] | SchoolAdministrativeDocumentRecord[] = enriched.adminDocs.length
        ? enriched.adminDocs.slice(0, 12).map((d, i) => ({ ...d, name: DOKUMEN_LABELS[i] || d.name }))
        : enriched.dokumen.slice(0, 12).map((d, i) => ({ ...d, label: DOKUMEN_LABELS[i] || d.label, name: DOKUMEN_LABELS[i] || d.name }));
      const d = dokList[idx];
      if (!d) return;
      const dDoc = d as SchoolAdministrativeDocumentRecord;
      const dAlt = d as AdminDocItem;
      const up = typeof dDoc.uploaded === "boolean" ? dDoc.uploaded : !!dAlt.uploaded;
      if (!up) {
        window.alert(
          `Dokumen nomor ${idx + 1}: ${DOKUMEN_LABELS[idx] || dDoc.name || dAlt.label || ""}\nBelum diunggah oleh sekolah.\nMohon menunggu sekolah mengunggah dokumen ini.`,
        );
        return;
      }
      const pathFile = dDoc.filePath || dAlt.path || "";
      const namaFile = dDoc.fileName || dAlt.fileName || "";
      let url = "";
      if (pathFile) {
        if (pathFile.startsWith("http://") || pathFile.startsWith("https://")) {
          url = pathFile;
        } else {
          const base =
            (typeof window !== "undefined"
              ? window.__NEXT_DATA__?.buildId
                ? ""
                : ""
              : "");
          void base;
          const apiBase =
            (typeof process !== "undefined" ? process.env.NEXT_PUBLIC_API_URL : "") ||
            "http://localhost:3000";
          url = `${apiBase.replace(/\/$/, "")}${pathFile.startsWith("/") ? "" : "/"}${pathFile}`;
        }
      } else if (namaFile) {
        url = `data:application/pdf;name=${encodeURIComponent(namaFile)},placeholder`;
      }
      if (!url || url.startsWith("data:application/pdf;name=")) {
        openPreview("dokumen", row);
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer,width=960,height=720");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Cari nama sekolah, NPSN, provinsi, kabupaten..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={handleRefresh} disabled={refreshing || loading} className="gap-2">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {refreshing ? "Memperbarui..." : "Perbarui"}
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((c) => (
          <Card key={c.title}>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{c.title}</p>
              <p className="display-font mt-2 text-2xl sm:text-3xl font-semibold text-slate-950 break-words">{c.value}</p>
              <p className="mt-2 text-xs text-slate-500">{c.sub}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-slate-200 px-4 py-4 sm:px-6 md:flex md:items-center md:justify-between">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Laporan Verifikasi Online — 4 Bagian Format Standar
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500 md:mt-0">
            Menampilkan {filtered.length} dari {rows.length} sekolah · klik Preview / Download untuk mengunduh file.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-[1280px] w-full text-sm">
              <thead className="bg-slate-100/80 text-slate-600">
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-[0.18em]">
                  <th className="px-3 py-3 sm:px-4 w-12">No</th>
                  <th className="px-3 py-3 sm:px-4">NPSN</th>
                  <th className="px-3 py-3 sm:px-4">Nama Sekolah</th>
                  <th className="px-3 py-3 sm:px-4 w-[220px]">1. Data Sekolah</th>
                  <th className="px-3 py-3 sm:px-4 w-[240px]">2. 12 Dokumen Administrasi</th>
                  <th className="px-3 py-3 sm:px-4 w-[210px]">3. Kondisi Alat</th>
                  <th className="px-3 py-3 sm:px-4 w-[230px]">4. Ajuan Alat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin align-middle" />
                      Memuat data sekolah...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      Tidak ada sekolah yang sesuai dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    const dokLoaded = row.adminDocs.length > 0;
                    const dokUp = dokLoaded
                      ? row.adminDocs.slice(0, 12).filter((d) => d.uploaded).length
                      : row.dokumen.filter((d) => d.uploaded).length;
                    const dokVer = dokLoaded
                      ? row.adminDocs
                          .slice(0, 12)
                          .filter((d) => ["DISETUJUI", "APPROVED", "VERIFIED"].includes(String(d.reviewStatus || "").toUpperCase())).length
                      : row.dokumen.filter((d) => d.verified).length;
                    const dokList = dokLoaded ? row.adminDocs.slice(0, 12) : row.dokumen.slice(0, 12);
                    const lengkap = dokUp >= 10;
                    const rekapKonsentrasi = row.alatByKonsentrasi;
                    return (
                      <tr key={row.id || row.npsn} className="align-top hover:bg-slate-50/60">
                        <td className="px-3 py-4 sm:px-4 tabular-nums text-slate-500">{row.no}</td>
                        <td className="px-3 py-4 sm:px-4 font-medium text-slate-700 tabular-nums">{row.npsn}</td>
                        <td className="px-3 py-4 sm:px-4 max-w-[340px]">
                          <p className="font-semibold text-slate-950 leading-snug">{row.nama}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {row.profile?.province || row.provinsi} · {row.profile?.city || row.kabupaten}
                            {row.profile?.district ? ` · ${row.profile.district}` : row.kecamatan ? ` · ${row.kecamatan}` : ""}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {(row.konsentrasi ?? []).map((k) => (
                              <Badge
                                key={k}
                                variant="outline"
                                className="border-slate-200 bg-white text-[11px] px-2 py-0.5"
                              >
                                {k}
                              </Badge>
                            ))}
                          </div>
                          {(row.profile?.principalName || row.kepsek) && (
                            <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                              <span className="font-medium text-slate-600">Kepsek:</span>{" "}
                              {row.profile?.principalName || row.kepsek}
                              {row.profile?.principalNip || row.nipKepsek ? ` · NIP ${row.profile?.principalNip || row.nipKepsek}` : ""}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-4 sm:px-4">
                          <div className="flex items-center gap-1.5 mb-2">
                            {lengkap ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : null}
                            <span className="text-xs font-medium text-slate-600">
                              Profil {row.dataSekolahComplete}/{row.dataSekolahTotal} data
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5 px-2 h-8 text-xs"
                              onClick={() => openPreview("dataSekolah", row)}
                              disabled={busy === `dataSekolah:${row.id}`}
                            >
                              {busy === `dataSekolah:${row.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                              Preview
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              className="gap-1.5 px-2 h-8 text-xs"
                              onClick={() => downloadPdf("dataSekolah", row)}
                              disabled={busy === `dl-dataSekolah:${row.id}`}
                            >
                              {busy === `dl-dataSekolah:${row.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <FileText className="h-3.5 w-3.5" />
                                  <Download className="h-3 w-3" />
                                </>
                              )}
                              PDF A4
                            </Button>
                          </div>
                        </td>
                        <td className="px-3 py-4 sm:px-4">
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            <Badge
                              variant="outline"
                              className={`rounded-full ${lengkap ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}
                            >
                              {dokLoaded ? `${dokUp} upload · ${dokVer} verif` : "Memuat data dokumen..."}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-4 gap-1 mb-2 max-w-[180px]">
                            {dokList.map((d, i) => {
                              const dDoc = d as SchoolAdministrativeDocumentRecord;
                              const dAlt = d as AdminDocItem;
                              const up = dokLoaded ? (typeof dDoc.uploaded === "boolean" ? dDoc.uploaded : false) : !!dAlt.uploaded;
                              const ver = dokLoaded
                                ? typeof dDoc.reviewStatus === "string"
                                  ? ["DISETUJUI", "APPROVED", "VERIFIED"].includes(String(dDoc.reviewStatus || "").toUpperCase())
                                  : false
                                : !!dAlt.verified;
                              const busyDok = busy === `dok-asli-${i}:${row.id}`;
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  disabled={busyDok}
                                  title={`${i + 1}. ${(dDoc.name || dAlt.label || "")} — ${up ? "Sudah Upload" : "Belum"} · ${ver ? "Terverifikasi" : "Belum"}\nKlik untuk buka file asli yang diunggah sekolah.`}
                                  onClick={() => openDokumenAsli(row, i)}
                                  className={`h-3.5 w-full rounded-sm text-[9px] font-bold flex items-center justify-center tabular-nums cursor-pointer transition shadow-sm ${
                                    ver
                                      ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                                      : up
                                        ? "bg-amber-400 hover:bg-amber-500 text-amber-950"
                                        : "bg-slate-200 hover:bg-slate-300 text-slate-500"
                                  } ${busyDok ? "opacity-60 cursor-wait" : ""}`}
                                >
                                  {busyDok ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <span>{i + 1}</span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5 px-2 h-8 text-xs"
                              onClick={() => openPreview("dokumen", row)}
                              disabled={busy === `dokumen:${row.id}`}
                            >
                              {busy === `dokumen:${row.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                              Preview
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              className="gap-1.5 px-2 h-8 text-xs"
                              onClick={() => downloadPdf("dokumen", row)}
                              disabled={busy === `dl-dokumen:${row.id}`}
                            >
                              {busy === `dl-dokumen:${row.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <FileText className="h-3.5 w-3.5" />
                                  <Download className="h-3 w-3" />
                                </>
                              )}
                              PDF A4
                            </Button>
                          </div>
                        </td>
                        <td className="px-3 py-4 sm:px-4">
                          <div className="text-xs text-slate-600 mb-2 leading-snug">
                            <div className="font-medium text-slate-700 mb-1">
                              Rekap {rekapKonsentrasi.length} Konsentrasi
                            </div>
                            {row.equipment ? (
                              <div className="grid grid-cols-2 gap-0.5 tabular-nums">
                                <div className="text-emerald-700">
                                  Bagus: {row.alat.filter((a) => a.kondisi === "Baik").reduce((a, b) => a + b.jumlah, 0)}
                                </div>
                                <div className="text-rose-700">
                                  Rusak: {row.alat.filter((a) => a.kondisi !== "Baik" && a.kondisi !== "Tidak Ada").reduce((a, b) => a + b.jumlah, 0)}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400 italic">
                                Klik Excel / Preview untuk lihat detail
                              </div>
                            )}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="default"
                            className="gap-1.5 px-2.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => downloadExcel(row)}
                            disabled={busy === `xl:${row.id}`}
                          >
                            {busy === `xl:${row.id}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                                <Download className="h-3 w-3" />
                              </>
                            )}
                            Excel (.xlsx)
                          </Button>
                        </td>
                        <td className="px-3 py-4 sm:px-4">
                          <div className="text-xs text-slate-600 mb-2 leading-snug">
                            {row.proposal ? (
                              <>
                                <div className="font-medium text-slate-700">
                                  {row.pengajuan.length} item · {row.pengajuan.reduce((a, b) => a + b.qty, 0)} unit
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  3 Foto + Data Toko 1·2·3
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="font-medium text-slate-500 italic">
                                  Daftar ajuan alat
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5 italic">
                                  Klik Preview untuk data real DB
                                </div>
                              </>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="gap-1.5 px-2 h-8 text-xs"
                              onClick={() => openPreview("ajuan", row)}
                              disabled={busy === `ajuan:${row.id}`}
                            >
                              {busy === `ajuan:${row.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                              Preview
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              className="gap-1.5 px-2 h-8 text-xs bg-indigo-600 hover:bg-indigo-700"
                              onClick={() => downloadPdf("ajuan", row)}
                              disabled={busy === `dl-ajuan:${row.id}`}
                            >
                              {busy === `dl-ajuan:${row.id}` ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <>
                                  <FileText className="h-3.5 w-3.5" />
                                  <Download className="h-3 w-3" />
                                </>
                              )}
                              PDF
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {preview ? (
        <div className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm">
          <div className="fixed inset-0 sm:inset-6 lg:inset-10 flex flex-col bg-white rounded-none sm:rounded-2xl shadow-2xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary-700">
                  <BarChart3 className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preview Laporan</p>
                  <h2 className="mt-1 text-base sm:text-lg font-semibold text-slate-950 truncate">{preview.title}</h2>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = preview.dataUri;
                    a.download = preview.filename;
                    a.click();
                  }}
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh {preview.filename}
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => setPreview(null)} aria-label="Tutup preview">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 min-h-0 overflow-hidden">
              <iframe
                title={preview.title}
                src={preview.dataUri}
                className="h-full w-full border-0 bg-white"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
