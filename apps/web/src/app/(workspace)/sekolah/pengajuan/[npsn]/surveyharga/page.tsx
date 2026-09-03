import { SchoolProposalPage } from "@/components/school/school-proposal-page";
import { SchoolDetailViewProvider } from "@/components/school/school-detail-view-context";

export default function AdminSchoolSurveyHargaPage({ params }: { params: { npsn: string } }) {
  return (
    <SchoolDetailViewProvider npsn={params.npsn} role="ADMIN">
      <SchoolProposalPage forceActiveTab="survey" exclusiveMode="survey" />
    </SchoolDetailViewProvider>
  );
}
