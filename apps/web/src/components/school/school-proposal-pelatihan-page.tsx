"use client";

import { useAuthStore } from "@/store/auth-store";
import {
  trainingCostsRequest,
  saveTrainingCostsRequest,
  schoolPaguDetailRequest,
  type TrainingCostView,
  type SchoolPaguDetail,
} from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  Loader2,
  Plus,
  Save,
  Square,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";

const IDR = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function createId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function emptyTrainingRow(): TrainingCostView {
  return {
    uuid: createId(),
    productName: "",
    unitPrice: 0,
    requiresTraining: true,
    trainingCost: 0,
  };
}

function calcTrainingCost(unitPrice: number, requiresTraining: boolean) {
  const unitP = Math.max(0, Number(unitPrice) || 0);
  return requiresTraining ? Math.ceil((unitP * 15) / 1000) : 0;
}

export function SchoolProposalPelatihanPage({ npsn }: { npsn?: string }) {
  const router = useRouter();
  const { hydrate, hydrated, session } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [costs, setCosts] = useState<TrainingCostView[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!session?.token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const bundle = await trainingCostsRequest(session.token, npsn);
        if (cancelled) return;
        const list = Array.isArray(bundle.costs) ? bundle.costs : [];
        setCosts(
          list.map<TrainingCostView>((c) => {
            const unitP = Math.max(0, Number(c.unitPrice) || 0);
            const reqT =
              c.requiresTraining === true || (c.requiresTraining as any) === "true"
                ? true
                : false;
            return {
              uuid: String(c.uuid || createId()),
              productName: String(c.productName || ""),
              unitPrice: unitP,
              requiresTraining: reqT,
              trainingCost: calcTrainingCost(unitP, reqT),
            };
          }),
        );
        if (bundle.updatedAt) setLastSavedAt(new Date(bundle.updatedAt));
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Gagal memuat data pelatihan.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, session, npsn]);

  const token = (session?.token ?? "").trim();
  const hasToken = Boolean(token);

  const pagu = useQuery<SchoolPaguDetail | null>({
    queryKey: ["paguDetailPelatihan", npsn || "me"],
    queryFn: async (): Promise<SchoolPaguDetail | null> => {
      if (!hasToken) return null;
      try {
        return await schoolPaguDetailRequest(token, npsn ? String(npsn).trim() : undefined);
      } catch {
        return null;
      }
    },
    enabled: hasToken,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const totalCost = useMemo(
    () =>
      costs.reduce(
        (s, c) => s + calcTrainingCost(c.unitPrice, c.requiresTraining),
        0,
      ),
    [costs],
  );

  const paguPelatihanMax = pagu.data?.data?.pagu?.pelatihan ?? 0;
  const paguPelatihanOver = paguPelatihanMax > 0 && totalCost > paguPelatihanMax;
  const paguPelatihanKelebihan = Math.max(0, totalCost - paguPelatihanMax);
  const paguPelatihanSisa = Math.max(0, paguPelatihanMax - totalCost);

  const countActive = useMemo(
    () => costs.filter((c) => c.requiresTraining).length,
    [costs],
  );
  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    costs.forEach((c, i) => {
      if (!c.productName?.trim()) errs.push(`Baris ${i + 1}: Nama alat kosong`);
      if (c.requiresTraining && c.unitPrice <= 0)
        errs.push(`Baris ${i + 1}: Harga satuan Rp 0 tapi Butuh Pelatihan = YA`);
    });
    if (paguPelatihanOver) {
      errs.push(
        `Total Biaya Pelatihan melebihi batas Pagu Pelatihan Dinas. Batas: Rp ${paguPelatihanMax.toLocaleString("id-ID")}. Total sekarang: Rp ${totalCost.toLocaleString("id-ID")}. Kurangi Rp ${paguPelatihanKelebihan.toLocaleString("id-ID")}.`,
      );
    }
    return errs;
  }, [costs, paguPelatihanMax, paguPelatihanOver, paguPelatihanKelebihan, totalCost]);

  const patchItem = (uuid: string, patch: Partial<TrainingCostView>) =>
    setCosts((curr) =>
      curr.map((c) => {
        if (c.uuid !== uuid) return c;
        const next = { ...c, ...patch };
        if (
          patch.hasOwnProperty("unitPrice") ||
          patch.hasOwnProperty("requiresTraining")
        ) {
          next.trainingCost = calcTrainingCost(next.unitPrice, next.requiresTraining);
        }
        return next;
      }),
    );

  const addRow = () => setCosts((c) => [...c, emptyTrainingRow()]);

  const removeItem = (uuid: string) => {
    if (
      !window.confirm(
        "Yakin menghapus baris alat ini?\n\nData yang dihapus tidak bisa dikembalikan setelah klik Simpan.",
      )
    )
      return;
    setCosts((c) => c.filter((r) => r.uuid !== uuid));
  };

  const handleSave = async () => {
    if (!session?.token || saving) return;
    if (paguPelatihanOver) {
      setError(
        `Total Biaya Pelatihan melebihi batas Pagu Pelatihan dari Dinas. Batas: Rp ${paguPelatihanMax.toLocaleString("id-ID")}. Total sekarang: Rp ${totalCost.toLocaleString("id-ID")}. Kurangi Rp ${paguPelatihanKelebihan.toLocaleString("id-ID")} agar bisa disimpan.`,
      );
      return;
    }
    if (validationErrors.length > 0) {
      if (
        !window.confirm(
          `⚠ Ada ${validationErrors.length} data tidak lengkap:\n\n• ${validationErrors
            .slice(0, 5)
            .join("\n• ")}${
            validationErrors.length > 5
              ? `\n... dan ${validationErrors.length - 5} lainnya`
              : ""
          }\n\nTetap simpan sebagai draf?`,
        )
      )
        return;
    }
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const payload: TrainingCostView[] = costs.map((c) => {
        const unitP = Math.max(0, Math.floor(Number(c.unitPrice) || 0));
        const reqT = c.requiresTraining === true;
        return {
          uuid: String(c.uuid || createId()),
          productName: String(c.productName || "").trim(),
          unitPrice: unitP,
          requiresTraining: reqT,
          trainingCost: calcTrainingCost(unitP, reqT),
        };
      });
      const res = await saveTrainingCostsRequest(session.token, {
        costs: payload,
        schoolNpsn: npsn,
      });
      setLastSavedAt(res.updatedAt ? new Date(res.updatedAt) : new Date());
      setSuccessMsg(
        `✅ ${res.savedCostsCount} Alat · Total Biaya Pelatihan ${IDR.format(res.totalTrainingCost)} · Disimpan.`,
      );
      setTimeout(() => setSuccessMsg(""), 12000);
    } catch (e: any) {
      const msg = e?.message ?? "Gagal menyimpan data (network timeout).";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Biaya Pendukung Uji Fungsi &amp; Pelatihan 1,5%</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Harga satuan peralatan input angka Rupiah mentah. Total biaya pelatihan = 1,5% ×
              Harga Satuan jika Butuh Pelatihan aktif.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {lastSavedAt && (
            <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-800">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold">
                Disimpan: {lastSavedAt.toLocaleString("id-ID")}
              </span>
            </Badge>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || paguPelatihanOver}
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>{saving ? "Menyimpan..." : "Simpan ke Database"}</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 shadow-sm"
        >
          {successMsg}
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-16 text-sm text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat data...
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {!pagu.isLoading && paguPelatihanMax > 0 ? (
            <div
              className={`rounded-lg border px-4 py-3 shadow-sm ring-1 ${
                paguPelatihanOver
                  ? "border-rose-300 bg-gradient-to-br from-rose-50 to-rose-100/50 ring-rose-200"
                  : "border-sky-200 bg-sky-50/70 ring-sky-100"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <AlertTriangle
                  className={`h-4 w-4 shrink-0 ${paguPelatihanOver ? "text-rose-600" : "hidden"}`}
                />
                <span
                  className={`font-semibold ${paguPelatihanOver ? "text-rose-800" : "text-sky-800"}`}
                >
                  {paguPelatihanOver
                    ? "⚠ Melebihi Batas Pagu Pelatihan Dinas"
                    : "✓ Batas Pagu Pelatihan Dinas"}
                </span>
                <span className={paguPelatihanOver ? "text-rose-700" : "text-sky-700/80"}>
                  Batas: <span className="font-semibold">{IDR.format(paguPelatihanMax)}</span>
                </span>
                <span className={paguPelatihanOver ? "text-rose-700" : "text-sky-700/80"}>
                  Terpakai: <span className="font-semibold">{IDR.format(totalCost)}</span>
                </span>
                {!paguPelatihanOver ? (
                  <span className="font-semibold text-sky-700">
                    Sisa Kuota: {IDR.format(paguPelatihanSisa)}
                  </span>
                ) : (
                  <span className="font-bold text-rose-700">
                    Kelebihan: {IDR.format(paguPelatihanKelebihan)}
                  </span>
                )}
              </div>
            </div>
          ) : null}

          <Card>
          <CardHeader className="flex flex-col items-start justify-between gap-3 border-b border-slate-100 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="text-lg">Daftar Peralatan Perlu Pelatihan</CardTitle>
              <p className="mt-0.5 text-xs text-slate-500">
                Input manual alat peralatan. Data tersimpan ke tabel database relational clean
                MVCR (proposal_training_costs), bukan JSONB global.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary" className="gap-1">
                {countActive} butuh pelatihan · {costs.length} total item
              </Badge>
              <div className="rounded-lg bg-slate-900 px-4 py-2 text-right text-white shadow-sm">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">
                  Total Biaya Pelatihan
                </p>
                <p className="font-mono text-base font-bold leading-5">
                  {IDR.format(totalCost)}
                </p>
                <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/70">
                  Rumus: ceil(1,5% × Harga Satuan)
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1">
                <Plus className="h-4 w-4" />
                <span>Tambah Alat Perlu Pelatihan</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="border-b-0 p-0 pt-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wider">
                    <th className="w-20 px-4 py-3 text-center">Aksi</th>
                    <th className="w-14 px-4 py-3 text-center">No</th>
                    <th className="px-4 py-3">Nama Alat / Peralatan</th>
                    <th className="w-48 px-4 py-3 text-right">Harga Satuan (Rp)</th>
                    <th className="w-48 px-4 py-3 text-center">Butuh Pelatihan 1,5%</th>
                    <th className="w-56 px-4 py-3 text-right">
                      Total Biaya Pelatihan (Rp)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {costs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm italic text-slate-500"
                      >
                        Belum ada item. Klik &quot;Tambah Alat Perlu Pelatihan&quot; untuk
                        menambah data.
                      </td>
                    </tr>
                  ) : (
                    costs.map((c, i) => (
                      <tr key={c.uuid} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(c.uuid)}
                            className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                            title="Hapus baris"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-500">
                          {i + 1}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="text"
                            value={c.productName}
                            onChange={(e) =>
                              patchItem(c.uuid, { productName: e.target.value })
                            }
                            placeholder="Nama alat / peralatan..."
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={c.unitPrice === 0 ? "" : c.unitPrice}
                            onChange={(e) =>
                              patchItem(c.uuid, {
                                unitPrice: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            placeholder="0"
                            className="text-right font-mono tabular-nums"
                          />
                        </td>
                        <td className="px-4 py-3 text-center align-middle">
                          <label className="inline-flex items-center gap-3 text-xs font-semibold cursor-pointer select-none">
                            <button
                              type="button"
                              onClick={() =>
                                patchItem(c.uuid, { requiresTraining: !c.requiresTraining })
                              }
                              className="flex items-center justify-center"
                            >
                              {c.requiresTraining ? (
                                <CheckSquare className="h-5 w-5 text-violet-600 fill-violet-50" />
                              ) : (
                                <Square className="h-5 w-5 text-slate-400" />
                              )}
                            </button>
                            {c.requiresTraining ? (
                              <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10.5px] font-bold text-violet-700">
                                YA · 1,5%
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10.5px] font-bold text-slate-500">
                                TIDAK
                              </span>
                            )}
                          </label>
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums bg-slate-50">
                          {IDR.format(calcTrainingCost(c.unitPrice, c.requiresTraining))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-100">
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-3 text-right text-xs font-bold uppercase tracking-widest text-slate-700"
                    >
                      TOTAL BIAYA PELATIHAN
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold tabular-nums text-lg">
                      {IDR.format(totalCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
        </div>
      )}
    </div>
  );
}
