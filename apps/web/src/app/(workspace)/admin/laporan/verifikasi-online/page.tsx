import { AdminLaporanTabs } from "@/components/admin/admin-reports-page";
import { AdminVerifikasiOnlineReportsPage } from "@/components/admin/admin-verifikasi-online-reports-page";

export default function AdminVerifikasiOnlineReportsRoute() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminLaporanTabs />
      <section className="panel rounded-[28px] sm:rounded-[32px] px-6 py-6 sm:px-8 sm:py-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Pelaporan &amp; Log
        </p>
        <h1 className="display-font mt-3 text-2xl sm:text-3xl font-semibold text-slate-950">
          Laporan Verifikasi Online per Sekolah
        </h1>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-600 md:text-base">
          Rekapitulasi hasil verifikasi online per sekolah, mencakup ringkasan profil sekolah, 12 butir
          dokumen administrasi, kondisi alat praktik (dalam format Excel), dan daftar ajuan alat bantuan
          sarana (dalam format PDF landscape A4).
        </p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="font-semibold text-slate-700">Data Sekolah</span>
            <p className="mt-1 text-slate-600">Preview PDF &amp; Download PDF A4 Portrait.</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="font-semibold text-slate-700">12 Dokumen Administrasi</span>
            <p className="mt-1 text-slate-600">Rekap checklist upload &amp; verifikasi (Preview + PDF).</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="font-semibold text-slate-700">Kondisi Alat · Ajuan Alat</span>
            <p className="mt-1 text-slate-600">Download Excel (Kondisi) + PDF Landscape (Ajuan).</p>
          </div>
        </div>
      </section>

      <AdminVerifikasiOnlineReportsPage />
    </div>
  );
}
