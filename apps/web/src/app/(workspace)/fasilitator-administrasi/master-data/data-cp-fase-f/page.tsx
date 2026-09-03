import { CpFaseFAccordion } from "@/components/admin/cp-fase-f-accordion";

export default function FasilitatorAdministrasiMasterDataCpPage() {
  return (
    <div>
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Master Data Fasilitator Administrasi
        </p>
        <h1 className="display-font mt-4 text-3xl font-semibold text-slate-950">
          Capaian Pembelajaran Berdasarkan KEPKA BSKAP NOMOR 046/H/KR/2025
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          Referensi Capaian Pembelajaran Fase F sebagai acuan dalam verifikasi Rencana Penggunaan Alat (RPA) dan
          kesesuaian administrasi konsentrasi keahlian pada sekolah binaan.
        </p>

        <div className="mt-6">
          <CpFaseFAccordion />
        </div>
      </section>
    </div>
  );
}
