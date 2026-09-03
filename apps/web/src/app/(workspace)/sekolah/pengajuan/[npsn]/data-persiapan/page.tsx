"use client";

import { useParams } from "next/navigation";

import { SchoolProposalPersiapanPage } from "@/components/school/school-proposal-persiapan-page";

export default function SchoolProposalPersiapanByNpsnRoute() {
  const params = useParams<{ npsn?: string }>();
  const npsn = params?.npsn ? decodeURIComponent(params.npsn) : undefined;
  return <SchoolProposalPersiapanPage npsn={npsn} />;
}
