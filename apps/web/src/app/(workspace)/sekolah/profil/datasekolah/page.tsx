import { SchoolProfileManager } from "@/components/school/school-profile-manager";
import SchoolWorkspaceProviderWrapper from "@/components/school/school-workspace-provider-wrapper";

export default function SchoolProfileDataSekolahPage() {
  return (
    <SchoolWorkspaceProviderWrapper>
      <SchoolProfileManager forceActiveTab="data-sekolah" />
    </SchoolWorkspaceProviderWrapper>
  );
}
