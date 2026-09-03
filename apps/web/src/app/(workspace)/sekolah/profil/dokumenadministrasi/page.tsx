import { SchoolProfileManager } from "@/components/school/school-profile-manager";
import SchoolWorkspaceProviderWrapper from "@/components/school/school-workspace-provider-wrapper";

export default function SchoolProfileDokumenAdministrasiPage() {
  return (
    <SchoolWorkspaceProviderWrapper>
      <SchoolProfileManager forceActiveTab="dokumen-administrasi" />
    </SchoolWorkspaceProviderWrapper>
  );
}
