import { FacilitatorAdministrasiBimtekDetailPage } from "@/components/dashboard/fasilitator-administrasi-bimtek-detail-page";

interface PageProps {
  params: Promise<{ npsn: string }>;
}

export default async function FasilitatorAdministrasiBimbinganTeknisDetailRoute({ params }: PageProps) {
  const { npsn } = await params;
  return <FacilitatorAdministrasiBimtekDetailPage npsn={npsn} />;
}
