import { SekolahPenerimaAbtTable } from "@/components/admin/sekolah-penerima-abt-table";

export default function AdminSekolahPenerimaAbtPage() {
  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Data Banper 2026
        </p>
        <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
          Sekolah Penerima Alat Dana ABT
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          Daftar sekolah penerima bantuan alat dari skema Dana ABT. Gunakan pencarian untuk menemukan sekolah, lalu
          buka detail untuk melihat profil, cakupan keahlian, serta ringkasan usulan.
        </p>
      </section>

      <SekolahPenerimaAbtTable />
    </div>
  );
}
