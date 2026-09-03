import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";

import type { AuthUser } from "../common/constants/roles.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { UsersService } from "./users.service.js";

interface UserBody {
  username?: string;
  fullName?: string;
  roleCode?: string;
  schoolId?: string | null;
  password?: string;
  isActive?: boolean;
  email?: string | null;
}

interface BulkSetActiveBody {
  roleCode?: string;
  isActive?: boolean;
}

@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor() {}

  @Get()
  getManagementData(@Req() request: { user: Omit<AuthUser, "password"> }) {
    return UsersService.getGlobalSingletonInstance().getManagementData(request.user.role);
  }

  @Post()
  async createUser(@Body() body: UserBody) {
    const username = body.username?.trim() ?? "";
    const fullName = body.fullName?.trim() ?? "";
    const roleCode = body.roleCode?.trim() ?? "";
    const password = body.password?.trim() ?? "";

    if (!username || !fullName || !roleCode || !password) {
      throw new BadRequestException("Username, nama lengkap, role, dan password wajib diisi.");
    }

    return UsersService.getGlobalSingletonInstance().createUser({
      username,
      fullName,
      roleCode,
      schoolId: body.schoolId ?? null,
      password,
      isActive: body.isActive ?? true,
      email: body.email ?? null,
    });
  }

  @Put(":id")
  async updateUser(@Param("id") id: string, @Body() body: UserBody) {
    const username = body.username?.trim() ?? "";
    const fullName = body.fullName?.trim() ?? "";
    const roleCode = body.roleCode?.trim() ?? "";

    if (!username || !fullName || !roleCode) {
      throw new BadRequestException("Username, nama lengkap, dan role wajib diisi.");
    }

    return UsersService.getGlobalSingletonInstance().updateUser(id, {
      username,
      fullName,
      roleCode,
      schoolId: body.schoolId ?? null,
      password: body.password?.trim() ? body.password.trim() : undefined,
      isActive: body.isActive ?? true,
      email: body.email ?? undefined,
    });
  }

  @Delete(":id")
  deleteUser(@Param("id") id: string) {
    return UsersService.getGlobalSingletonInstance().deleteUser(id);
  }

  @Post("bulk-reset-sekolah-password-default")
  async resetAllSekolahPasswordDefault() {
    return UsersService.getGlobalSingletonInstance().resetAllSekolahPasswordToDefault();
  }

  @Post("bulk-set-active-by-role")
  async bulkSetActiveByRole(@Req() request: { user: Omit<AuthUser, "password"> }, @Body() body: BulkSetActiveBody) {
    if (request.user.role !== "ADMIN" && request.user.role !== "SUPERADMIN") {
      throw new ForbiddenException("Hanya ADMIN yang dapat melakukan bulk set active pengguna.");
    }
    const roleCode = String(body.roleCode ?? "").trim();
    const isActive = Boolean(body.isActive);
    if (!roleCode) {
      throw new BadRequestException("roleCode wajib diisi.");
    }
    return UsersService.getGlobalSingletonInstance().bulkSetActiveByRoleCode(roleCode, isActive);
  }

  @Post(":id/reset-password-default")
  async resetPasswordDefault(@Param("id") id: string) {
    return UsersService.getGlobalSingletonInstance().resetPasswordToDefault(id);
  }

  @Post(":id/change-password-first-time")
  async changePasswordFirstTime(
    @Param("id") id: string,
    @Body()
    body: {
      oldPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
      email?: string;
    },
  ) {
    return UsersService.getGlobalSingletonInstance().changePasswordFirstTime(id, {
      oldPassword: body.oldPassword ?? "",
      newPassword: body.newPassword ?? "",
      confirmPassword: body.confirmPassword ?? "",
      email: body.email ?? "",
    });
  }
}
