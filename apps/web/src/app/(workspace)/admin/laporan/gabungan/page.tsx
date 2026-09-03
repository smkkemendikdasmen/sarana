import { AdminLaporanTabs } from "@/components/admin/admin-reports-page";
import { AdminLaporanGabunganPage } from "@/components/admin/admin-laporan-gabungan-page";

export default function AdminLaporanGabunganRoute() {
  return (
    <div className="space-y-6">
      <AdminLaporanTabs />
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Pelaporan &amp; Log
        </p>
        <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
          Laporan Gabungan
        </h1>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600 md:text-base">
          Rekap gabungan antara <span className="font-semibold text-slate-900">hasil penilaian wawancara</span> dari
          Fasilitator Alat beserta <span className="font-semibold text-slate-900">3 Konsentrasi Keahlian Prioritas</span> per
          sekolah (jumlah siswa terbanyak dari profil sekolah). 17 kolom komposit untuk analisa menyeluruh sasaran sekolah.
        </p>
      </section>

      <AdminLaporanGabunganPage />
    </div>
  );
}
