import { FacilitatorAlatVerifikasiOnlineDetailPage } from "@/components/dashboard/fasilitator-alat-verifikasi-online-detail-page";
import { PraBimtekSchoolUpdateHeader } from "@/components/dashboard/pra-bimtek-school-update-header";

interface PageProps {
  params: Promise<{ npsn: string }>;
}

export default async function FasilitatorAlatPraBimtekDetailRoute({ params }: PageProps) {
  const { npsn } = await params;

  return (
    <div className="space-y-5">
      <PraBimtekSchoolUpdateHeader npsn={npsn} />
      <FacilitatorAlatVerifikasiOnlineDetailPage npsn={npsn} />
    </div>
  );
}
