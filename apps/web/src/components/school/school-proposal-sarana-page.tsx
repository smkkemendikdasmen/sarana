"use client";

import { ArrowLeft, Loader2, Save, Wrench } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Controller, useForm, type SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SchoolDetailViewProvider } from "@/components/school/school-detail-view-context";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useSaveWorkspaceProposal, type WspUpdateReqValues } from "@/hooks/use-save-workspace-proposal";
import { useWorkspaceProposal } from "@/hooks/use-workspace-proposal";

const FormSchema = z.object({
  version: z.number().int().min(1),
  data_json: z.record(z.string(), z.any()).default({}),
});

type FormValues = z.infer<typeof FormSchema>;

export function SchoolProposalSaranaPage({
  schoolNpsn,
  viewerRole = "SEKOLAH",
}: {
  schoolNpsn?: string;
  viewerRole?: "FASILITATOR_ALAT" | "SEKOLAH" | "ADMIN" | null;
}) {
  const backHref = "/sekolah/pengajuan";
  const auth = useAuthSession();
  const router = useRouter();
  const effectiveNpsn = schoolNpsn ?? auth?.npsn ?? "";

  const { data: wspData, isLoading: wspLoading, error: wspError } = useWorkspaceProposal(
    effectiveNpsn || undefined,
  );
  const saveMut = useSaveWorkspaceProposal(effectiveNpsn || "");

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { isDirty, errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema) as never,
    defaultValues: {
      version: wspData?.version ?? 1,
      data_json: wspData?.data_json ?? {},
    },
    values: {
      version: wspData?.version ?? 1,
      data_json: wspData?.data_json ?? {},
    },
  });

  const [dirtyConfirmOpen, setDirtyConfirmOpen] = useState(false);

  useEffect(() => {
    if (wspData) {
      void reset(
        {
          version: wspData.version ?? 1,
          data_json: wspData.data_json ?? {},
        },
        { keepDirty: false },
      );
    }
  }, [wspData, reset]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty && !saveMut.isSuccess) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handler);
      return () => window.removeEventListener("beforeunload", handler);
    }
    return undefined;
  }, [isDirty, saveMut.isSuccess]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => {
      if (isDirty && !saveMut.isSuccess) {
        const ok = window.confirm(
          "Perubahan belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?",
        );
        if (!ok) {
          window.history.pushState(null, document.title, window.location.href);
        } else {
          setDirtyConfirmOpen(false);
        }
      }
    };
    window.history.pushState(null, document.title, window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [isDirty, saveMut.isSuccess]);

  const onSubmit: SubmitHandler<FormValues> = (values) => {
    const payload: WspUpdateReqValues = {
      version: values.version,
      data_json: values.data_json,
    };
    saveMut.mutate(payload, {
      onSuccess: () => {
        reset(values, { keepDirty: false });
      },
    });
  };

  const dataJson = watch("data_json") as Record<string, unknown>;
  const namaSekolah = typeof dataJson?.nama_sekolah === "string" ? dataJson.nama_sekolah : "";
  const keterangan = typeof dataJson?.keterangan === "string" ? dataJson.keterangan : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref}>
          <Button variant="outline" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali</span>
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-1 ring-amber-200">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary/70">
              Data Pengajuan · Bagian 1
            </p>
            <h1 className="display-font text-2xl font-semibold text-slate-950">
              Data Pengajuan Sarana Sesuai Konsentrasi Keahlian
            </h1>
          </div>
        </div>
      </div>

      <SchoolDetailViewProvider npsn={effectiveNpsn || null} role={viewerRole}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {wspError ? (
            <Card className="border-rose-200 bg-rose-50">
              <CardContent className="pt-6 text-sm text-rose-700">
                Gagal memuat data pengajuan: {wspError.message || "Silakan refresh halaman."}
              </CardContent>
            </Card>
          ) : null}

          {saveMut.error ? (
            <Card className="border-rose-200 bg-rose-50">
              <CardContent className="pt-6 text-sm text-rose-700">
                {saveMut.error?.message?.includes("OPTIMISTIC_LOCK")
                  ? "Versi data usang — pengguna lain baru saja menyimpan. Silakan refresh halaman untuk mengedit ulang."
                  : saveMut.error?.message || "Gagal menyimpan. Silakan coba lagi."}
              </CardContent>
            </Card>
          ) : null}

          {saveMut.isSuccess ? (
            <Card className="border-emerald-200 bg-emerald-50">
              <CardContent className="pt-6 text-sm text-emerald-700">
                Data pengajuan sarana berhasil disimpan.
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informasi Pengajuan Sarana</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="data_json.nama_sekolah">
                    Nama Sekolah
                  </label>
                  <Controller
                    name="data_json.nama_sekolah"
                    control={control}
                    render={({ field }) => (
                      <Input
                        id="data_json.nama_sekolah"
                        placeholder="Contoh: SMK Negeri 1 Jakarta"
                        value={(field.value as string) ?? namaSekolah}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        disabled={wspLoading || saveMut.isPending || isSubmitting}
                      />
                    )}
                  />
                  {errors?.data_json && typeof errors.data_json === "object" && "nama_sekolah" in errors.data_json
                    ? (errors.data_json as Record<string, { message?: string }>).nama_sekolah?.message ? (
                        <p className="text-xs text-rose-600">
                          {(errors.data_json as Record<string, { message?: string }>).nama_sekolah.message}
                        </p>
                      ) : null
                    : null}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700" htmlFor="data_json.npsn_label">
                    NPSN Sekolah
                  </label>
                  <Input
                    id="data_json.npsn_label"
                    {...register("data_json.npsn_label" as const, { valueAsNumber: false })}
                    placeholder="Contoh: 10100617"
                    value={effectiveNpsn}
                    disabled
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700" htmlFor="data_json.keterangan">
                  Keterangan / Catatan Pengajuan
                </label>
                <textarea
                  id="data_json.keterangan"
                  rows={4}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:bg-slate-50"
                  placeholder="Tambahkan catatan khusus untuk pengajuan sarana ini (opsional)..."
                  {...register("data_json.keterangan" as const)}
                  defaultValue={keterangan}
                  disabled={wspLoading || saveMut.isPending || isSubmitting}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
                <div className="flex-1">
                  {isDirty ? (
                    <p className="text-xs text-amber-700">
                      Ada perubahan belum disimpan. Simpan sebelum meninggalkan halaman.
                    </p>
                  ) : wspLoading ? (
                    <p className="text-xs text-slate-500">Memuat data pengajuan sarana...</p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Versi data: <span className="font-mono">v{wspData?.version ?? 1}</span>
                      {wspData?.updatedAt ? ` · Update: ${new Date(wspData.updatedAt).toLocaleString("id-ID")}` : ""}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void reset({
                      version: wspData?.version ?? 1,
                      data_json: wspData?.data_json ?? {},
                    });
                  }}
                  disabled={saveMut.isPending || isSubmitting || wspLoading || !isDirty}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  disabled={saveMut.isPending || !isDirty || wspLoading || Boolean(wspError)}
                  className="gap-2"
                >
                  {saveMut.isPending || isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>{saveMut.isPending ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </SchoolDetailViewProvider>
    </div>
  );
}

