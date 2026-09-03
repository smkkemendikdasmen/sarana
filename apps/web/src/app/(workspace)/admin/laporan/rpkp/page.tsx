import { AdminLaporanTabs } from "@/components/admin/admin-reports-page";
import { AdminRpkpReportsPage } from "@/components/admin/admin-rpkp-reports-page";

export default function AdminRpkpReportsRoute() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminLaporanTabs />
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Pelaporan &amp; Log
        </p>
        <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
          Laporan RPKP
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          Rekapitulasi seluruh data alat Rencana Pemenuhan Kebutuhan Peralatan
          (RPKP) yang telah dipilih oleh 132 sekolah SMK penerima bantuan
          sarana, termasuk nilai total anggaran dan pilihan toko per item
          peralatan.
        </p>
      </section>

      <AdminRpkpReportsPage />
    </div>
  );
}
