import { FacilitatorAdministrasiVerifikasiDetailPage } from "@/components/dashboard/fasilitator-administrasi-verifikasi-detail-page";

interface PageProps {
  params: Promise<{ npsn: string }>;
}

export default async function FasilitatorAdministrasiVerifikasiDetailRoute({ params }: PageProps) {
  const { npsn } = await params;
  return <FacilitatorAdministrasiVerifikasiDetailPage npsn={npsn} />;
}
