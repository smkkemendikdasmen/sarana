import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsNumber,
  IsBoolean,
  IsObject,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import type { NpsnChar8 } from "@saranasmk/shared-types";

export class SchoolProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8)
  npsn!: NpsnChar8;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nama_sekolah?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  alamat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  kecamatan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  kabupaten?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  provinsi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  kode_pos?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  no_telp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  kepala_sekolah?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  akreditasi?: string;

  @IsOptional()
  @IsNumber()
  jumlah_siswa?: number;

  @IsOptional()
  @IsNumber()
  jumlah_guru?: number;

  @IsOptional()
  @IsBoolean()
  status_aktif?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateSchoolProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nama_sekolah?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  alamat?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  kecamatan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  kabupaten?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  provinsi?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  kode_pos?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  no_telp?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  kepala_sekolah?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  akreditasi?: string;

  @IsOptional()
  @IsNumber()
  jumlah_siswa?: number;

  @IsOptional()
  @IsNumber()
  jumlah_guru?: number;

  @IsOptional()
  @IsBoolean()
  status_aktif?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SchoolDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  document_type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  file_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  file_url?: string;
}

export class SchoolDocumentsBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SchoolDocumentDto)
  documents!: SchoolDocumentDto[];
}
