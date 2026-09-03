import { Injectable } from "@nestjs/common";
import type { RowDataPacket } from "mysql2/promise";

import { DatabaseService } from "../database/database.service.js";

interface WilayahRow extends RowDataPacket {
  kode: string;
  nama: string;
}

export type WilayahRecord = {
  kode: string;
  nama: string;
  level: "PROVINSI" | "KABUPATEN_KOTA" | "KECAMATAN" | "KELURAHAN_DESA";
  length: number;
  parentKode: string | null;
};

function kodeToLevel(kode: string): WilayahRecord["level"] {
  switch (kode.length) {
    case 2:
      return "PROVINSI";
    case 5:
      return "KABUPATEN_KOTA";
    case 8:
      return "KECAMATAN";
    case 13:
    default:
      return "KELURAHAN_DESA";
  }
}

function parentKodeOf(kode: string): string | null {
  if (kode.length === 2) return null;
  if (kode.length === 5) return kode.slice(0, 2);
  if (kode.length === 8) return kode.slice(0, 5);
  if (kode.length === 13) return kode.slice(0, 8);
  return null;
}

@Injectable()
export class MasterDataService {
  private static _globalSingletonInstance: MasterDataService | null = null;

  constructor(private readonly databaseService: DatabaseService) {
    const dbOk = databaseService && typeof (databaseService as any).query === "function";
    if (dbOk) MasterDataService._globalSingletonInstance = this;
  }

  static getGlobalSingletonInstanceOrNull(): MasterDataService | null {
    const inst = MasterDataService._globalSingletonInstance;
    if (!inst) return null;
    const dbOk = inst.databaseService && typeof (inst.databaseService as any).query === "function";
    return dbOk ? inst : null;
  }

  static getGlobalSingletonInstance(): MasterDataService {
    const existing = MasterDataService.getGlobalSingletonInstanceOrNull();
    if (existing) return existing;
    const db = DatabaseService.getGlobalSingletonInstance();
    const fresh = new MasterDataService(db);
    MasterDataService._globalSingletonInstance = fresh;
    return fresh;
  }

  async listProvinsi(): Promise<WilayahRecord[]> {
    const rows = await this.databaseService.query<WilayahRow[]>(
      `SELECT kode, nama FROM wilayah WHERE CHAR_LENGTH(kode) = 2 ORDER BY kode ASC`,
    );
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      kode: row.kode,
      nama: row.nama,
      level: "PROVINSI" as const,
      length: row.kode.length,
      parentKode: null,
    }));
  }

  async listKabupaten(parentKode?: string): Promise<WilayahRecord[]> {
    const where: string[] = ["CHAR_LENGTH(kode) = 5"];
    const args: unknown[] = [];
    if (parentKode) {
      const sanitized = String(parentKode).trim();
      if (!/^[0-9]{2}$/.test(sanitized)) {
        return [];
      }
      where.push(`kode LIKE ?`);
      args.push(`${sanitized}.%`);
    }
    const rows = await this.databaseService.query<WilayahRow[]>(
      `SELECT kode, nama FROM wilayah WHERE ${where.join(" AND ")} ORDER BY kode ASC`,
      args,
    );
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      kode: row.kode,
      nama: row.nama,
      level: kodeToLevel(row.kode),
      length: row.kode.length,
      parentKode: parentKodeOf(row.kode),
    }));
  }

  async listKecamatan(parentKode?: string): Promise<WilayahRecord[]> {
    const where: string[] = ["CHAR_LENGTH(kode) = 8"];
    const args: unknown[] = [];
    if (parentKode) {
      const sanitized = String(parentKode).trim();
      if (!/^[0-9]{2}\.[0-9]{2}$/.test(sanitized)) {
        return [];
      }
      where.push(`kode LIKE ?`);
      args.push(`${sanitized}.%`);
    }
    const rows = await this.databaseService.query<WilayahRow[]>(
      `SELECT kode, nama FROM wilayah WHERE ${where.join(" AND ")} ORDER BY kode ASC`,
      args,
    );
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      kode: row.kode,
      nama: row.nama,
      level: kodeToLevel(row.kode),
      length: row.kode.length,
      parentKode: parentKodeOf(row.kode),
    }));
  }

  async listKelurahan(parentKode?: string): Promise<WilayahRecord[]> {
    const where: string[] = ["CHAR_LENGTH(kode) = 13"];
    const args: unknown[] = [];
    if (parentKode) {
      const sanitized = String(parentKode).trim();
      if (!/^[0-9]{2}\.[0-9]{2}\.[0-9]{2}$/.test(sanitized)) {
        return [];
      }
      where.push(`kode LIKE ?`);
      args.push(`${sanitized}.%`);
    }
    const rows = await this.databaseService.query<WilayahRow[]>(
      `SELECT kode, nama FROM wilayah WHERE ${where.join(" AND ")} ORDER BY kode ASC`,
      args,
    );
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      kode: row.kode,
      nama: row.nama,
      level: kodeToLevel(row.kode),
      length: row.kode.length,
      parentKode: parentKodeOf(row.kode),
    }));
  }

  async lookupNamaByKode(
    kode: string | null | undefined,
  ): Promise<WilayahRecord | null> {
    if (!kode) return null;
    const rows = await this.databaseService.query<WilayahRow[]>(
      `SELECT kode, nama FROM wilayah WHERE kode = ? LIMIT 1`,
      [kode],
    );
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return null;
    const row = list[0];
    return {
      kode: row.kode,
      nama: row.nama,
      level: kodeToLevel(row.kode),
      length: row.kode.length,
      parentKode: parentKodeOf(row.kode),
    };
  }
}
