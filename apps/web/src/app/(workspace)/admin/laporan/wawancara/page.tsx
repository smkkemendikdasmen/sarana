import { AdminLaporanTabs } from "@/components/admin/admin-reports-page";
import { AdminWawancaraReportsPage } from "@/components/admin/admin-wawancara-reports-page";

export default function AdminWawancaraReportsRoute() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminLaporanTabs />
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Pelaporan &amp; Log
        </p>
        <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
          Laporan Wawancara
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          Rekapitulasi hasil penilaian wawancara per sekolah beserta nilai angka, rekomendasi
          prioritas, dan nama Fasilitator Alat yang melakukan penilaian.
        </p>
      </section>

      <AdminWawancaraReportsPage />
    </div>
  );
}
