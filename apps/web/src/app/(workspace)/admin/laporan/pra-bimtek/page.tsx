import { AdminLaporanTabs } from "@/components/admin/admin-reports-page";
import { AdminPraBimtekReportsPage } from "@/components/admin/admin-pra-bimtek-reports-page";

export default function AdminLaporanPraBimtekRoute() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminLaporanTabs />
      <AdminPraBimtekReportsPage />
    </div>
  );
}
