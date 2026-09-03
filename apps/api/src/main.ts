import "reflect-metadata";

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BadRequestException, ClassSerializerInterceptor, Logger, RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ExpressAdapter } from "@nestjs/platform-express";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module.js";
import { AuthService } from "./auth/auth.service.js";
import { AllExceptionsFilter, ResponseInterceptor } from "./common/http/index.js";
import { DatabaseService } from "./database/database.service.js";
import { SchoolProfileService } from "./school-profile/school-profile.service.js";
import { UsersService } from "./users/users.service.js";
import { WorkspaceDataService } from "./workspace-data/workspace-data.service.js";

const bootstrapLogger = new Logger("Bootstrap");

process.on("uncaughtException", (err) => {
  bootstrapLogger.error("\n💥 UNCAUGHT EXCEPTION (NODE TIDAK BOLEH TERJADI INI)\n");
  console.error(err);
  if (err?.stack) console.error("\nStack:", err.stack);
  process.exitCode = 1;
});
process.on("unhandledRejection", (reason, promise) => {
  bootstrapLogger.error("\n💥 UNHANDLED PROMISE REJECTION (ASYNC ERROR TIDAK DITANGKAP)\n");
  console.error("Promise:", promise);
  console.error("Reason:", reason);
  if (reason instanceof Error && reason.stack) console.error("Stack:", reason.stack);
  process.exitCode = 1;
});
process.on("SIGTERM", () => {
  bootstrapLogger.warn("SIGTERM diterima, closing Nest app graceful...");
  setTimeout(() => process.exit(0), 5000).unref();
});
process.on("SIGINT", () => {
  bootstrapLogger.warn("Ctrl+C (SIGINT) ditekan, exit graceful...");
  setTimeout(() => process.exit(0), 3000).unref();
});

async function bootstrap() {
  const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
  const uploadsDirectory = path.resolve(currentDirectory, "../uploads");
  try {
    await mkdir(uploadsDirectory, { recursive: true });
  } catch (e) {
    bootstrapLogger.error("Gagal membuat folder uploads:", e as Error);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    bodyParser: false,
  });

  app.useBodyParser("json", { limit: "256mb" });
  app.useBodyParser("urlencoded", { extended: true, limit: "256mb" });

  const enableCompression = String(process.env.API_COMPRESSION ?? "").toLowerCase() !== "false";
  if (enableCompression) {
    try {
      const { default: compressionFn } = (await import("compression")) as unknown as {
        default: (opts: any) => any;
        filter: (req: any, res: any) => boolean;
      };
      const lvl = Number(process.env.COMPRESSION_LEVEL ?? 6) || 6;
      const fltr = (compressionFn as any).filter;
      app.use(
        compressionFn({
          threshold: 1024,
          level: lvl,
          memLevel: 8,
          filter: (req: any, res: any) => {
            if (req.headers["x-no-compression"]) return false;
            return typeof fltr === "function" ? fltr(req, res) : true;
          },
        }),
      );
      bootstrapLogger.log("Compression ENABLED (package loaded OK)");
    } catch (compErr) {
      bootstrapLogger.warn(
        `Compression DISABLED (package 'compression' tidak terinstall di node_modules). Lanjut tanpa gzip — tidak pengaruh fungsi API. Detail: ${
          compErr instanceof Error ? compErr.message : String(compErr)
        }`,
      );
    }
  }

  app.use((req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
    const method = String(req.method ?? "").toUpperCase();
    if (method === "GET" || method === "HEAD") {
      const urlPath = String(req.originalUrl ?? req.url ?? "");
      const isMasterData = /\/(master-data|wilayah|perdirjen-equipment|cp-fase-f)\//.test(urlPath);
      const isUpload = /\/uploads\//.test(urlPath);
      if (isUpload) {
        next();
        return;
      }
      if (isMasterData) {
        res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=3600, stale-if-error=86400");
      } else {
        res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=60, stale-if-error=1800, must-revalidate");
      }
      res.setHeader("Vary", "Accept-Encoding, Authorization, Accept");
    } else {
      res.setHeader("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate");
      res.setHeader("Pragma", "no-cache");
    }
    next();
  });

  const staticCacheMs = Number(process.env.STATIC_UPLOAD_CACHE_MAX_AGE_MS ?? 0) || 7 * 24 * 3600 * 1000;
  const staticMaxAgeSec = Math.floor(staticCacheMs / 1000);
  app.useStaticAssets(uploadsDirectory, {
    prefix: "/uploads/",
    maxAge: staticMaxAgeSec * 1000,
    etag: true,
    lastModified: true,
    index: false,
    setHeaders: (res) => {
      try {
        (res as unknown as { setHeader: (k: string, v: string) => void }).setHeader(
          "Cache-Control",
          `public, max-age=${staticMaxAgeSec}, stale-while-revalidate=${staticMaxAgeSec * 2}, immutable`,
        );
      } catch {
        /* ignore */
      }
    },
  });
  app.useStaticAssets(uploadsDirectory, {
    prefix: "/v1/uploads/",
    maxAge: staticMaxAgeSec * 1000,
    etag: true,
    lastModified: true,
    index: false,
    setHeaders: (res) => {
      try {
        (res as unknown as { setHeader: (k: string, v: string) => void }).setHeader(
          "Cache-Control",
          `public, max-age=${staticMaxAgeSec}, stale-while-revalidate=${staticMaxAgeSec * 2}, immutable`,
        );
      } catch {
        /* ignore */
      }
    },
  });

  app.enableCors({
    origin: true,
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    preflightContinue: false,
    optionsSuccessStatus: 204,
    allowedHeaders: ["Content-Type", "Accept", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Content-Disposition"],
  });

  app.setGlobalPrefix("v1", {
    exclude: [
      { path: "health", method: RequestMethod.GET },
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
      exceptionFactory: (errors) => {
        const msg = errors
          .map((e) => {
            if (!e.constraints) return e.property;
            const details = Object.values(e.constraints).join("; ");
            return `${e.property}: ${details}`;
          })
          .join(" | ");
        return new BadRequestException(msg);
      },
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
    new ResponseInterceptor(),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("SARANASMK Enterprise API v1")
    .setDescription("SARANA SMK Platform Backend API Enterprise v1")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("/v1/docs", app, swaggerDocument);

  const port = Number(process.env.PORT ?? 4000);

  try {
    await app.listen(port);
  } catch (listenErr) {
    bootstrapLogger.error(
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🚨 PORT ${port} SUDAH DIGUNAKAN ATAU NETWORK ERROR!\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nSolusi cepat:\n  1. lsof -i :${port} | grep LISTEN   → lihat PID yang pakai port\n  2. kill -9 <PID>\n  3. Jalankan npm run dev:api LAGI\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n      `,
    );
    console.error(listenErr);
    process.exit(1);
  }

  try {
    const databaseSvc = app.get(DatabaseService);
    const usersSvc = app.get(UsersService);
    const authSvc = app.get(AuthService);
    const workspaceSvc = app.get(WorkspaceDataService);
    const schoolProfileSvc = app.get(SchoolProfileService);
    const manualRunner = async () => {
      try {
        await (usersSvc as unknown as { ensureUsersSchemaReady?: () => Promise<void> })
          .ensureUsersSchemaReady?.call(usersSvc);
      } catch {
        /* ignore non-fatal schema boostrap */
      }
      try {
        await (authSvc as unknown as { ensureUsersColumnsSchemaReady?: () => Promise<void> })
          .ensureUsersColumnsSchemaReady?.call(authSvc);
      } catch {
        /* ignore */
      }
      try {
        await (authSvc as unknown as { ensureRoles?: () => Promise<void> }).ensureRoles?.call(authSvc);
      } catch {
        /* ignore */
      }
      try {
        await (authSvc as unknown as { seedDemoUsersIfNeeded?: () => Promise<void> })
          .seedDemoUsersIfNeeded?.call(authSvc);
      } catch {
        /* ignore */
      }
      try {
        await (workspaceSvc as unknown as { ensureSchema?: () => Promise<void> }).ensureSchema?.call(
          workspaceSvc,
        );
      } catch {
        /* ignore */
      }
      try {
        await (schoolProfileSvc as unknown as { ensureSchema?: () => Promise<void> })
          .ensureSchema?.call(schoolProfileSvc);
      } catch {
        /* ignore */
      }
      void databaseSvc;
    };
    void manualRunner();
  } catch {
    /* manual bootstrap non-fatal */
  }

  const mb = Math.round(process.memoryUsage().heapUsed / 1048576);
  console.log(`\n✅ SARANA SMK API berjalan di http://localhost:${port}/v1  (heap: ${mb} MB)`);
}

bootstrap().catch((fatalErr) => {
  bootstrapLogger.error(
    "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n💀 FATAL: GAGAL BOOTSTRAP APLIKASI (main.ts catch)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n",
  );
  console.error(fatalErr);
  if (fatalErr instanceof Error && fatalErr.stack) console.error("\nStackTrace:", fatalErr.stack);
  process.exit(1);
});
