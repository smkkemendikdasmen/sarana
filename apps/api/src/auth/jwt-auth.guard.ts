import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ClsServiceManager } from "nestjs-cls";

import { AuthService } from "./auth.service.js";
import { DatabaseService } from "../database/database.service.js";
import type { ClsTenantContext } from "../database/database.service.js";

let guardAuthServiceCached: AuthService | null = null;
function getAuthServiceForGuard(): AuthService {
  if (guardAuthServiceCached) return guardAuthServiceCached;
  const db = DatabaseService.getGlobalSingletonInstanceOrNull();
  if (!db) throw new UnauthorizedException("Sistem otentikasi belum siap (retry 1-2 detik lagi).");
  guardAuthServiceCached = new AuthService(db as any);
  return guardAuthServiceCached;
}

interface VerifiedSessionUser {
  id: string;
  username: string;
  fullName: string;
  role: string;
  organization?: string;
  region?: string;
  npsn?: string | null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor() {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: VerifiedSessionUser;
    }>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Header otorisasi tidak ditemukan.");
    }

    const token = authorization.replace("Bearer ", "").trim();
    const svc = getAuthServiceForGuard();
    const sessionUser = await svc.verifyToken(token) as VerifiedSessionUser;
    request.user = sessionUser;

    // FASE 4: INJECT TENANT CONTEXT KE CLS AGAR SET LOCAL app.current_*
    // otomatis dijalankan setiap query / transaction Postgres untuk RLS.
    try {
      const cls = ClsServiceManager.getClsService<ClsTenantContext>();
      if (cls && cls.isActive()) {
        const npsnVal = (sessionUser.npsn ?? "").trim();
        cls.set("current_npsn", npsnVal);
        cls.set("current_role", String(sessionUser.role ?? ""));
        cls.set("current_user_id", String(sessionUser.id ?? ""));
      }
    } catch {
      // jika ClsService belum di-init (bootstrap), non-fatal skip.
    }

    return true;
  }
}
