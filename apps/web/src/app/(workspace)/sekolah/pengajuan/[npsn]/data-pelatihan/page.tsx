"use client";

import { useParams } from "next/navigation";

import { SchoolProposalPelatihanPage } from "@/components/school/school-proposal-pelatihan-page";

export default function SchoolProposalPelatihanByNpsnRoute() {
  const params = useParams<{ npsn?: string }>();
  const npsn = params?.npsn ? decodeURIComponent(params.npsn) : undefined;
  return <SchoolProposalPelatihanPage npsn={npsn} />;
}
