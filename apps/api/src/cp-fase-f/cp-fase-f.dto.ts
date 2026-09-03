import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsNumber,
  IsInt,
  Min,
  IsObject,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import type { NpsnChar8 } from "@saranasmk/shared-types";

export class CpFaseFItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  kode_item!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  nama_barang!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  spesifikasi?: string;

  @IsInt()
  @Min(0)
  qty_existing!: number;

  @IsInt()
  @Min(0)
  qty_kebutuhan!: number;

  @IsInt()
  @Min(0)
  qty_kurang!: number;

  @IsInt()
  @Min(0)
  qty_usulan!: number;

  @IsNumber()
  @Min(0)
  harga_satuan!: number;

  @IsNumber()
  @Min(0)
  total_biaya!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  keterangan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  satuan?: string;

  @IsOptional()
  @IsObject()
  prioritas?: Record<string, unknown>;
}

export class CpFaseFSubmitDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  npsn!: NpsnChar8;

  @IsInt()
  @Min(0)
  version!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CpFaseFItemDto)
  items!: CpFaseFItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  grand_total_biaya?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  catatan_umum?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CpFaseFQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(8)
  npsn?: NpsnChar8;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  tahun_anggaran?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}

export class CpFaseFRingkasanDto {
  @IsOptional()
  @IsString()
  @MaxLength(8)
  npsn?: NpsnChar8;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  kategori?: string;
}
