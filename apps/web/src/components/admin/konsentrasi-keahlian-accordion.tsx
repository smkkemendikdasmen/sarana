"use client";

import { ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { perdirjenEquipmentSummaryRequest, type PerdirjenEquipmentSummaryBidang } from "@/lib/api";
import { cn } from "@/lib/utils";

export function KonsentrasiKeahlianAccordion() {
  const [data, setData] = useState<PerdirjenEquipmentSummaryBidang[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openBidang, setOpenBidang] = useState<string | null>(null);
  const [openProgram, setOpenProgram] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const payload = await perdirjenEquipmentSummaryRequest();
        if (!cancelled) {
          setData(payload);
          setOpenBidang((current) => current ?? payload[0]?.no ?? null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Terjadi kesalahan saat memuat data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const bidangByNo = useMemo(() => new Map(data.map((item) => [item.no, item])), [data]);
  const selectedBidang = openBidang ? bidangByNo.get(openBidang) ?? null : null;

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat data konsentrasi keahlian...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-danger/15 bg-danger/[0.08] px-5 py-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
        Data konsentrasi keahlian belum tersedia.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        <span>No</span>
        <span>Bidang Keahlian</span>
      </div>

      <div className="divide-y divide-slate-200">
        {data.map((bidang) => {
          const isOpen = bidang.no === openBidang;

          return (
            <div key={bidang.no}>
              <button
                type="button"
                onClick={() => {
                  setOpenBidang((current) => (current === bidang.no ? null : bidang.no));
                  setOpenProgram(null);
                }}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
                aria-expanded={isOpen}
              >
                <div className="grid flex-1 grid-cols-[96px_minmax(0,1fr)] gap-3">
                  <span className="text-sm font-semibold text-slate-700">{bidang.no}</span>
                  <span className="text-sm font-semibold text-slate-950">{bidang.bidang}</span>
                </div>
                <ChevronDown className={cn("h-5 w-5 text-slate-400 transition", isOpen ? "rotate-180" : "")} />
              </button>

              {isOpen ? (
                <div className="border-t border-slate-200 bg-slate-50/40 px-5 py-4">
                  <div className="mb-3 grid grid-cols-[96px_minmax(0,1fr)] gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                    <span>No</span>
                    <span>Program Keahlian</span>
                  </div>

                  <div className="space-y-2">
                    {bidang.program.map((program) => {
                      const programKey = `${bidang.no}::${program.no}`;
                      const programOpen = openProgram === programKey;

                      return (
                        <div key={programKey} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => setOpenProgram((current) => (current === programKey ? null : programKey))}
                            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50"
                            aria-expanded={programOpen}
                          >
                            <div className="grid flex-1 grid-cols-[96px_minmax(0,1fr)] gap-3">
                              <span className="text-sm font-semibold text-slate-700">{program.no}</span>
                              <span className="text-sm font-semibold text-slate-950">{program.nama}</span>
                            </div>
                            <ChevronDown
                              className={cn("h-5 w-5 text-slate-400 transition", programOpen ? "rotate-180" : "")}
                            />
                          </button>

                          {programOpen ? (
                            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                              <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                                <span>No</span>
                                <span>Konsentrasi Keahlian</span>
                              </div>
                              <div className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                                {program.konsentrasi.map((kons) => (
                                  <div key={kons.no} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 px-4 py-3">
                                    <span className="text-sm font-semibold text-slate-600">{kons.no}</span>
                                    <span className="text-sm text-slate-800">{kons.nama}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {selectedBidang ? (
        <div className="border-t border-slate-200 bg-white px-5 py-3 text-xs text-slate-500">
          Menampilkan: {selectedBidang.no} {selectedBidang.bidang}
        </div>
      ) : null}
    </div>
  );
}
