import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { ClsModule, ClsServiceManager } from "nestjs-cls";

import { AuthController } from "./auth/auth.controller.js";
import { AuthService } from "./auth/auth.service.js";
import { CpFaseFController } from "./cp-fase-f/cp-fase-f.controller.js";
import { CpFaseFService } from "./cp-fase-f/cp-fase-f.service.js";
import { JwtAuthGuard } from "./auth/jwt-auth.guard.js";
import { DatabaseService } from "./database/database.service.js";
import type { ClsTenantContext } from "./database/database.service.js";
import { DashboardController } from "./dashboard/dashboard.controller.js";
import { DashboardService } from "./dashboard/dashboard.service.js";
import { GoogleDriveController } from "./google-drive/google-drive.controller.js";
import { GoogleDriveService } from "./google-drive/google-drive.service.js";
import { HealthModule } from "./health/health.module.js";
import { MasterDataController } from "./master-data/master-data.controller.js";
import { MasterDataService } from "./master-data/master-data.service.js";
import { OnlyOfficeController } from "./onlyoffice/onlyoffice.controller.js";
import { OnlyOfficeService } from "./onlyoffice/onlyoffice.service.js";
import { PerdirjenEquipmentController } from "./perdirjen-equipment/perdirjen-equipment.controller.js";
import { PerdirjenEquipmentService } from "./perdirjen-equipment/perdirjen-equipment.service.js";
import { RedisCacheModule } from "./common/cache/redis-cache.module.js";
import { SchoolProfileController } from "./school-profile/school-profile.controller.js";
import { SchoolProfileService } from "./school-profile/school-profile.service.js";
import { UsersController } from "./users/users.controller.js";
import { UsersService } from "./users/users.service.js";
import { WorkspaceDataController } from "./workspace-data/workspace-data.controller.js";
import { WorkspaceDataService } from "./workspace-data/workspace-data.service.js";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RedisCacheModule,
    HealthModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req, res) => {
          // default empty; guard akan mengisi setelah JWT verified.
          cls.set("current_npsn", "");
          cls.set("current_role", "");
          cls.set("current_user_id", "");
          // Safe cast alias untuk type ClsTenantContext:
          void (cls as unknown as ClsTenantContext);
          void req; void res;
        },
      },
    }),
  ],
  controllers: [
    AuthController,
    DashboardController,
    PerdirjenEquipmentController,
    CpFaseFController,
    UsersController,
    SchoolProfileController,
    MasterDataController,
    WorkspaceDataController,
    GoogleDriveController,
    OnlyOfficeController,
  ],
  providers: [
    DatabaseService,
    AuthService,
    JwtAuthGuard,
    DashboardService,
    PerdirjenEquipmentService,
    CpFaseFService,
    UsersService,
    SchoolProfileService,
    MasterDataService,
    WorkspaceDataService,
    GoogleDriveService,
    OnlyOfficeService,
  ],
})
export class AppModule {
  constructor() {
    // Force eagerly instantiate singleton manager pada saat module bootstrap
    // (agar JwtAuthGuard / DatabaseService tidak throw "ClsService belum di-init").
    try { ClsServiceManager.getClsService(); } catch { /* ignore */ }
  }
}
