import { SchoolEquipmentPage } from "@/components/school/school-equipment-page";
import SchoolWorkspaceProviderWrapper from "@/components/school/school-workspace-provider-wrapper";

export default function SchoolEquipmentRoute() {
  return (
    <SchoolWorkspaceProviderWrapper>
      <SchoolEquipmentPage />
    </SchoolWorkspaceProviderWrapper>
  );
}
