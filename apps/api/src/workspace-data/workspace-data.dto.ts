import { IsString, IsNumber, IsObject, IsOptional, IsInt, Min } from "class-validator";
import type { WspUpdateReq } from "@saranasmk/shared-types";

export class WorkspaceDataDto implements Omit<WspUpdateReq, "npsn"> {
  @IsInt()
  @Min(0)
  version!: number;

  @IsObject()
  data_json!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  data_sha256?: string;
}

export class WorkspaceEquipmentDto implements Omit<WspUpdateReq, "npsn"> {
  @IsInt()
  @Min(0)
  version!: number;

  @IsObject()
  data_json!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  data_sha256?: string;
}
