import { AdminLaporanTabs } from "@/components/admin/admin-reports-page";
import { AdminPraBimtekPpkReportsPage } from "@/components/admin/admin-pra-bimtek-ppk-reports-page";

export default function AdminLaporanPraBimtekPpkRoute() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <AdminLaporanTabs />
      <AdminPraBimtekPpkReportsPage />
    </div>
  );
}
