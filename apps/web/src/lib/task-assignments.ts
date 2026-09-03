"use client";

export type AssignmentTabKey = "bantuan" | "abt";
export type AssignmentModuleKey = "wawancara" | "bimbingan-teknis" | "verifikasi-online" | "pra-bimtek";

export const assignmentTabs: Array<{
  key: AssignmentTabKey;
  label: string;
  sourceLabel: string;
}> = [
  {
    key: "bantuan",
    label: "Sekolah Penerima Bantuan",
    sourceLabel: "data sekolah penerima bantuan",
  },
  {
    key: "abt",
    label: "Sekolah Penerima Bantuan ABT",
    sourceLabel: "data sekolah penerima bantuan ABT",
  },
];

export const assignmentModuleLabels: Record<AssignmentModuleKey, string> = {
  wawancara: "Wawancara",
  "bimbingan-teknis": "Bimbingan Teknis",
  "verifikasi-online": "Verifikasi Online",
  "pra-bimtek": "Pra Bimtek",
};

export type TaskAssignmentRecord = {
  key: string;
  moduleKey: AssignmentModuleKey;
  moduleLabel: string;
  sourceTab: AssignmentTabKey;
  sourceLabel: string;
  schoolNo: number;
  schoolNpsn: string;
  schoolName: string;
  facilitatorAdministrationId: string;
  facilitatorAdministrationName: string;
  facilitatorEquipmentId: string;
  facilitatorEquipmentName: string;
  updatedAt: string;
};
