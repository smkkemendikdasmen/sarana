import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { DashboardService } from "./dashboard.service.js";
import type { AuthUser } from "../common/constants/roles.js";

@UseGuards(JwtAuthGuard)
@Controller("dashboards")
export class DashboardController {
  constructor() {}

  @Get(":role")
  getDashboard(
    @Param("role") role: string,
    @Req() request: { user: Omit<AuthUser, "password"> },
  ) {
    return DashboardService.getGlobalSingletonInstance().getDashboard(role, request.user.role);
  }
}
