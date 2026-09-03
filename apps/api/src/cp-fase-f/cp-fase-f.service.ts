import { Injectable } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";

import { DatabaseService } from "../database/database.service.js";

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
  row_order: number | null;
  element_name: string | null;
  description_text: string | null;
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

interface CpItemDto {
  Elemen: string;
  Deskripsi: string;
}

interface ConcentrationDetail extends ConcentrationSummary {
  "Capaian Pembelajaran Fase F": CpItemDto[];
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

interface CpItemInput {
  elemen: string;
  deskripsi: string;
}

@Injectable()
export class CpFaseFService {
  private static _globalSingletonInstance: CpFaseFService | null = null;

  constructor(private readonly databaseService: DatabaseService) {
    const dbOk = databaseService && typeof (databaseService as any).query === "function";
    if (dbOk) CpFaseFService._globalSingletonInstance = this;
  }

  static getGlobalSingletonInstanceOrNull(): CpFaseFService | null {
    const inst = CpFaseFService._globalSingletonInstance;
    if (!inst) return null;
    const dbOk = inst.databaseService && typeof (inst.databaseService as any).query === "function";
    return dbOk ? inst : null;
  }

  static getGlobalSingletonInstance(): CpFaseFService {
    const existing = CpFaseFService.getGlobalSingletonInstanceOrNull();
    if (existing) return existing;
    const db = DatabaseService.getGlobalSingletonInstance();
    const fresh = new CpFaseFService(db);
    CpFaseFService._globalSingletonInstance = fresh;
    return fresh;
  }

  async getSummary(): Promise<BidangSummary[]> {
    const rows = await this.databaseService.query<SummaryRow[]>(`
      SELECT
        b.code AS bidang_code,
        b.name AS bidang_name,
        p.code AS program_code,
        p.name AS program_name,
        c.code AS concentration_code,
        c.name AS concentration_name
      FROM cp_fase_f_bidang b
      INNER JOIN cp_fase_f_program p ON p.bidang_id = b.id
      INNER JOIN cp_fase_f_concentration c ON c.program_id = p.id
      ORDER BY b.id, p.id, c.id
    `);

    const countRows = await this.databaseService.query<BidangCountRow[]>(`
      SELECT b.code AS bidang_code, COUNT(i.id) AS total_item
      FROM cp_fase_f_bidang b
      INNER JOIN cp_fase_f_program p ON p.bidang_id = b.id
      INNER JOIN cp_fase_f_concentration c ON c.program_id = p.id
      LEFT JOIN cp_fase_f_item i ON i.concentration_id = c.id
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
  }

  async getBidangDetail(code: string): Promise<BidangDetail | null> {
    const rows = await this.databaseService.query<ItemRow[]>(
      `
        SELECT
          b.code AS bidang_code,
          b.name AS bidang_name,
          p.code AS program_code,
          p.name AS program_name,
          c.code AS concentration_code,
          c.name AS concentration_name,
          i.row_order,
          i.element_name,
          i.description_text
        FROM cp_fase_f_bidang b
        INNER JOIN cp_fase_f_program p ON p.bidang_id = b.id
        INNER JOIN cp_fase_f_concentration c ON c.program_id = p.id
        LEFT JOIN cp_fase_f_item i ON i.concentration_id = c.id
        WHERE b.code = ?
        ORDER BY p.id, c.id, i.row_order
      `,
      [code],
    );

    if (rows.length === 0) {
      return null;
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
          "Capaian Pembelajaran Fase F": [],
        };
        concentrationMap.set(concentrationKey, concentration);
        programMap.get(programKey)!.konsentrasi.push(concentration);
        bidang.totalKonsentrasi += 1;
      }

      if (!row.element_name) {
        continue;
      }

      bidang.totalItem += 1;
      concentrationMap.get(concentrationKey)!["Capaian Pembelajaran Fase F"].push({
        Elemen: row.element_name ?? "",
        Deskripsi: row.description_text ?? "",
      });
    }

    return bidang;
  }

  async replaceConcentrationItems(concentrationCode: string, items: CpItemInput[]): Promise<CpItemDto[]> {
    const normalizedItems = items.map((item) => ({
      elemen: item.elemen?.trim() ?? "",
      deskripsi: item.deskripsi?.trim() ?? "",
    }));

    await this.databaseService.transaction(async (connection) => {
      const [concentrationRows] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM cp_fase_f_concentration WHERE code = ? LIMIT 1",
        [concentrationCode],
      );

      const concentrationId = Number(concentrationRows[0]?.id ?? 0);
      if (!concentrationId) {
        throw new Error("Konsentrasi keahlian tidak ditemukan.");
      }

      await connection.query("DELETE FROM cp_fase_f_item WHERE concentration_id = ?", [concentrationId]);

      for (const [index, item] of normalizedItems.entries()) {
        await connection.query(
          `
            INSERT INTO cp_fase_f_item (
              concentration_id,
              row_order,
              element_name,
              description_text
            ) VALUES (?, ?, ?, ?)
          `,
          [concentrationId, index + 1, item.elemen, item.deskripsi],
        );
      }
    });

    return normalizedItems.map((item) => ({
      Elemen: item.elemen,
      Deskripsi: item.deskripsi,
    }));
  }
}
