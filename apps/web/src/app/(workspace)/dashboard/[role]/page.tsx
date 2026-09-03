interface DashboardPageProps {
  params: Promise<{ role: string }>;
}

import { RoleDashboardPage } from "@/components/dashboard/role-dashboard-page";
import SchoolWorkspaceProviderWrapper from "@/components/school/school-workspace-provider-wrapper";

export default async function DashboardRolePage({ params }: DashboardPageProps) {
  const { role } = await params;

  return (
    <SchoolWorkspaceProviderWrapper>
      <RoleDashboardPage roleSlug={role} />
    </SchoolWorkspaceProviderWrapper>
  );
}
