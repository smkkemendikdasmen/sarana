"use client";

import type { InterviewPerComponentAnswer, WorkspaceSchoolProposalData } from "@/lib/api";
import type { TaskAssignmentRecord } from "@/lib/task-assignments";

export type InterviewScoreCriterion = { score: 1 | 2 | 3 | 4 | 5; label: string };

export const interviewQuestionDefinitions = [
  {
    key: "dampakBencana",
    label: "1 · Dampak Bencana",
    weightPercent: 20,
    helper:
      "Mengukur tingkat kerusakan atau kehilangan sarana, ruang praktik, dan peralatan akibat bencana.",
    interviewGuide: [
      "Bencana apa yang terjadi di sekolah? Kapan waktunya?",
      "Ruang praktik mana yang terdampak?",
      "Peralatan apa saja yang rusak atau hilang?",
      "Apakah ada inventaris sebelum bencana dan laporan pendataan kerusakan?",
      "Kira-kira berapa persen peralatan yang masih dapat digunakan?",
    ],
    criteria: [
      { score: 5, label: ">80% peralatan praktik rusak/hilang atau ruang praktik tidak dapat digunakan" },
      { score: 4, label: "61–80% peralatan rusak/hilang atau sebagian besar ruang praktik tidak dapat digunakan" },
      { score: 3, label: "41–60% peralatan rusak/hilang atau fungsi ruang praktik terganggu" },
      { score: 2, label: "21–40% peralatan rusak/hilang tetapi pembelajaran masih dapat berjalan terbatas" },
      { score: 1, label: "≤20% peralatan rusak/hilang dan ruang praktik masih dapat digunakan" },
    ],
  },
  {
    key: "urgensiPemulihan",
    label: "2 · Urgensi Pemulihan Pembelajaran",
    weightPercent: 20,
    helper:
      "Mengukur seberapa besar kondisi pasca bencana menghambat atau menghentikan proses pembelajaran praktik.",
    interviewGuide: [
      "Pembelajaran praktik apa yang saat ini tidak dapat dilakukan?",
      "Konsentrasi keahlian mana yang paling terdampak?",
      "Berapa rombongan belajar yang tidak dapat praktik?",
      "Apakah sekolah memakai metode praktik alternatif atau dialihkan ke tempat lain?",
      "Jika alat tidak tersedia segera, dampaknya pada kelulusan/asesmen siswa?",
    ],
    criteria: [
      { score: 5, label: "Pembelajaran praktik pada kompetensi terdampak praktis berhenti" },
      { score: 4, label: ">75% kegiatan praktik tidak dapat dilaksanakan" },
      { score: 3, label: "51–75% kegiatan praktik terganggu" },
      { score: 2, label: "26–50% kegiatan praktik terganggu" },
      { score: 1, label: "≤25% kegiatan praktik terganggu" },
    ],
  },
  {
    key: "gapPeralatan",
    label: "3 · Kesenjangan / GAP Peralatan",
    weightPercent: 15,
    helper:
      "Mengukur perbedaan antara kebutuhan peralatan dengan alat yang masih tersedia dan layak digunakan. Gap = 100% – Ketersediaan alat.",
    interviewGuide: [
      "Daftar kebutuhan alat: berapa jumlah yang dibutuhkan?",
      "Berapa jumlah inventaris yang masih layak dipakai saat ini?",
      "Jumlah rombongan belajar dan peserta didik sebagai dasar perhitungan?",
      "Apakah ada standar kebutuhan peralatan pembelajaran yang dipakai?",
    ],
    criteria: [
      { score: 5, label: "Gap >80%" },
      { score: 4, label: "Gap 61–80%" },
      { score: 3, label: "Gap 41–60%" },
      { score: 2, label: "Gap 21–40%" },
      { score: 1, label: "Gap ≤20%" },
    ],
  },
  {
    key: "kesesuaianUsulan",
    label: "4 · Kesesuaian Usulan Alat",
    weightPercent: 10,
    helper:
      "Mengukur apakah alat yang diminta benar-benar sesuai dengan kebutuhan pemulihan pembelajaran (rantai: Bencana → kerusakan → gangguan → kebutuhan alat).",
    interviewGuide: [
      "Mengapa alat ini menjadi prioritas dibanding alat lainnya?",
      "Mapel apa yang memakai alat tersebut dan berapa siswa pengguna?",
      "Berapa alat yang tersedia, rusak, atau hilang saat ini?",
      "Apa dampak jika alat tersebut tidak tersedia?",
      "Jika hanya sebagian usulan yang dapat dipenuhi, mana yang paling mendesak?",
    ],
    criteria: [
      { score: 5, label: "Seluruh/sebagian besar alat yang diusulkan merupakan alat kritis untuk memulihkan pembelajaran" },
      { score: 4, label: "Sebagian besar alat sangat relevan dan dibutuhkan" },
      { score: 3, label: "Alat relevan tetapi sebagian bukan kebutuhan mendesak" },
      { score: 2, label: "Sebagian besar usulan kurang terkait dengan kebutuhan pemulihan" },
      { score: 1, label: "Usulan tidak menunjukkan hubungan yang jelas dengan dampak bencana" },
    ],
  },
  {
    key: "dampakPesertaDidik",
    label: "5 · Dampak terhadap Peserta Didik",
    weightPercent: 10,
    helper:
      "Mengukur jumlah peserta didik yang mendapatkan manfaat langsung dari bantuan dan tingkat gangguan pembelajaran yang mereka alami.",
    interviewGuide: [
      "Berapa jumlah siswa per konsentrasi keahlian yang terdampak?",
      "Berapa jumlah rombongan belajar yang terkena dampak?",
      "Berapa siswa yang tidak dapat praktik sama sekali?",
      "Kelas mana yang paling terdampak dan ada yang menghadapi ujian/asesmen praktik?",
      "Apakah gangguan praktik berpotensi menghambat kelulusan atau kompetensi siswa?",
    ],
    criteria: [
      { score: 5, label: ">500 siswa terdampak atau sebagian besar siswa pada kompetensi terdampak tidak dapat praktik" },
      { score: 4, label: "301–500 siswa terdampak" },
      { score: 3, label: "151–300 siswa terdampak" },
      { score: 2, label: "51–150 siswa terdampak" },
      { score: 1, label: "≤50 siswa terdampak" },
    ],
  },
  {
    key: "kesesuaianIndustri",
    label: "6 · Kesesuaian dengan Dunia Kerja / Industri",
    weightPercent: 5,
    helper:
      "Mengukur relevansi peralatan dengan kompetensi yang dibutuhkan dunia kerja dan industri.",
    interviewGuide: [
      "Industri apa yang relevan dengan konsentrasi keahlian sekolah?",
      "Apakah alat tersebut juga digunakan di industri/perusahaan yang relevan? Di mana?",
      "Apakah sekolah memiliki kerja sama/PKL dengan industri terkait?",
      "Apakah industri pernah memberikan masukan mengenai kebutuhan peralatan?",
      "Bagaimana alat tersebut mendukung kompetensi kerja siswa?",
    ],
    criteria: [
      { score: 5, label: "Alat merupakan peralatan utama yang relevan dengan kompetensi industri" },
      { score: 4, label: "Alat sangat relevan dengan kebutuhan kompetensi kerja" },
      { score: 3, label: "Alat relevan tetapi penggunaannya terbatas" },
      { score: 2, label: "Relevansi dengan kebutuhan kerja rendah" },
      { score: 1, label: "Tidak terdapat hubungan yang jelas" },
    ],
  },
  {
    key: "lokasiUtilitas",
    label: "7 · Kondisi Lokasi dan Utilitas",
    weightPercent: 10,
    helper:
      "Memastikan bantuan alat dapat langsung atau segera digunakan. Indikator: ruang praktik, listrik & daya, air, internet, ventilasi, pencahayaan, dan keamanan ruang.",
    interviewGuide: [
      "Apakah ruang praktik dan bangunan saat ini aman & dapat digunakan?",
      "Kondisi lantai/dinding/plafon dan area penyimpanan alat?",
      "Daya listrik sekolah vs kebutuhan daya alat (VA) — apakah memadai?",
      "Apakah air, internet, ventilasi, dan pencahayaan tersedia/memadai?",
      "Panel/instalasi listrik terdampak dan aman?",
    ],
    criteria: [
      { score: 5, label: "Ruang dan seluruh utilitas utama siap digunakan" },
      { score: 4, label: "Siap digunakan dengan perbaikan ringan" },
      { score: 3, label: "Dapat digunakan tetapi terdapat utilitas yang perlu diperbaiki" },
      { score: 2, label: "Ruang/utilitas belum memadai dan membutuhkan perbaikan" },
      { score: 1, label: "Ruang belum dapat digunakan" },
    ],
  },
  {
    key: "sdmPengelolaan",
    label: "8 · SDM dan Pengelolaan",
    weightPercent: 5,
    helper:
      "Mengukur kesiapan sekolah untuk menggunakan, mengelola, dan merawat bantuan.",
    interviewGuide: [
      "Berapa guru produktif dan teknisi/laboran yang tersedia?",
      "Apakah guru memiliki kompetensi untuk mengoperasikan alat?",
      "Siapa penanggung jawab alat, struktur pengelola bengkel/laboratorium?",
      "Apakah sekolah memiliki SOP penggunaan, SOP K3, dan rencana pemeliharaan?",
    ],
    criteria: [
      { score: 5, label: "Guru/teknisi tersedia, kompeten, dan sistem pengelolaan/pemeliharaan siap" },
      { score: 4, label: "SDM tersedia dan sebagian besar sistem pengelolaan siap" },
      { score: 3, label: "SDM tersedia tetapi pengelolaan belum optimal" },
      { score: 2, label: "SDM terbatas dan sistem pengelolaan belum tersedia" },
      { score: 1, label: "Tidak tersedia SDM/pengelola yang memadai" },
    ],
  },
  {
    key: "rencanaPemulihan",
    label: "9 · Rencana Pemulihan dan Pemanfaatan Bantuan",
    weightPercent: 5,
    helper:
      "Mengukur kesiapan sekolah setelah bantuan diterima dan target hasil pemulihan.",
    interviewGuide: [
      "Apa yang akan dilakukan setelah alat diterima?",
      "Kapan alat mulai digunakan dan siapa penanggung jawabnya?",
      "Berapa siswa pengguna dan pembelajaran apa yang akan dipulihkan?",
      "Bagaimana jadwal penggunaan dan pemeliharaan alat?",
      "Apa target sekolah setelah alat diterima?",
    ],
    criteria: [
      { score: 5, label: "Memiliki rencana pemulihan yang jelas, jadwal penggunaan, penanggung jawab, dan target hasil" },
      { score: 4, label: "Rencana pemulihan jelas tetapi beberapa aspek belum lengkap" },
      { score: 3, label: "Memiliki rencana umum tetapi belum rinci" },
      { score: 2, label: "Rencana masih berupa pernyataan umum" },
      { score: 1, label: "Tidak memiliki rencana pemanfaatan yang jelas" },
    ],
  },
] as const;

export type InterviewQuestionKey = (typeof interviewQuestionDefinitions)[number]["key"];
export type InterviewAnswerValue = 1 | 2 | 3 | 4 | 5;

export type InterviewAssessmentComponentAnswers = Record<
  InterviewQuestionKey,
  { score: InterviewAnswerValue; comment: string }
>;

export function isInterviewComponentAnswer(value: unknown): value is InterviewPerComponentAnswer {
  if (typeof value === "object" && value !== null) {
    const obj = value as Partial<InterviewPerComponentAnswer>;
    return (
      (obj.score === 1 ||
        obj.score === 2 ||
        obj.score === 3 ||
        obj.score === 4 ||
        obj.score === 5) &&
      typeof obj.comment === "string"
    );
  }
  return false;
}

export function normalizeInterviewAnswers(payload: Record<string, unknown>): InterviewAssessmentComponentAnswers {
  return interviewQuestionDefinitions.reduce((acc, question) => {
    const raw = payload[question.key];
    if (isInterviewComponentAnswer(raw)) {
      acc[question.key] = { score: raw.score, comment: raw.comment ?? "" };
    } else if (typeof raw === "number" && (raw === 1 || raw === 2 || raw === 3 || raw === 4 || raw === 5)) {
      acc[question.key] = { score: raw as InterviewAnswerValue, comment: "" };
    } else {
      acc[question.key] = { score: 3, comment: "" };
    }
    return acc;
  }, {} as InterviewAssessmentComponentAnswers);
}

export type InterviewAssessmentAnswers = InterviewAssessmentComponentAnswers;

export type InterviewAssessmentRecord = {
  assignmentKey: string;
  schoolNpsn: string;
  schoolName: string;
  facilitatorEquipmentId: string;
  facilitatorEquipmentName: string;
  answers: InterviewAssessmentAnswers;
  totalScore: number;
  recommendation: string;
  note: string;
  updatedAt: string;
};

export type BimtekDocumentKey = "survey" | "rpkp" | "rab";
export type BimtekDocumentReviewStatus = "pending" | "revisi" | "approved";

export type BimtekReviewRecord = {
  schoolNpsn: string;
  schoolName: string;
  facilitatorEquipmentId: string;
  facilitatorEquipmentName: string;
  statuses: Record<BimtekDocumentKey, BimtekDocumentReviewStatus>;
  notes: Record<BimtekDocumentKey, string>;
  fasilAlatComment?: string | null;
  fasilAdminComment?: string | null;
  updatedAt: string;
};

export type ProposalShopKey = "shop1" | "shop2" | "shop3";

export type ProposalShopQuote = {
  priceWithTax: string;
  shippingCost: string;
  installationCost: string;
  totalPrice: string;
  link: string;
};

export type ProposalDocumentRow = {
  id: string;
  name: string;
  specification: string;
  conformity: string;
  quantity: string;
  unit: string;
  shop1: ProposalShopQuote;
  shop2: ProposalShopQuote;
  shop3: ProposalShopQuote;
};

export type ProposalRpkpRow = {
  id: string;
  name: string;
  specification: string;
  selectedShop: ProposalShopKey | "";
  selectedQuote: ProposalShopQuote;
};

export type ProposalRabRow = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type SchoolProposalConcentrationBundle = {
  concentrationCode: string;
  surveyRows: ProposalDocumentRow[];
  rpkpRows: ProposalRpkpRow[];
  rabRows: ProposalRabRow[];
};

export type SchoolProposalBundle = {
  schoolId: string;
  concentrations: SchoolProposalConcentrationBundle[];
  surveyItemCount: number;
  rpkpItemCount: number;
  rabItemCount: number;
  surveyTotal: number;
  rpkpTotal: number;
  rabTotal: number;
};

export type FacilitatorSchoolTaskRow = {
  assignmentKey: string;
  schoolNo: number;
  schoolNpsn: string;
  schoolName: string;
  sourceTabs: Array<"bantuan" | "abt">;
  facilitatorAdministrationName: string;
  facilitatorEquipmentName: string;
  updatedAt: string;
  records: TaskAssignmentRecord[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

export function normalizeUserName(fullName: string) {
  return normalizeText(fullName.replace(/\s+(PRISMA|SARANA\s*SMK)$/i, ""));
}

function parseCurrencyNumber(value: string) {
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function parseQuantityNumber(value: string) {
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function isInterviewAnswerValue(value: unknown): value is InterviewAnswerValue {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

function isBimtekReviewStatus(value: unknown): value is BimtekDocumentReviewStatus {
  return value === "pending" || value === "revisi" || value === "approved";
}

function isProposalShopQuote(value: unknown): value is ProposalShopQuote {
  return (
    isObject(value) &&
    typeof value.priceWithTax === "string" &&
    typeof value.shippingCost === "string" &&
    typeof value.installationCost === "string" &&
    typeof value.totalPrice === "string" &&
    typeof value.link === "string"
  );
}

function isProposalDocumentRow(value: unknown): value is ProposalDocumentRow {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.specification === "string" &&
    typeof value.conformity === "string" &&
    typeof value.quantity === "string" &&
    typeof value.unit === "string" &&
    isProposalShopQuote(value.shop1) &&
    isProposalShopQuote(value.shop2) &&
    isProposalShopQuote(value.shop3)
  );
}

function parseProposalTableKey(tableKey: string) {
  const [schoolId = "", concentrationCode = "", tabKey = ""] = tableKey.split("::");
  return {
    schoolId,
    concentrationCode,
    tabKey,
  };
}

function normalizeProposalTables(
  proposalTables: Record<string, unknown> | undefined,
): Record<string, ProposalDocumentRow[]> {
  return Object.fromEntries(
    Object.entries(proposalTables ?? {}).map(([key, rows]) => [
      key,
      Array.isArray(rows) ? rows.filter(isProposalDocumentRow) : [],
    ]),
  );
}

function normalizeProposalSelections(
  rpkpSelections: Record<string, unknown> | undefined,
): Record<string, Partial<Record<string, ProposalShopKey>>> {
  return Object.fromEntries(
    Object.entries(rpkpSelections ?? {}).map(([tableKey, selection]) => [
      tableKey,
      Object.fromEntries(
        Object.entries(isObject(selection) ? selection : {}).filter((entry): entry is [string, ProposalShopKey] => {
          return entry[1] === "shop1" || entry[1] === "shop2" || entry[1] === "shop3";
        }),
      ),
    ]),
  );
}

export function createEmptyInterviewAnswers(): InterviewAssessmentAnswers {
  return interviewQuestionDefinitions.reduce((current, item) => {
    current[item.key] = { score: 3, comment: "" };
    return current;
  }, {} as InterviewAssessmentAnswers);
}

export function calculateInterviewAssessment(answers: InterviewAssessmentAnswers) {
  const totalWeight = interviewQuestionDefinitions.reduce((sum, q) => sum + (q.weightPercent || 0), 0);
  const totalScoreNumber = interviewQuestionDefinitions.reduce((sum, question) => {
    const item = answers[question.key];
    const score = item?.score ?? 3;
    const weight = question.weightPercent ?? 0;
    const componentValue = (score / 5) * weight;
    return sum + componentValue;
  }, 0);

  const denominator = totalWeight > 0 ? totalWeight : interviewQuestionDefinitions.length * 5;
  const normalized =
    totalWeight === 100
      ? totalScoreNumber
      : (totalScoreNumber / denominator) * 100;
  const totalScore = Math.max(0, Math.min(100, Math.round(normalized)));

  let recommendation = "Prioritas Rendah";
  if (totalScore >= 85) {
    recommendation = "Prioritas Sangat Tinggi";
  } else if (totalScore >= 70) {
    recommendation = "Prioritas Tinggi";
  } else if (totalScore >= 55) {
    recommendation = "Prioritas Sedang";
  }

  return {
    totalScore,
    recommendation,
    perComponent: interviewQuestionDefinitions.map((question) => {
      const item = answers[question.key];
      const score = item?.score ?? 3;
      const weight = question.weightPercent ?? 0;
      const componentValue = (score / 5) * weight;
      return {
        key: question.key,
        label: question.label,
        weight,
        score,
        componentValue: Number(componentValue.toFixed(2)),
      };
    }),
  };
}

export function filterAssignmentsForEquipmentFacilitator(
  records: TaskAssignmentRecord[],
  facilitatorEquipmentId: string,
  facilitatorEquipmentName: string,
  moduleKey: TaskAssignmentRecord["moduleKey"],
) {
  const normalizedName = normalizeUserName(facilitatorEquipmentName);

  return records.filter((record) => {
    if (record.moduleKey !== moduleKey) {
      return false;
    }

    if (facilitatorEquipmentId && record.facilitatorEquipmentId === facilitatorEquipmentId) {
      return true;
    }

    if (normalizedName && normalizeUserName(record.facilitatorEquipmentName) === normalizedName) {
      return true;
    }

    return false;
  });
}

export function buildFacilitatorSchoolTaskRows(records: TaskAssignmentRecord[]) {
  const rows = new Map<string, FacilitatorSchoolTaskRow>();

  for (const record of records) {
    const current = rows.get(record.schoolNpsn);
    if (!current) {
      rows.set(record.schoolNpsn, {
        assignmentKey: record.key,
        schoolNo: record.schoolNo,
        schoolNpsn: record.schoolNpsn,
        schoolName: record.schoolName,
        sourceTabs: [record.sourceTab],
        facilitatorAdministrationName: record.facilitatorAdministrationName,
        facilitatorEquipmentName: record.facilitatorEquipmentName,
        updatedAt: record.updatedAt,
        records: [record],
      });
      continue;
    }

    if (!current.sourceTabs.includes(record.sourceTab)) {
      current.sourceTabs.push(record.sourceTab);
    }
    current.records.push(record);
    if (Date.parse(record.updatedAt) > Date.parse(current.updatedAt)) {
      current.updatedAt = record.updatedAt;
      current.assignmentKey = record.key;
    }
    if (!current.facilitatorAdministrationName && record.facilitatorAdministrationName) {
      current.facilitatorAdministrationName = record.facilitatorAdministrationName;
    }
  }

  return Array.from(rows.values()).sort((left, right) => left.schoolNo - right.schoolNo);
}

export function formatWorkspaceDateTime(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value || "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function createEmptyBimtekReviewRecord(
  schoolNpsn: string,
  schoolName: string,
  facilitatorEquipmentId: string,
  facilitatorEquipmentName: string,
): BimtekReviewRecord {
  return {
    schoolNpsn,
    schoolName,
    facilitatorEquipmentId,
    facilitatorEquipmentName,
    statuses: {
      survey: "pending",
      rpkp: "pending",
      rab: "pending",
    },
    notes: {
      survey: "",
      rpkp: "",
      rab: "",
    },
    fasilAlatComment: null,
    fasilAdminComment: null,
    updatedAt: new Date().toISOString(),
  };
}

function buildSchoolProposalBundle(
  schoolId: string,
  tables: Record<string, ProposalDocumentRow[]>,
  selections: Record<string, Partial<Record<string, ProposalShopKey>>>,
) {
  const emptyQuote: ProposalShopQuote = {
    priceWithTax: "0",
    shippingCost: "0",
    installationCost: "0",
    totalPrice: "0",
    link: "",
  };
  const concentrations = Object.entries(tables)
    .map(([tableKey, rows]) => ({
      parsed: parseProposalTableKey(tableKey),
      rows,
    }))
    .filter((item) => item.parsed.schoolId === schoolId && item.parsed.tabKey === "survey")
    .map(({ parsed, rows }) => {
      const selectionKey = `${schoolId}::${parsed.concentrationCode}::rpkp`;
      const currentSelections = selections[selectionKey] ?? {};

      const rpkpRows = rows.map((row) => {
        const savedSelection = currentSelections[row.id];
        const selectedShop: ProposalShopKey | "" =
          savedSelection === "shop1" || savedSelection === "shop2" || savedSelection === "shop3"
            ? savedSelection
            : "";
        const selectedQuote = selectedShop ? row[selectedShop] : { ...emptyQuote };
        return {
          id: row.id,
          name: row.name,
          specification: row.specification,
          selectedShop,
          selectedQuote,
        };
      });

      const rabRows = rows.map((row) => {
        const savedSelection = currentSelections[row.id];
        const selectedShop: ProposalShopKey | "" =
          savedSelection === "shop1" || savedSelection === "shop2" || savedSelection === "shop3"
            ? savedSelection
            : "";
        let unitPrice = 0;
        if (selectedShop) {
          const selectedQuote = row[selectedShop];
          unitPrice =
            parseCurrencyNumber(selectedQuote.priceWithTax) +
            parseCurrencyNumber(selectedQuote.shippingCost) +
            parseCurrencyNumber(selectedQuote.installationCost);
        }
        const quantity = parseQuantityNumber(row.quantity);

        return {
          id: row.id,
          name: row.name,
          quantity,
          unitPrice,
          totalPrice: unitPrice * quantity,
        };
      });

      return {
        concentrationCode: parsed.concentrationCode,
        surveyRows: rows,
        rpkpRows,
        rabRows,
      };
    })
    .sort((left, right) => left.concentrationCode.localeCompare(right.concentrationCode, "id-ID"));

  const surveyItemCount = concentrations.reduce((sum, item) => sum + item.surveyRows.length, 0);
  const rpkpItemCount = concentrations.reduce((sum, item) => sum + item.rpkpRows.length, 0);
  const rabItemCount = concentrations.reduce((sum, item) => sum + item.rabRows.length, 0);
  const surveyTotal = concentrations.reduce(
    (sum, item) =>
      sum +
      item.surveyRows.reduce((rowSum, row) => {
        return rowSum + parseCurrencyNumber(row.shop1.totalPrice) + parseCurrencyNumber(row.shop2.totalPrice) + parseCurrencyNumber(row.shop3.totalPrice);
      }, 0),
    0,
  );
  const rpkpTotal = concentrations.reduce(
    (sum, item) =>
      sum +
      item.rpkpRows.reduce((rowSum, row) => {
        const unitPrice =
          parseCurrencyNumber(row.selectedQuote.priceWithTax) +
          parseCurrencyNumber(row.selectedQuote.shippingCost) +
          parseCurrencyNumber(row.selectedQuote.installationCost);
        const qty = parseQuantityNumber(
          item.surveyRows.find((s) => s.id === row.id)?.quantity ?? "0",
        );
        return rowSum + unitPrice * qty;
      }, 0),
    0,
  );
  const rabTotal = concentrations.reduce(
    (sum, item) => sum + item.rabRows.reduce((rowSum, row) => rowSum + row.totalPrice, 0),
    0,
  );

  return {
    schoolId,
    concentrations,
    surveyItemCount,
    rpkpItemCount,
    rabItemCount,
    surveyTotal,
    rpkpTotal,
    rabTotal,
  };
}

export function extractSchoolIdFromWorkspacePayload(
  payload:
    | WorkspaceSchoolProposalData
    | null
    | undefined
    | {
        proposalTables?: Record<string, unknown>;
        rpkpSelections?: Record<string, unknown>;
      },
): string | null {
  if (!payload) return null;
  const tableKeys = Object.keys(payload.proposalTables ?? {});
  if (tableKeys.length) {
    const parsed = parseProposalTableKey(tableKeys[0]);
    if (parsed.schoolId) return parsed.schoolId;
  }
  const selectionKeys = Object.keys(payload.rpkpSelections ?? {});
  if (selectionKeys.length) {
    const parsed = parseProposalTableKey(selectionKeys[0]);
    if (parsed.schoolId) return parsed.schoolId;
  }
  return null;
}

export function buildSchoolProposalBundleFromWorkspaceData(
  schoolId: string | null | undefined,
  payload: WorkspaceSchoolProposalData | null | undefined,
): SchoolProposalBundle | null {
  if (!payload) return null;
  const normalizedTables = normalizeProposalTables(payload.proposalTables);
  const normalizedSelections = normalizeProposalSelections(payload.rpkpSelections);
  const effectiveSchoolId =
    schoolId ?? extractSchoolIdFromWorkspacePayload({ proposalTables: normalizedTables, rpkpSelections: normalizedSelections });
  if (!effectiveSchoolId) return null;
  return buildSchoolProposalBundle(
    effectiveSchoolId,
    normalizedTables,
    normalizedSelections,
  );
}

export type PraBimtekCompletionStatus = "belum" | "proses" | "selesai";

export type PraBimtekCompletionResult = {
  survey: PraBimtekCompletionStatus;
  rpkp: PraBimtekCompletionStatus;
  rab: PraBimtekCompletionStatus;
  surveyItemCount: number;
  rpkpItemCount: number;
  rabItemCount: number;
  rabTotal: number;
  kkWithSurveyCount: number;
  kkTotalCount: number;
};

export function computePraBimtekCompletion(
  bundle: SchoolProposalBundle | null | undefined,
  profileConcentrationCodes: string[] | null | undefined,
): PraBimtekCompletionResult {
  const empty: PraBimtekCompletionResult = {
    survey: "belum",
    rpkp: "belum",
    rab: "belum",
    surveyItemCount: 0,
    rpkpItemCount: 0,
    rabItemCount: 0,
    rabTotal: 0,
    kkWithSurveyCount: 0,
    kkTotalCount: 0,
  };

  const kkTotal = profileConcentrationCodes?.length ?? bundle?.concentrations.length ?? 0;
  if (!bundle || kkTotal === 0) {
    return { ...empty, kkTotalCount: kkTotal };
  }

  const expectedCodes = profileConcentrationCodes ?? bundle.concentrations.map((c) => c.concentrationCode);

  let kkWithSurvey = 0;
  let kkAllSurvey = true;
  let kkAnySurvey = false;

  let kkWithRpkp = 0;
  let kkAllRpkp = true;
  let kkAnyRpkp = false;

  let kkWithRab = 0;
  let kkAllRab = true;
  let kkAnyRab = false;

  let totalSurveyItems = 0;
  let totalRpkpItems = 0;
  let totalRabItems = 0;
  let totalRabValue = 0;

  for (const code of expectedCodes) {
    const found = bundle.concentrations.find((c) => c.concentrationCode === code);
    const surveyRows = found?.surveyRows ?? [];
    const rpkpRows = found?.rpkpRows ?? [];
    const rabRows = found?.rabRows ?? [];

    totalSurveyItems += surveyRows.length;

    const hasSurvey = surveyRows.length > 0;
    if (hasSurvey) {
      kkWithSurvey += 1;
      kkAnySurvey = true;
    } else {
      kkAllSurvey = false;
    }

    const selectedRpkp = rpkpRows.filter((r) => r.selectedShop !== "");
    totalRpkpItems += selectedRpkp.length;

    const hasAnyRpkp = selectedRpkp.length > 0;
    const hasAllRpkp = surveyRows.length > 0 && selectedRpkp.length === surveyRows.length;

    if (hasAllRpkp) {
      kkWithRpkp += 1;
      kkAnyRpkp = true;
    } else if (hasAnyRpkp) {
      kkAnyRpkp = true;
      kkAllRpkp = false;
    } else {
      kkAllRpkp = false;
    }

    const nonZeroRab = rabRows.filter((r) => r.totalPrice > 0);
    totalRabItems += nonZeroRab.length;
    const subTotal = rabRows.reduce((s, r) => s + r.totalPrice, 0);
    totalRabValue += subTotal;

    const hasAnyRab = nonZeroRab.length > 0 || subTotal > 0;
    const hasAllRab =
      surveyRows.length > 0 && nonZeroRab.length === surveyRows.length && subTotal > 0;

    if (hasAllRab) {
      kkWithRab += 1;
      kkAnyRab = true;
    } else if (hasAnyRab) {
      kkAnyRab = true;
      kkAllRab = false;
    } else {
      kkAllRab = false;
    }
  }

  let surveyStatus: PraBimtekCompletionStatus = "belum";
  if (kkAllSurvey && kkWithSurvey === kkTotal) surveyStatus = "selesai";
  else if (kkAnySurvey) surveyStatus = "proses";

  let rpkpStatus: PraBimtekCompletionStatus = "belum";
  if (kkAllRpkp && kkWithRpkp === kkTotal && kkTotal > 0) rpkpStatus = "selesai";
  else if (kkAnyRpkp) rpkpStatus = "proses";

  let rabStatus: PraBimtekCompletionStatus = "belum";
  if (kkAllRab && kkWithRab === kkTotal && kkTotal > 0) rabStatus = "selesai";
  else if (kkAnyRab) rabStatus = "proses";

  return {
    survey: surveyStatus,
    rpkp: rpkpStatus,
    rab: rabStatus,
    surveyItemCount: totalSurveyItems,
    rpkpItemCount: totalRpkpItems,
    rabItemCount: totalRabItems,
    rabTotal: totalRabValue,
    kkWithSurveyCount: kkWithSurvey,
    kkTotalCount: kkTotal,
  };
}
