import { AdminPembagianTugasPage } from "@/components/admin/admin-verifikasi-online-page";

export default function AdminPraBimtekRoute() {
  return (
    <AdminPembagianTugasPage
      title="Pra Bimtek"
      subtitle="Pembagian tugas Pra Bimtek ke Fasilitator Alat dan Fasilitator Administrasi untuk sekolah penerima bantuan ABT. Ruang lingkup penugasan mencakup verifikasi 3 (tiga) tahapan usulan pengadaan: Survey Harga Pasar, RPKP (Rencana Pengadaan Kebutuhan Peralatan), dan RAB (Rencana Anggaran Biaya) per Konsentrasi Keahlian prioritas."
      moduleKey="pra-bimtek"
      defaultActiveTab="abt"
      visibleTabs={["abt"]}
    />
  );
}
