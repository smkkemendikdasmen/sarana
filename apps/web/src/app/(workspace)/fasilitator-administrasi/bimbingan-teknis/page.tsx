import { FacilitatorAlatBimbinganPage } from "@/components/dashboard/fasilitator-alat-bimbingan-page";

export default function FasilitatorAdministrasiBimbinganTeknisRoute() {
  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Bimbingan Teknis Fasilitator Administrasi
        </p>
        <h1 className="display-font mt-4 text-3xl font-semibold text-slate-950">
          Bimbingan Teknis Administrasi &amp; Dokumen Sekolah
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          Bimbingan teknis terkait pengelolaan dokumen administrasi sekolah, tata kelola laporan, dan kelengkapan
          administrasi penerima bantuan.
        </p>
      </section>
      <FacilitatorAlatBimbinganPage />
    </div>
  );
}
