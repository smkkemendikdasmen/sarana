export type ToolGuideCategoryKey = "minimal" | "pengembangan" | "pendukung";

export interface ToolGuideCategoryMeta {
  key: ToolGuideCategoryKey;
  title: string;
  subtitle: string;
  sourceSection: string;
  dataKey:
    | "b2_1_peralatan_praktik_utama_kriteria_minimal"
    | "b2_2_peralatan_praktik_utama_kriteria_pengembangan"
    | "b2_3_peralatan_praktik_pendukung";
}

export const toolGuideCategoryMeta: ToolGuideCategoryMeta[] = [
  {
    key: "minimal",
    title: "Utama Minimal",
    subtitle: "B.2.1 Peralatan Praktik Utama Kriteria Minimal",
    sourceSection: "B.2.1",
    dataKey: "b2_1_peralatan_praktik_utama_kriteria_minimal",
  },
  {
    key: "pengembangan",
    title: "Utama Pengembangan",
    subtitle: "B.2.2 Peralatan Praktik Utama Kriteria Pengembangan",
    sourceSection: "B.2.2",
    dataKey: "b2_2_peralatan_praktik_utama_kriteria_pengembangan",
  },
  {
    key: "pendukung",
    title: "Pendukung",
    subtitle: "B.2.3 Peralatan Praktik Pendukung",
    sourceSection: "B.2.3",
    dataKey: "b2_3_peralatan_praktik_pendukung",
  },
];

export const toolGuideCategoryOrder: ToolGuideCategoryKey[] = toolGuideCategoryMeta.map((item) => item.key);

export const toolGuidePdfPath = "/data/perdirjen-33-tahun-2025.pdf";
