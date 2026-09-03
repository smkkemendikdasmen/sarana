import { AdminPembagianTugasPage } from "@/components/admin/admin-verifikasi-online-page";

export default function AdminVerifikasiOnlineRoute() {
  return (
    <AdminPembagianTugasPage
      title="Verifikasi Online"
      subtitle="Penugasan sekolah ke fasilitator untuk proses review dokumen administrasi & alat secara online. Hanya menampilkan sekolah penerima bantuan ABT."
      moduleKey="verifikasi-online"
      defaultActiveTab="abt"
      visibleTabs={["abt"]}
    />
  );
}
