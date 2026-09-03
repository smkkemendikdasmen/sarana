import { FacilitatorAlatVerifikasiOnlineDetailPage } from "@/components/dashboard/fasilitator-alat-verifikasi-online-detail-page";

interface PageProps {
  params: Promise<{ npsn: string }>;
}

export default async function FasilitatorAlatVerifikasiOnlineDetailRoute({ params }: PageProps) {
  const { npsn } = await params;
  return <FacilitatorAlatVerifikasiOnlineDetailPage npsn={npsn} />;
}
