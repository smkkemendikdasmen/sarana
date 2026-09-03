import { FacilitatorAdministrasiWawancaraPage } from "@/components/dashboard/fasilitator-administrasi-wawancara-page";

export default function FasilitatorAdministrasiWawancaraRoute() {
  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Wawancara Fasilitator Administrasi
        </p>
        <h1 className="display-font mt-4 text-3xl font-semibold text-slate-950">
          Jadwal Wawancara Sekolah Binaan
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          Tetapkan tanggal, jam, dan link meeting wawancara untuk masing-masing sekolah dampingan
          dalam tahapan wawancara administrasi.
        </p>
      </section>
      <FacilitatorAdministrasiWawancaraPage />
    </div>
  );
}
