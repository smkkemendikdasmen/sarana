import { AdminSekolahPenerimaWorkspace } from "@/components/admin/admin-sekolah-penerima-workspace";

export default function AdminRegulerSekolahPenerimaRoute() {
  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Data Banper Reguler 2026
        </p>
        <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
          Data Sekolah Penerima Bantuan Reguler
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
          Daftar sekolah penerima bantuan sarana prasarana dari skema Dana Alokasi Khusus
          Reguler tahun 2026.
        </p>
      </section>

      <AdminSekolahPenerimaWorkspace />
    </div>
  );
}
