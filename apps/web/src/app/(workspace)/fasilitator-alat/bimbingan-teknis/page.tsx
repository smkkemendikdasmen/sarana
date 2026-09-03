import { FacilitatorAlatBimbinganPage } from "@/components/dashboard/fasilitator-alat-bimbingan-page";

export default function FasilitatorAlatBimbinganTeknisRoute() {
  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Bimbingan Teknis Fasilitator Alat
        </p>
        <h1 className="display-font mt-4 text-3xl font-semibold text-slate-950">
          Bimbingan Teknis Sarana &amp; Alat Praktik Sekolah
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          Bimbingan teknis terkait ketersediaan sarana prasarana, data alat praktik per konsentrasi keahlian,
          dan kelengkapan administrasi usulan pengadaan alat bantuan.
        </p>
      </section>
      <FacilitatorAlatBimbinganPage />
    </div>
  );
}
