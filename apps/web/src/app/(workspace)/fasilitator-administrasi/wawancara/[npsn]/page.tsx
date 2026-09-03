import { FacilitatorAdministrasiWawancaraDetailPage } from "@/components/dashboard/fasilitator-administrasi-wawancara-detail-page";

interface PageProps {
  params: Promise<{ npsn: string }>;
}

export default async function FasilitatorAdministrasiWawancaraDetailRoute({ params }: PageProps) {
  const { npsn } = await params;
  return <FacilitatorAdministrasiWawancaraDetailPage npsn={npsn} />;
}
