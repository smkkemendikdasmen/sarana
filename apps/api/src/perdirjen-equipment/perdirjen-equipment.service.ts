import { Injectable } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RowDataPacket } from "mysql2/promise";

import { DatabaseService } from "../database/database.service.js";

type CategoryCode = "MINIMAL" | "PENGEMBANGAN" | "PENDUKUNG";

interface SummaryRow extends RowDataPacket {
  bidang_code: string;
  bidang_name: string;
  program_code: string;
  program_name: string;
  concentration_code: string;
  concentration_name: string;
}

interface BidangCountRow extends RowDataPacket {
  bidang_code: string;
  total_item: number;
}

interface ItemRow extends RowDataPacket {
  bidang_code: string;
  bidang_name: string;
  program_code: string;
  program_name: string;
  concentration_code: string;
  concentration_name: string;
  category: CategoryCode;
  row_order: number;
  name: string;
  function_text: string | null;
  specification_text: string | null;
  ratio: string | null;
}

interface ConcentrationSummary {
  no: string;
  nama: string;
}

interface ProgramSummary {
  no: string;
  nama: string;
  konsentrasi: ConcentrationSummary[];
}

interface BidangSummary {
  no: string;
  bidang: string;
  totalProgram: number;
  totalKonsentrasi: number;
  totalItem: number;
  program: ProgramSummary[];
}

interface EquipmentItemDto {
  "Nama Alat": string;
  "Fungsi Alat": string;
  "Spesifikasi Alat": string;
  "Rasio Satuan": string;
}

interface ConcentrationDetail extends ConcentrationSummary {
  "Peralatan Praktik Utama Kriteria Minimal": EquipmentItemDto[];
  "Peralatan Praktik Utama Kriteria Pengembangan": EquipmentItemDto[];
  "Peralatan Praktik Pendukung": EquipmentItemDto[];
}

interface ProgramDetail {
  no: string;
  nama: string;
  konsentrasi: ConcentrationDetail[];
}

interface BidangDetail {
  no: string;
  bidang: string;
  totalProgram: number;
  totalKonsentrasi: number;
  totalItem: number;
  program: ProgramDetail[];
}

interface EquipmentItemInput {
  name: string;
  functionText: string;
  specificationText: string;
  ratio: string;
}

const categoryLabelMap: Record<CategoryCode, keyof Omit<ConcentrationDetail, "no" | "nama">> = {
  MINIMAL: "Peralatan Praktik Utama Kriteria Minimal",
  PENGEMBANGAN: "Peralatan Praktik Utama Kriteria Pengembangan",
  PENDUKUNG: "Peralatan Praktik Pendukung",
};

@Injectable()
export class PerdirjenEquipmentService {
  private schemaEnsured = false;
  private static _globalSingletonInstance: PerdirjenEquipmentService | null = null;

  constructor(private readonly databaseService: DatabaseService) {
    const dbOk = databaseService && typeof (databaseService as any).query === "function";
    if (dbOk) PerdirjenEquipmentService._globalSingletonInstance = this;
  }

  static getGlobalSingletonInstanceOrNull(): PerdirjenEquipmentService | null {
    const inst = PerdirjenEquipmentService._globalSingletonInstance;
    if (!inst) return null;
    const dbOk = inst.databaseService && typeof (inst.databaseService as any).query === "function";
    return dbOk ? inst : null;
  }

  static getGlobalSingletonInstance(): PerdirjenEquipmentService {
    const existing = PerdirjenEquipmentService.getGlobalSingletonInstanceOrNull();
    if (existing) return existing;
    const db = DatabaseService.getGlobalSingletonInstance();
    const fresh = new PerdirjenEquipmentService(db);
    PerdirjenEquipmentService._globalSingletonInstance = fresh;
    return fresh;
  }

  private async ensureSchema() {
    if (this.schemaEnsured) return;
    try {
      if (!this.databaseService?.query || typeof this.databaseService.query !== "function") return;
    } catch {
      return;
    }
    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS perdirjen_pdf_page_map_entry (
        kode VARCHAR(32) NOT NULL,
        bidang_code VARCHAR(16) NULL,
        bidang_keahlian VARCHAR(255) NULL,
        program_code VARCHAR(16) NULL,
        program_keahlian VARCHAR(255) NULL,
        konsentrasi_keahlian VARCHAR(255) NULL,
        start_page INT NULL,
        end_page INT NULL,
        raw_payload JSON NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (kode)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    const countResults = await this.databaseService.query<
      Array<{ total: number | string }> & RowDataPacket[]
    >("SELECT COUNT(*) AS total FROM perdirjen_pdf_page_map_entry");
    const [countRows] = countResults;
    const total = Number((countRows as unknown as Array<{ total: number | string }>)[0]?.total ?? 0);
    if (total === 0) {
      try {
        const envPath = String(process.env.PERDIRJEN_PDF_PAGE_MAP_SEED ?? "").trim();
        let filePath = envPath;
        if (!filePath) {
          filePath = resolve(
            process.cwd(),
            "apps/api/private-seeds/perdirjen_pdf_page_map.json",
          );
        }
        const raw = await readFile(filePath, "utf-8");
        const parsed = JSON.parse(raw) as Record<
          string,
          {
            kode?: string;
            bidangCode?: string;
            bidangKeahlian?: string;
            programCode?: string;
            programKeahlian?: string;
            konsentrasiKeahlian?: string;
            startPage?: number;
            endPage?: number;
          }
        >;
        const entries = Object.entries(parsed);
        for (const [key, item] of entries) {
          const kode = item.kode ?? key;
          await this.databaseService.query(
            `
            INSERT INTO perdirjen_pdf_page_map_entry
              (kode, bidang_code, bidang_keahlian, program_code, program_keahlian, konsentrasi_keahlian, start_page, end_page, raw_payload)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              bidang_code = VALUES(bidang_code),
              bidang_keahlian = VALUES(bidang_keahlian),
              program_code = VALUES(program_code),
              program_keahlian = VALUES(program_keahlian),
              konsentrasi_keahlian = VALUES(konsentrasi_keahlian),
              start_page = VALUES(start_page),
              end_page = VALUES(end_page),
              raw_payload = VALUES(raw_payload)
          `,
            [
              kode,
              item.bidangCode ?? null,
              item.bidangKeahlian ?? null,
              item.programCode ?? null,
              item.programKeahlian ?? null,
              item.konsentrasiKeahlian ?? null,
              item.startPage ?? null,
              item.endPage ?? null,
              JSON.stringify(item),
            ],
          );
        }
      } catch {
        // ignore seed error; fallback to empty map
      }
    }
    this.schemaEnsured = true;
  }

  async getPdfPageMap(): Promise<Record<string, unknown>> {
    try {
      await this.ensureSchema();
      const pageMapResults = await this.databaseService.query<
        Array<{
          kode: string;
          bidang_code: string | null;
          bidang_keahlian: string | null;
          program_code: string | null;
          program_keahlian: string | null;
          konsentrasi_keahlian: string | null;
          start_page: number | null;
          end_page: number | null;
          raw_payload: unknown;
        }> &
          RowDataPacket[]
      >(
        "SELECT kode, bidang_code, bidang_keahlian, program_code, program_keahlian, konsentrasi_keahlian, start_page, end_page, raw_payload FROM perdirjen_pdf_page_map_entry ORDER BY kode ASC",
      );
      const [rows] = pageMapResults;
      const map: Record<string, unknown> = {};
      for (const row of rows as unknown as Array<{
        kode: string;
        bidang_code: string | null;
        bidang_keahlian: string | null;
        program_code: string | null;
        program_keahlian: string | null;
        konsentrasi_keahlian: string | null;
        start_page: number | null;
        end_page: number | null;
        raw_payload: unknown;
      }>) {
        if (row.raw_payload && typeof row.raw_payload === "object") {
          map[row.kode] = row.raw_payload;
        } else {
          map[row.kode] = {
            kode: row.kode,
            bidangCode: row.bidang_code,
            bidangKeahlian: row.bidang_keahlian,
            programCode: row.program_code,
            programKeahlian: row.program_keahlian,
            konsentrasiKeahlian: row.konsentrasi_keahlian,
            startPage: row.start_page,
            endPage: row.end_page,
          };
        }
      }
      return map;
    } catch {
      return {};
    }
  }

  async getSummary(): Promise<BidangSummary[]> {
    try {
      const rows = await this.databaseService.query<SummaryRow[]>(`
      SELECT
        b.code AS bidang_code,
        b.name AS bidang_name,
        p.code AS program_code,
        p.name AS program_name,
        c.code AS concentration_code,
        c.name AS concentration_name
      FROM perdirjen_equipment_bidang b
      INNER JOIN perdirjen_equipment_program p ON p.bidang_id = b.id
      INNER JOIN perdirjen_equipment_concentration c ON c.program_id = p.id
      ORDER BY b.id, p.id, c.id
    `);

      const countRows = await this.databaseService.query<BidangCountRow[]>(`
      SELECT b.code AS bidang_code, COUNT(i.id) AS total_item
      FROM perdirjen_equipment_bidang b
      INNER JOIN perdirjen_equipment_program p ON p.bidang_id = b.id
      INNER JOIN perdirjen_equipment_concentration c ON c.program_id = p.id
      LEFT JOIN perdirjen_equipment_item i ON i.concentration_id = c.id
      GROUP BY b.code
      ORDER BY MIN(b.id)
    `);

      const itemCountByBidang = new Map(countRows.map((row) => [row.bidang_code, Number(row.total_item)]));
      const bidangMap = new Map<string, BidangSummary>();
      const programMap = new Map<string, ProgramSummary>();

      for (const row of rows) {
        if (!bidangMap.has(row.bidang_code)) {
          bidangMap.set(row.bidang_code, {
            no: row.bidang_code,
            bidang: row.bidang_name,
            totalProgram: 0,
            totalKonsentrasi: 0,
            totalItem: itemCountByBidang.get(row.bidang_code) ?? 0,
            program: [],
          });
        }

        const bidang = bidangMap.get(row.bidang_code)!;
        const programKey = `${row.bidang_code}::${row.program_code}`;

        if (!programMap.has(programKey)) {
          const program: ProgramSummary = {
            no: row.program_code,
            nama: row.program_name,
            konsentrasi: [],
          };
          programMap.set(programKey, program);
          bidang.program.push(program);
          bidang.totalProgram += 1;
        }

        const program = programMap.get(programKey)!;
        program.konsentrasi.push({
          no: row.concentration_code,
          nama: row.concentration_name,
        });
        bidang.totalKonsentrasi += 1;
      }

      return Array.from(bidangMap.values());
    } catch {
      return [];
    }
  }

  async getBidangDetail(code: string): Promise<BidangDetail | null> {
    try {
      const rows = await this.databaseService.query<ItemRow[]>(
        `
        SELECT
          b.code AS bidang_code,
          b.name AS bidang_name,
          p.code AS program_code,
          p.name AS program_name,
          c.code AS concentration_code,
          c.name AS concentration_name,
          i.category,
          i.row_order,
          i.name,
          i.function_text,
          i.specification_text,
          i.ratio
        FROM perdirjen_equipment_bidang b
        INNER JOIN perdirjen_equipment_program p ON p.bidang_id = b.id
        INNER JOIN perdirjen_equipment_concentration c ON c.program_id = p.id
        LEFT JOIN perdirjen_equipment_item i ON i.concentration_id = c.id
        WHERE b.code = ?
        ORDER BY
          p.id,
          c.id,
          FIELD(i.category, 'MINIMAL', 'PENGEMBANGAN', 'PENDUKUNG'),
          i.row_order
      `,
        [code],
      );

      if (rows.length === 0) {
        return this.buildBidangDetailFromSummaryFallback(code);
      }

      const bidang: BidangDetail = {
        no: rows[0].bidang_code,
        bidang: rows[0].bidang_name,
        totalProgram: 0,
        totalKonsentrasi: 0,
        totalItem: 0,
        program: [],
      };

      const programMap = new Map<string, ProgramDetail>();
      const concentrationMap = new Map<string, ConcentrationDetail>();

      for (const row of rows) {
        const programKey = row.program_code;
        if (!programMap.has(programKey)) {
          const program: ProgramDetail = {
            no: row.program_code,
            nama: row.program_name,
            konsentrasi: [],
          };
          programMap.set(programKey, program);
          bidang.program.push(program);
          bidang.totalProgram += 1;
        }

        const concentrationKey = `${row.program_code}::${row.concentration_code}`;
        if (!concentrationMap.has(concentrationKey)) {
          const concentration: ConcentrationDetail = {
            no: row.concentration_code,
            nama: row.concentration_name,
            "Peralatan Praktik Utama Kriteria Minimal": [],
            "Peralatan Praktik Utama Kriteria Pengembangan": [],
            "Peralatan Praktik Pendukung": [],
          };
          concentrationMap.set(concentrationKey, concentration);
          programMap.get(programKey)!.konsentrasi.push(concentration);
          bidang.totalKonsentrasi += 1;
        }

        if (!row.category) {
          continue;
        }

        bidang.totalItem += 1;
        concentrationMap.get(concentrationKey)![categoryLabelMap[row.category]].push({
          "Nama Alat": row.name ?? "",
          "Fungsi Alat": row.function_text ?? "",
          "Spesifikasi Alat": row.specification_text ?? "",
          "Rasio Satuan": row.ratio ?? "",
        });
      }

      return bidang;
    } catch {
      return this.buildBidangDetailFromSummaryFallback(code);
    }
  }

  private async buildBidangDetailFromSummaryFallback(code: string): Promise<BidangDetail | null> {
    try {
      const summaries = await this.getSummary();
      const target = summaries.find((item) => item.no === String(code));
      if (!target) return null;

      const bidang: BidangDetail = {
        no: target.no,
        bidang: target.bidang,
        totalProgram: target.totalProgram,
        totalKonsentrasi: target.totalKonsentrasi,
        totalItem: target.totalItem,
        program: target.program.map((p) => ({
          no: p.no,
          nama: p.nama,
          konsentrasi: p.konsentrasi.map((k) => ({
            no: k.no,
            nama: k.nama,
            "Peralatan Praktik Utama Kriteria Minimal": [],
            "Peralatan Praktik Utama Kriteria Pengembangan": [],
            "Peralatan Praktik Pendukung": [],
          })),
        })),
      };

      return bidang;
    } catch {
      return null;
    }
  }

  async replaceCategoryItems(
    concentrationCode: string,
    category: CategoryCode,
    items: EquipmentItemInput[],
  ): Promise<EquipmentItemDto[]> {
    const normalizedItems = items.map((item) => ({
      name: item.name?.trim() ?? "",
      functionText: item.functionText?.trim() ?? "",
      specificationText: item.specificationText?.trim() ?? "",
      ratio: item.ratio?.trim() ?? "",
    }));

    await this.databaseService.transaction(async (connection) => {
      const [concentrationRows] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM perdirjen_equipment_concentration WHERE code = ? LIMIT 1",
        [concentrationCode],
      );

      const concentrationId = Number(concentrationRows[0]?.id ?? 0);
      if (!concentrationId) {
        throw new Error("Konsentrasi keahlian tidak ditemukan.");
      }

      await connection.query(
        "DELETE FROM perdirjen_equipment_item WHERE concentration_id = ? AND category = ?",
        [concentrationId, category],
      );

      for (const [index, item] of normalizedItems.entries()) {
        await connection.query(
          `
            INSERT INTO perdirjen_equipment_item (
              concentration_id,
              category,
              row_order,
              name,
              function_text,
              specification_text,
              ratio
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            concentrationId,
            category,
            index + 1,
            item.name,
            item.functionText,
            item.specificationText,
            item.ratio,
          ],
        );
      }
    });

    return normalizedItems.map((item) => ({
      "Nama Alat": item.name,
      "Fungsi Alat": item.functionText,
      "Spesifikasi Alat": item.specificationText,
      "Rasio Satuan": item.ratio,
    }));
  }
}
