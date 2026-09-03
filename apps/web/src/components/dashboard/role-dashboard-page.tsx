"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { dashboardPath, roleSlugMap, slugRoleMap } from "@/lib/roles";
import { useAuthStore } from "@/store/auth-store";
import { DashboardHome } from "@/components/dashboard/dashboard-home";

export function RoleDashboardPage({ roleSlug }: { roleSlug: string }) {
  const router = useRouter();
  const { hydrate, hydrated, session } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !session) {
      return;
    }

    if (!slugRoleMap[roleSlug] || roleSlugMap[session.user.role] !== roleSlug) {
      router.replace(dashboardPath(session.user.role));
    }
  }, [hydrated, roleSlug, router, session]);

  if (!hydrated || !session || roleSlugMap[session.user.role] !== roleSlug) {
    return null;
  }

  return <DashboardHome roleSlug={roleSlug} session={session} />;
}
