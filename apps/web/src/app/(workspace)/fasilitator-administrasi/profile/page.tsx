import { FacilitatorAdministrasiProfilePage } from "@/components/dashboard/fasilitator-administrasi-profile-page";

export default function FasilitatorAdministrasiProfileRoute() {
  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Pengaturan Akun
        </p>
        <h1 className="display-font mt-4 text-3xl font-semibold text-slate-950">
          Profile Fasilitator Administrasi
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          Kelola data pribadi dan pengaturan keamanan akun Fasilitator Administrasi.
        </p>
      </section>
      <FacilitatorAdministrasiProfilePage />
    </div>
  );
}
