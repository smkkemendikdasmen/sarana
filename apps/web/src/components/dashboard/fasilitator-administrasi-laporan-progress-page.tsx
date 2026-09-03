"use client";

import { FacilitatorAdministrasiSectionPage } from "@/components/dashboard/fasilitator-administrasi-section-page";

export function FacilitatorAdministrasiLaporanProgressPage() {
  return (
    <FacilitatorAdministrasiSectionPage
      eyebrow="Tahap 7 · Alur Tahapan"
      content={{
        title: "Laporan Progress",
        description:
          "Dasbor laporan progres administrasi end-to-end per sekolah dampingan. Menampilkan rekap per tahapan (Verifikasi Administrasi → Wawancara → Pra-Bimtek → Bimtek → RPD & PKS → Siap Print) beserta status kelengkapan berkas per wilayah.",
        items: [
          "Rekap Progress Administrasi Per Tahapan",
          "Laporan Capaian Kelengkapan Berkas",
          "Rekap Per Wilayah (Provinsi / Kab-Kota)",
          "Export Laporan Excel & PDF Administrasi",
        ],
      }}
    />
  );
}
