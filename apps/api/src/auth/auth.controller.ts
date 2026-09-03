import { Body, Controller, ForbiddenException, Get, InternalServerErrorException, Post, Req, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";

import { LoginDto } from "./dto/login.dto.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { AuthService } from "./auth.service.js";
import { DatabaseService } from "../database/database.service.js";

let cachedAuthServiceSingleton: AuthService | null = null;
function getAuthServiceManual(): AuthService {
  if (cachedAuthServiceSingleton) return cachedAuthServiceSingleton;
  const db = DatabaseService.getGlobalSingletonInstanceOrNull();
  if (!db) throw new InternalServerErrorException("DatabaseService global instance belum siap (retry 1-2 detik lagi).");
  cachedAuthServiceSingleton = new AuthService(db as any);
  return cachedAuthServiceSingleton;
}

@Controller("auth")
export class AuthController {
  constructor() {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post("login")
  async login(@Body() body: LoginDto) {
    const svc = getAuthServiceManual();
    const identity = (body.username ?? body.email ?? "").trim();
    return svc.login(identity, body.password);
  }

  @Post("register-school")
  async registerSchool() {
    throw new ForbiddenException("Registrasi akun sekolah saat ini dinonaktifkan. Silakan hubungi administrator untuk membuatkan akun sekolah.");
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> }) {
    return { user: request.user };
  }
}
