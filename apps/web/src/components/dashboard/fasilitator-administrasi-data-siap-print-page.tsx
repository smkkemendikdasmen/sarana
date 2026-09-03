"use client";

import { FacilitatorAdministrasiSectionPage } from "@/components/dashboard/fasilitator-administrasi-section-page";

export function FacilitatorAdministrasiDataSiapPrintPage() {
  return (
    <FacilitatorAdministrasiSectionPage
      eyebrow="Tahap 6 · Alur Tahapan"
      content={{
        title: "Data Siap Print",
        description:
          "Pusat ekspor dan cetak seluruh dokumen administrasi resmi sekolah (BA Verifikasi, BA Wawancara, RPD/PKS tersigned, daftar hadir & sertifikat Bimtek) dengan format standar Ditjen Pendidikan Vokasi.",
        items: [
          "Cetak Berita Acara Verifikasi Administrasi",
          "Cetak Berita Acara Wawancara Sekolah",
          "Cetak RPD & PKS Sudah Tandatangan",
          "Cetak Sertifikat & Daftar Hadir Bimtek",
        ],
      }}
    />
  );
}
