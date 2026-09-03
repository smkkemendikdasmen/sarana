import { SchoolProposalPage } from "@/components/school/school-proposal-page";
import { SchoolDetailViewProvider } from "@/components/school/school-detail-view-context";

export default function AdminSchoolRpkpPage({ params }: { params: { npsn: string } }) {
  return (
    <SchoolDetailViewProvider npsn={params.npsn} role="ADMIN">
      <SchoolProposalPage forceActiveTab="rpkp" exclusiveMode="rpkp" />
    </SchoolDetailViewProvider>
  );
}
