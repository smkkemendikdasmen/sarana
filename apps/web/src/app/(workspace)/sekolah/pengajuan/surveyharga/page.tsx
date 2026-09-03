import { SchoolProposalPage } from "@/components/school/school-proposal-page";
import SchoolWorkspaceProviderWrapper from "@/components/school/school-workspace-provider-wrapper";

export default function SchoolSurveyHargaPage() {
  return (
    <SchoolWorkspaceProviderWrapper>
      <SchoolProposalPage forceActiveTab="survey" exclusiveMode="survey" />
    </SchoolWorkspaceProviderWrapper>
  );
}
