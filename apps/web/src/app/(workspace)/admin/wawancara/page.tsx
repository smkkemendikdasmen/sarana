import { AdminPembagianTugasPage } from "@/components/admin/admin-verifikasi-online-page";

export default function AdminWawancaraRoute() {
  return (
    <AdminPembagianTugasPage
      title="Wawancara"
      subtitle="Pembagian tugas wawancara ke fasilitator untuk sekolah penerima bantuan ABT. Pilih sekolah, tetapkan pasangan fasilitator, lalu terapkan penugasan."
      moduleKey="wawancara"
      defaultActiveTab="abt"
      visibleTabs={["abt"]}
    />
  );
}
