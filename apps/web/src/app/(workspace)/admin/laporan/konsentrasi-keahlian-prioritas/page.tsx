import { AdminLaporanTabs } from "@/components/admin/admin-reports-page";
import { AdminKonsentrasiKeahlianPrioritasPage } from "@/components/admin/admin-konsentrasi-keahlian-prioritas-page";

export default function AdminKonsentrasiKeahlianPrioritasRoute() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminLaporanTabs />
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Pelaporan &amp; Log
        </p>
        <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
          Laporan Konsentrasi Keahlian Prioritas
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
          Rekap 3 (tiga) konsentrasi keahlian / jurusan dengan jumlah siswa terbanyak untuk
          masing-masing sekolah. Data diambil langsung dari profil sekolah setiap NPSN
          (school_profile_concentrations).
        </p>
      </section>

      <AdminKonsentrasiKeahlianPrioritasPage />
    </div>
  );
}
