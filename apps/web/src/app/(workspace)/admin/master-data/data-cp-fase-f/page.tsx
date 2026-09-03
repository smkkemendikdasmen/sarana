import { CpFaseFAccordion } from "@/components/admin/cp-fase-f-accordion";

export default function AdminDataCpfaseFPage() {
  return (
    <div>
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Struktur Konsentrasi Keahlian dan Capaian Pembelajaran
        </p>
        <h1 className="display-font mt-4 text-3xl font-semibold text-slate-950">
          Capaian pembelajaran Berdasarkan KEPKA BSKAP NOMOR 046/H/KR/2025
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          Halaman ini disiapkan untuk mengelola referensi Capaian Pembelajaran Fase F sebagai dasar
          pemetaan kebutuhan alat, kompetensi, dan kesesuaian program keahlian.
        </p>

        <div className="mt-6">
          <CpFaseFAccordion />
        </div>
      </section>
    </div>
  );
}
