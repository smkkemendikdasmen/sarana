"use client";

import { SchoolWorkspaceProvider } from "@/components/school/school-workspace-provider";
import { useAuthStore } from "@/store/auth-store";
import React from "react";

/**
 * SchoolWorkspaceProviderWrapper — membungkus children dengan Provider yang
 * otomatis membaca token dari useAuthStore (auth-store.ts global).
 * DIPAKAI DI 4 HALAMAN UTAMA sekolah:
 *   - /sekolah/profil
 *   - /sekolah/alat
 *   - /sekolah/pengajuan + 3 subpages
 *   - /dashboard/sekolah
 *
 * Jika user belum login → token null, Provider TIDAK crash.
 */
export default function SchoolWorkspaceProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session } = useAuthStore();
  const token = session?.token ?? undefined;
  const userId = session?.user?.id ? String(session.user.id) : undefined;
  return (
    <SchoolWorkspaceProvider token={token} userId={userId}>
      {children}
    </SchoolWorkspaceProvider>
  );
}
