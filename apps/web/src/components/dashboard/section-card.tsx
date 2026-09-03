import type { DashboardPanel } from "@/lib/dashboard-content";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SectionCard({ panel }: { panel: DashboardPanel }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-0 sm:p-6 sm:pb-0">
        <CardTitle className="display-font text-base sm:text-lg leading-snug">{panel.title}</CardTitle>
        <CardDescription className="leading-6 text-sm">{panel.description}</CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-4 sm:p-6 sm:pt-4">
        <ul className="space-y-2 sm:space-y-3 text-sm text-slate-700">
          {panel.items.map((item) => (
            <li key={item} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4 sm:py-3 break-words">
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
