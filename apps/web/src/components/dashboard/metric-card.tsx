import type { DashboardMetric } from "@/lib/dashboard-content";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const toneClassMap = {
  primary: "border-primary/15 bg-primary/[0.08] text-primary",
  success: "border-success/20 bg-success/[0.08] text-success",
  warning: "border-warning/20 bg-warning/[0.12] text-[#8b6717]",
  danger: "border-danger/20 bg-danger/[0.08] text-danger",
} satisfies Record<DashboardMetric["tone"], string>;

export function MetricCard({ metric }: { metric: DashboardMetric }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:space-y-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-slate-500">{metric.label}</p>
          <Badge className={`${toneClassMap[metric.tone]} w-fit`} variant="outline">
            {metric.change}
          </Badge>
        </div>
        <p className="display-font text-2xl font-semibold text-slate-900 sm:text-3xl break-words">{metric.value}</p>
      </CardContent>
    </Card>
  );
}
