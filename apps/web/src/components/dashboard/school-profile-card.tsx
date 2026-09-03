import type { ReactNode } from "react";
import { BadgeCheck, Building2, MapPinned, ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SchoolProfileSummary } from "@/lib/dashboard-content";

export function SchoolProfileCard({
  profile,
}: {
  profile: SchoolProfileSummary;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Badge variant="outline" className="w-fit gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Profil Sekolah
          </Badge>
          <CardTitle className="display-font mt-4 text-2xl">{profile.schoolName}</CardTitle>
          <CardDescription className="mt-2 max-w-2xl leading-6">
            Ringkasan identitas sekolah yang menjadi dasar pengelolaan alat, pengajuan kebutuhan, dan bantuan sarana.
          </CardDescription>
        </div>

        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          {profile.profileStatus}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <ProfileItem
            icon={<ShieldCheck className="h-4 w-4 text-slate-500" />}
            label="NPSN"
            value={profile.npsn}
          />
          <ProfileItem
            icon={<UserRound className="h-4 w-4 text-slate-500" />}
            label="Kepala Sekolah"
            value={profile.principalName}
          />
          <ProfileItem
            icon={<BadgeCheck className="h-4 w-4 text-slate-500" />}
            label="Operator / PIC"
            value={profile.operatorName}
          />
          <ProfileItem
            icon={<MapPinned className="h-4 w-4 text-slate-500" />}
            label="Wilayah"
            value={profile.region}
          />
          <ProfileItem
            icon={<BadgeCheck className="h-4 w-4 text-slate-500" />}
            label="Pembaruan Terakhir"
            value={profile.lastUpdate}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-900">{value}</p>
    </article>
  );
}
