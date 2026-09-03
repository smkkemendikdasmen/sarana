import { AdminReportsPage } from "@/components/admin/admin-reports-page";

export default function AdminReportsRoutePage() {
  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Pelaporan &amp; Log
        </p>
        <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
          Laporan SARANA SMK
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          Ringkasan rekapitulasi data sekolah, penugasan fasilitator, progress verifikasi, dan
          laporan bantuan sarana per wilayah.
        </p>
      </section>

      <AdminReportsPage />
    </div>
  );
}
