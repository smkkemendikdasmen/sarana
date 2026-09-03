import { SchoolProposalIndexPage } from "@/components/school/school-proposal-index-page";
import SchoolWorkspaceProviderWrapper from "@/components/school/school-workspace-provider-wrapper";

export default function SchoolProposalIndexRoute() {
  return (
    <SchoolWorkspaceProviderWrapper>
      <SchoolProposalIndexPage />
    </SchoolWorkspaceProviderWrapper>
  );
}
