import { FacilitatorAlatDataDampingan } from "@/components/dashboard/fasilitator-alat-data-dampingan";

export default function FasilitatorAdministrasiDataDampinganPage() {
  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Data Dampingan Fasilitator Administrasi
        </p>
        <h1 className="display-font mt-4 text-3xl font-semibold text-slate-950">
          Daftar Sekolah Didampingi (Administrasi)
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          Daftar sekolah yang menerima pendampingan administrasi oleh Fasilitator Administrasi. Referensi data,
          kontak, dan ringkasan progres administrasi sekolah binaan.
        </p>
      </section>
      <FacilitatorAlatDataDampingan />
    </div>
  );
}
