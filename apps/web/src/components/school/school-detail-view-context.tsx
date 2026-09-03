"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export type SchoolDetailViewContextValue = {
  npsn: string | null;
  role: "FASILITATOR_ALAT" | "SEKOLAH" | "ADMIN" | null;
};

const SchoolDetailViewContext = createContext<SchoolDetailViewContextValue>({
  npsn: null,
  role: null,
});

export function SchoolDetailViewProvider({
  children,
  npsn,
  role,
}: {
  children: ReactNode;
  npsn?: string | null;
  role?: SchoolDetailViewContextValue["role"];
}) {
  const value = useMemo<SchoolDetailViewContextValue>(
    () => ({ npsn: npsn ?? null, role: role ?? null }),
    [npsn, role],
  );
  return (
    <SchoolDetailViewContext.Provider value={value}>{children}</SchoolDetailViewContext.Provider>
  );
}

export function useSchoolDetailView(): SchoolDetailViewContextValue {
  return useContext(SchoolDetailViewContext);
}
