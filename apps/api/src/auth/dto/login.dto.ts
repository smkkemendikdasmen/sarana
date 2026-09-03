import { IsString, IsNotEmpty, MaxLength, ValidateIf } from "class-validator";
import type { LoginReq } from "@saranasmk/shared-types";

export class LoginDto implements LoginReq {
  @ValidateIf((o) => !o.email || o.username)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  username!: string;

  @ValidateIf((o) => !o.username || o.email)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  password!: string;
}
