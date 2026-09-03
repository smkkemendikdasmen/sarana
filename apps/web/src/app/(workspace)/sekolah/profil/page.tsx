"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SchoolProfileIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/sekolah/profil/datasekolah");
  }, [router]);
  return null;
}
