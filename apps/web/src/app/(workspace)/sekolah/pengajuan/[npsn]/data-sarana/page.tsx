"use client";

import { useParams } from "next/navigation";

import { SchoolProposalSaranaPage } from "@/components/school/school-proposal-sarana-page";

export default function SchoolProposalSaranaByNpsnRoute() {
  const params = useParams<{ npsn?: string }>();
  const npsn = params?.npsn ? decodeURIComponent(params.npsn) : undefined;
  return <SchoolProposalSaranaPage schoolNpsn={npsn} viewerRole="ADMIN" />;
}
