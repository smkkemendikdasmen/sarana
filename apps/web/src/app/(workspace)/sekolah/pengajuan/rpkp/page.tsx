import { SchoolProposalPage } from "@/components/school/school-proposal-page";
import SchoolWorkspaceProviderWrapper from "@/components/school/school-workspace-provider-wrapper";

export default function SchoolRpkpPage() {
  return (
    <SchoolWorkspaceProviderWrapper>
      <SchoolProposalPage forceActiveTab="rpkp" exclusiveMode="rpkp" />
    </SchoolWorkspaceProviderWrapper>
  );
}
