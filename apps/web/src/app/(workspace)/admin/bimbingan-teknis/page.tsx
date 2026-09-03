import { AdminPembagianTugasPage } from "@/components/admin/admin-verifikasi-online-page";

export default function AdminBimbinganTeknisRoute() {
  return (
    <AdminPembagianTugasPage
      title="Bimbingan Teknis"
      subtitle="Pembagian tugas bimbingan teknis (review Survey, RPKP, RAB) ke fasilitator untuk sekolah penerima bantuan ABT. Fokus hanya pada data sekolah ABT."
      moduleKey="bimbingan-teknis"
      defaultActiveTab="abt"
      visibleTabs={["abt"]}
    />
  );
}
