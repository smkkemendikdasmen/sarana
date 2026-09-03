"use client";

import { useAuthStore } from "@/store/auth-store";
import {
  preparationsRequest,
  savePreparationsRequest,
  schoolPaguDetailRequest,
  type PreparationGroupView,
  type PreparationItemView,
  type SchoolPaguDetail,
} from "@/lib/api";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Save,
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

function emptyGroup(name = ""): PreparationGroupView {
  return {
    uuid: createId(),
    name,
    items: [emptyItem()],
  };
}
function emptyItem(): PreparationItemView {
  return { uuid: createId(), description: "", quantity: 1, unitPrice: 0 };
}

export function SchoolProposalPersiapanPage({ npsn }: { npsn?: string }) {
  const router = useRouter();
  const { hydrate, hydrated, session } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<PreparationGroupView[]>([emptyGroup("")]);
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
        const bundle = await preparationsRequest(session.token, npsn);
        if (cancelled) return;
        const list = bundle.groups ?? [];
        if (list.length > 0) {
          setGroups(
            list.map<PreparationGroupView>((g) => ({
              uuid: String(g.uuid || createId()),
              name: String(g.name || ""),
              items: Array.isArray(g.items)
                ? g.items.map<PreparationItemView>((it) => ({
                    uuid: String(it.uuid || createId()),
                    description: String(it.description || ""),
                    quantity: Math.max(0, Number(it.quantity) || 0),
                    unitPrice: Math.max(0, Number(it.unitPrice) || 0),
                  }))
                : [emptyItem()],
            })),
          );
        }
        if (bundle.updatedAt) setLastSavedAt(new Date(bundle.updatedAt));
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Gagal memuat data persiapan.");
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
    queryKey: ["paguDetailPersiapan", npsn || "me"],
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

  const grandTotal = useMemo(
    () =>
      groups.reduce<number>((sum, g) => {
        const t = (g.items || []).reduce<number>(
          (s, it) => s + (it.quantity || 0) * (it.unitPrice || 0),
          0,
        );
        return sum + t;
      }, 0),
    [groups],
  );

  const paguPersiapanMax = pagu.data?.data?.pagu?.persiapan ?? 0;
  const paguPersiapanOver = paguPersiapanMax > 0 && grandTotal > paguPersiapanMax;
  const paguPersiapanKelebihan = Math.max(0, grandTotal - paguPersiapanMax);
  const paguPersiapanSisa = Math.max(0, paguPersiapanMax - grandTotal);

  const addKegiatan = () =>
    setGroups((prev) => [...prev, emptyGroup("")]);

  const toggleGroup = (id: string) =>
    setGroups((prev) =>
      prev.map((g) =>
        g.uuid === id ? { ...g, name: g.name, items: g.items, _expanded: !(g as any)._expanded } as any : g,
      ),
    );

  const isExpanded = (g: PreparationGroupView) => {
    const v = (g as any)?._expanded;
    return typeof v === "boolean" ? v : true;
  };

  const patchGroup = (uuid: string, patch: Partial<PreparationGroupView> | Record<string, unknown>) =>
    setGroups((prev) => prev.map((g) => (g.uuid === uuid ? { ...g, ...patch } as PreparationGroupView : g)));

  const removeGroup = (uuid: string) => {
    const ok = window.confirm("Yakin menghapus KEGIATAN ini beserta seluruh detail itemnya?");
    if (!ok) return;
    setGroups((prev) => (prev.length <= 1 ? [emptyGroup("")] : prev.filter((g) => g.uuid !== uuid)));
  };

  const patchItem = (groupUuid: string, itemUuid: string, patch: Partial<PreparationItemView>) =>
    setGroups((prev) =>
      prev.map<PreparationGroupView>((g) =>
        g.uuid === groupUuid
          ? {
              ...g,
              items: (g.items || []).map<PreparationItemView>((it) =>
                it.uuid === itemUuid ? { ...it, ...patch } : it,
              ),
            }
          : g,
      ),
    );

  const addItem = (groupUuid: string) =>
    setGroups((prev) =>
      prev.map<PreparationGroupView>((g) =>
        g.uuid === groupUuid
          ? { ...g, items: [...(g.items || []), emptyItem()], ...((g as any)._expanded === false ? { _expanded: true } : {}) } as any
          : g,
      ),
    );

  const removeItem = (groupUuid: string, itemUuid: string) => {
    const ok = window.confirm("Yakin hapus item detail ini?");
    if (!ok) return;
    setGroups((prev) =>
      prev.map<PreparationGroupView>((g) => {
        if (g.uuid !== groupUuid) return g;
        const items = (g.items || []).filter((it) => it.uuid !== itemUuid);
        return {
          ...g,
          items: items.length > 0 ? items : [emptyItem()],
        };
      }),
    );
  };

  const handleSave = async () => {
    if (!session?.token || saving) return;
    if (paguPersiapanOver) {
      setError(
        `Total Biaya Persiapan melebihi batas Pagu Persiapan dari Dinas. Batas: Rp ${paguPersiapanMax.toLocaleString("id-ID")}. Total sekarang: Rp ${grandTotal.toLocaleString("id-ID")}. Kurangi Rp ${paguPersiapanKelebihan.toLocaleString("id-ID")} agar bisa disimpan.`,
      );
      return;
    }
    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await savePreparationsRequest(session.token, {
        groups,
        schoolNpsn: npsn ? String(npsn).trim() : undefined,
      });
      if (res.updatedAt) setLastSavedAt(new Date(res.updatedAt));
      setSuccessMsg(
        `✅ Berhasil tersimpan (${res.savedGroupsCount} Kegiatan · ${res.savedItemsCount} item · Total ${IDR.format(
          grandTotal,
        )}).`,
      );
      setTimeout(() => setSuccessMsg(""), 10000);
    } catch (e: any) {
      setError(e?.message ?? "Gagal menyimpan data persiapan. Coba beberapa saat lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali</span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Biaya Persiapan &amp; Pelaporan</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Susun per Kegiatan · Detail item di bawah masing-masing kegiatan
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {lastSavedAt && (
            <Badge
              variant="outline"
              className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-800"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold">
                Disimpan · {lastSavedAt.toLocaleString("id-ID")}
              </span>
            </Badge>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || !session?.token || paguPersiapanOver}
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
          {!pagu.isLoading && paguPersiapanMax > 0 ? (
            <div
              className={`rounded-lg border px-4 py-3 shadow-sm ring-1 ${
                paguPersiapanOver
                  ? "border-rose-300 bg-gradient-to-br from-rose-50 to-rose-100/50 ring-rose-200"
                  : "border-emerald-200 bg-emerald-50/70 ring-emerald-100"
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <AlertTriangle
                  className={`h-4 w-4 shrink-0 ${paguPersiapanOver ? "text-rose-600" : "hidden"}`}
                />
                <span
                  className={`font-semibold ${paguPersiapanOver ? "text-rose-800" : "text-emerald-800"}`}
                >
                  {paguPersiapanOver
                    ? "⚠ Melebihi Batas Pagu Persiapan Dinas"
                    : "✓ Batas Pagu Persiapan Dinas"}
                </span>
                <span className={paguPersiapanOver ? "text-rose-700" : "text-emerald-700/80"}>
                  Batas: <span className="font-semibold">{IDR.format(paguPersiapanMax)}</span>
                </span>
                <span className={paguPersiapanOver ? "text-rose-700" : "text-emerald-700/80"}>
                  Terpakai: <span className="font-semibold">{IDR.format(grandTotal)}</span>
                </span>
                {!paguPersiapanOver ? (
                  <span className="font-semibold text-emerald-700">
                    Sisa Kuota: {IDR.format(paguPersiapanSisa)}
                  </span>
                ) : (
                  <span className="font-bold text-rose-700">
                    Kelebihan: {IDR.format(paguPersiapanKelebihan)}
                  </span>
                )}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="rounded-lg bg-slate-900 px-4 py-2 text-right text-white shadow-sm">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/70">
                TOTAL ANGGARAN SELURUH KEGIATAN
              </p>
              <p className="font-mono text-base font-bold leading-5 tabular-nums">
                {IDR.format(grandTotal)}
              </p>
              <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/70">
                {groups.length} Kegiatan
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addKegiatan} className="gap-1">
              <Plus className="h-4 w-4" />
              <span>Tambah Kegiatan</span>
            </Button>
          </div>

          {groups.map((g, gi) => {
            const groupTotal = (g.items || []).reduce<number>(
              (s, it) => s + (it.quantity || 0) * (it.unitPrice || 0),
              0,
            );
            const expanded = isExpanded(g);
            return (
              <Card key={g.uuid} className="overflow-hidden">
                <CardHeader className="flex flex-col items-start gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div className="flex w-full flex-1 items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleGroup(g.uuid)}
                      className="h-9 w-9 shrink-0 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                      title={expanded ? "Sembunyikan detail" : "Tampilkan detail"}
                    >
                      {expanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </Button>
                    <div className="grid w-full grid-cols-12 items-center gap-2">
                      <div className="col-span-12 sm:col-span-1 flex items-center justify-center">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                          Kegiatan {gi + 1}
                        </span>
                      </div>
                      <div className="col-span-12 sm:col-span-8">
                        <Input
                          type="text"
                          value={g.name}
                          onChange={(e) => patchGroup(g.uuid, { name: e.target.value })}
                          placeholder="Nama Kegiatan (contoh: Rapat Koordinasi)"
                          className="text-[13px] font-semibold"
                        />
                      </div>
                      <div className="col-span-12 sm:col-span-3 flex items-center justify-end gap-3">
                        <div className="text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Total Anggaran
                          </p>
                          <p className="font-mono text-base font-bold leading-5 tabular-nums text-slate-900">
                            {IDR.format(groupTotal)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeGroup(g.uuid)}
                          className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                          title="Hapus Kegiatan"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                {expanded && (
                  <CardContent className="border-t border-slate-100 bg-slate-50/40 p-0">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-[13px]">
                        <thead className="bg-slate-100/80 text-slate-700">
                          <tr className="text-left text-[11.5px] font-semibold uppercase tracking-wider">
                            <th className="w-16 px-3 py-2.5 text-center">Aksi</th>
                            <th className="w-14 px-3 py-2.5 text-center">No</th>
                            <th className="px-3 py-2.5">Uraian Detail</th>
                            <th className="w-32 px-3 py-2.5 text-center">Jumlah</th>
                            <th className="w-44 px-3 py-2.5 text-right">Harga Satuan</th>
                            <th className="w-48 px-3 py-2.5 text-right">Total Harga</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(g.items || []).map((it, ii) => {
                            const subtotal = (it.quantity || 0) * (it.unitPrice || 0);
                            return (
                              <tr key={it.uuid} className="hover:bg-white/60">
                                <td className="px-3 py-2.5 text-center align-middle">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItem(g.uuid, it.uuid)}
                                    className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                    title="Hapus detail item"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                                <td className="px-3 py-2.5 text-center font-semibold text-slate-500 align-middle">
                                  {ii + 1}
                                </td>
                                <td className="px-3 py-2.5 align-middle">
                                  <Input
                                    type="text"
                                    value={it.description}
                                    onChange={(e) =>
                                      patchItem(g.uuid, it.uuid, { description: e.target.value })
                                    }
                                    placeholder="Uraian detail item kegiatan..."
                                    className="text-[13px]"
                                  />
                                </td>
                                <td className="px-3 py-2.5 align-middle">
                                  <Input
                                    type="number"
                                    min={0}
                                    step={1}
                                    value={it.quantity > 0 ? String(it.quantity) : ""}
                                    onChange={(e) =>
                                      patchItem(g.uuid, it.uuid, {
                                        quantity: Math.max(0, Number(e.target.value) || 0),
                                      })
                                    }
                                    placeholder="0"
                                    className="text-right font-mono tabular-nums text-[13px]"
                                  />
                                </td>
                                <td className="px-3 py-2.5 align-middle">
                                  <Input
                                    type="number"
                                    min={0}
                                    value={it.unitPrice > 0 ? String(it.unitPrice) : ""}
                                    onChange={(e) =>
                                      patchItem(g.uuid, it.uuid, {
                                        unitPrice: Math.max(0, Number(e.target.value) || 0),
                                      })
                                    }
                                    placeholder="0"
                                    className="text-right font-mono tabular-nums text-[13px]"
                                  />
                                </td>
                                <td className="bg-white/60 px-3 py-2.5 text-right font-bold tabular-nums align-middle">
                                  {IDR.format(subtotal)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-slate-100/80 text-slate-800">
                          <tr>
                            <td colSpan={3} className="px-3 py-2.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => addItem(g.uuid)}
                                className="gap-1 text-slate-700 hover:bg-white hover:text-slate-900"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span className="text-[12px] font-semibold">+ Tambah Detail Item</span>
                              </Button>
                            </td>
                            <td className="px-3 py-2.5 text-center font-mono font-bold tabular-nums">
                              {(g.items || []).reduce<number>((s, it) => s + (it.quantity || 0), 0)}
                            </td>
                            <td />
                            <td className="px-3 py-2.5 text-right font-mono text-sm font-extrabold tabular-nums">
                              {IDR.format(groupTotal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
