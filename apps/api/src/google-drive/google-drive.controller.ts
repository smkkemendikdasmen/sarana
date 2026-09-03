import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { AuthService } from "../auth/auth.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { GoogleDriveService, RpdPksKind, type SchoolRpdPksDocumentRow } from "./google-drive.service.js";

type JwtAuthUserLike = {
  id: string;
  username: string;
  fullName: unknown;
  role: unknown;
  organization: unknown;
  region: unknown;
};

@Controller("google-drive")
export class GoogleDriveController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  private gdrive(): GoogleDriveService {
    return GoogleDriveService.getGlobalSingletonInstance();
  }

  @Get("config-status")
  @UseGuards(JwtAuthGuard)
  async configStatus() {
    try {
      const svc = this.gdrive();
      const configured = svc.isConfigured();
      const rpdTemplateId = process.env.GOOGLE_DRIVE_RPD_TEMPLATE_ID ?? "";
      const pksTemplateId = process.env.GOOGLE_DRIVE_PKS_TEMPLATE_ID ?? "";
      const impersonateEmail = process.env.GOOGLE_DRIVE_IMPERSONATE_USER_EMAIL ?? "";
      return {
        ok: configured,
        configured,
        serviceAccountReady: configured,
        envNeedsFill: [
          {
            key: "GOOGLE_SERVICE_ACCOUNT_JSON_BASE64",
            filled: !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 ?? "").trim(),
            hint: "Encode JSON key Service Account (dari Google Cloud) menjadi base64, tempel di sini.",
          },
          {
            key: "GOOGLE_DRIVE_RPD_TEMPLATE_ID",
            filled: !!rpdTemplateId,
            hint: "Dapatkan dari URL template Google Doc RPD: https://docs.google.com/document/d/<ID>/edit",
          },
          {
            key: "GOOGLE_DRIVE_PKS_TEMPLATE_ID",
            filled: !!pksTemplateId,
            hint: "Dapatkan dari URL template Google Doc PKS: https://docs.google.com/document/d/<ID>/edit",
          },
          {
            key: "GOOGLE_DRIVE_IMPERSONATE_USER_EMAIL",
            filled: !!impersonateEmail,
            optional: true,
            hint:
              "(Opsional) User email akun Google yang akan di-impersonate untuk kepemilikan document. Jika tidak diisi, document dimiliki oleh Service Account (email serviceaccount@...).",
          },
        ],
      };
    } catch (err) {
      throw err instanceof Error ? err : new InternalServerErrorException(String(err));
    }
  }

  @Get("rpd-pks/by-school/:npsn")
  @UseGuards(JwtAuthGuard)
  async listBySchool(@Param("npsn") npsn: string) {
    try {
      const svc = this.gdrive();
      if (!npsn?.trim()) throw new BadRequestException("NPSN tidak diisi.");
      const allDocs = (await svc.listAllByNpsn(npsn)) as SchoolRpdPksDocumentRow[];
      const kinds: RpdPksKind[] = ["RPD", "PKS"];
      const rows: SchoolRpdPksDocumentRow[] = kinds.map((kind) => {
        const found = allDocs.find((d) => d.kind === kind);
        if (found) return found;
        return {
          id: "",
          npsn,
          kind,
          template_doc_id: null,
          google_doc_id: null,
          title: `Dokumen ${kind}`,
          doc_url: null,
          embed_url: null,
          status: "CREATING" as const,
          last_synced_at: null,
          exported_pdf_url: null,
          exported_docx_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error_message: null,
        };
      });
      return { npsn, rows };
    } catch (err) {
      throw err instanceof Error ? err : new InternalServerErrorException(String(err));
    }
  }

  @Post("rpd-pks/create-for-school/:npsn")
  @UseGuards(JwtAuthGuard)
  async createForSchool(@Param("npsn") npsn: string, @Query("kind") kind?: string) {
    const svc = this.gdrive();
    const normalizedKind: RpdPksKind = kind === "PKS" ? "PKS" : "RPD";
    const row = await svc.createOrRefreshDocumentForSchool(npsn, normalizedKind);
    return { ok: true, row, kind: normalizedKind };
  }

  @Post("rpd-pks/link-existing-for-school/:npsn")
  @UseGuards(JwtAuthGuard)
  async linkExistingForSchool(
    @Param("npsn") npsn: string,
    @Body() body: { kind?: string; doc_id_or_url?: string },
  ) {
    const svc = this.gdrive();
    if (!npsn?.trim()) throw new BadRequestException("NPSN tidak diisi.");
    const normalizedKind: RpdPksKind = body?.kind === "PKS" ? "PKS" : "RPD";
    const rawUrl = String(body?.doc_id_or_url ?? "").trim();
    if (!rawUrl) {
      throw new BadRequestException(
        "Link Google Doc belum di-paste. Copy URL doc copy-an kamu (setelah Make a copy) lalu tempel di kolom 'Link Google Doc ini'.",
      );
    }
    const row = await svc.linkExistingDocumentForSchool(npsn, normalizedKind, rawUrl);
    return { ok: true, row, kind: normalizedKind };
  }

  @Get("rpd-pks/share-public/:docId")
  @UseGuards(JwtAuthGuard)
  async sharePublic(@Param("docId") docId: string, @Query("role") role?: "reader" | "writer") {
    const svc = this.gdrive();
    if (!docId?.trim()) throw new BadRequestException("docId tidak diisi.");
    const r: "reader" | "writer" = role === "reader" ? "reader" : "writer";
    const url = await svc.setDocumentPubliclyViewableOrShare(docId, r);
    return { ok: true, url, role: r };
  }

  private async verifyBearerAuthSource(
    req: { headers?: Record<string, unknown> },
    authBearerQuery?: string,
  ): Promise<JwtAuthUserLike> {
    const header = (req?.headers?.authorization as string | undefined) ?? "";
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length)
      : authBearerQuery && authBearerQuery.startsWith("Bearer ")
        ? authBearerQuery.slice("Bearer ".length)
        : authBearerQuery;
    if (!token) throw new UnauthorizedException("Authorization bearer dibutuhkan.");
    let user: JwtAuthUserLike | undefined = undefined;
    try {
      const result = (await this.authService.verifyToken(token)) as unknown;
      if (result && typeof result === "object" && "id" in result) {
        user = result as JwtAuthUserLike;
      }
    } catch (e) {
      throw new UnauthorizedException("Authorization bearer tidak valid / expired.");
    }
    if (!user?.id) throw new UnauthorizedException("User tidak ditemukan di token JWT.");
    return user;
  }

  @Get("rpd-pks/export/:docId")
  async exportDocument(
    @Param("docId") docId: string,
    @Query("format") formatRaw?: string,
    @Query("authorization_bearer") authBearerQuery?: string,
    @Req() req?: { headers?: Record<string, unknown> },
    @Res() res?: Response,
  ) {
    if (!res) throw new BadRequestException("Response object tidak tersedia.");
    if (!docId?.trim()) throw new BadRequestException("docId tidak diisi.");
    await this.verifyBearerAuthSource(req ?? {}, authBearerQuery);
    const svc = this.gdrive();
    const format = formatRaw === "docx" ? "docx" : "pdf";
    const row = await svc.findDocumentById(docId);
    const fileNameFallback =
      row?.title ??
      (format === "pdf" ? `dokumen-rpd-pks-${docId}` : `dokumen-rpd-pks-${docId}`);
    const safeFileName = fileNameFallback.replace(/[^\w\- ]+/g, "").slice(0, 80) || "dokumen";
    const contentType =
      format === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const ext = format === "pdf" ? "pdf" : "docx";
    const readable = await svc.exportDocumentStream(docId, format);
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(safeFileName + "." + ext)}"`,
    );
    readable.pipe(res);
  }
}
