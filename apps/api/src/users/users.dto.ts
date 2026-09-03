import { IsString, IsNotEmpty, IsOptional, MaxLength, IsEmail } from "class-validator";
import type { UserRoleCode, NpsnChar8 } from "@saranasmk/shared-types";

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  role!: UserRoleCode;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  npsn?: NpsnChar8;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  full_name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: UserRoleCode;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  npsn?: NpsnChar8;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  full_name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}

export class UsersDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: UserRoleCode;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  npsn?: NpsnChar8;
}
