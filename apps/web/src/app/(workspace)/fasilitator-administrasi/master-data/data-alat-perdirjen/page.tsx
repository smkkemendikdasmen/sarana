import { PeralatanBidangAccordion } from "@/components/admin/peralatan-bidang-accordion";

export default function FasilitatorAdministrasiMasterDataAlatPage() {
  return (
    <div>
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Master Data Fasilitator Administrasi
        </p>
        <h1 className="display-font mt-4 text-3xl font-semibold text-slate-950">
          Data Peralatan berdasarkan PERDIRJEN 33 TAHUN 2025 dan PERKA BSKAP NO 019/F/KP/2026
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          Halaman referensi daftar alat perdirjen yang menjadi acuan administrasi sekolah penerima bantuan.
          Fasilitator Administrasi dapat memverifikasi kesesuaian nomenklatur alat pada dokumen administrasi sekolah.
        </p>

        <div className="mt-6">
          <PeralatanBidangAccordion />
        </div>
      </section>
    </div>
  );
}
