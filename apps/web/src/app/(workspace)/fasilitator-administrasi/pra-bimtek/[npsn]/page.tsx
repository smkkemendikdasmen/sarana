import { FacilitatorAdministrasiPraBimtekDetailPage } from "@/components/dashboard/fasilitator-administrasi-pra-bimtek-detail-page";

interface PageProps {
  params: Promise<{ npsn: string }>;
}

export default async function FasilitatorAdministrasiPraBimtekDetailRoute({ params }: PageProps) {
  const { npsn } = await params;
  return <FacilitatorAdministrasiPraBimtekDetailPage npsn={npsn} />;
}
