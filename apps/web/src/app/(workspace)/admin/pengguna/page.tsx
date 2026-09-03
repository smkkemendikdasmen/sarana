import { UsersManagement } from "@/components/admin/users-management";

export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <section className="panel rounded-[32px] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary/70">
          Manajemen Pengguna
        </p>
        <h1 className="display-font mt-3 text-3xl font-semibold text-slate-950">
          Pengaturan akun dan role
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
          Kelola akun pengguna, role, status aktif, dan keterkaitan sekolah untuk kebutuhan operasional SARANA SMK.
        </p>
      </section>

      <UsersManagement />
    </div>
  );
}
