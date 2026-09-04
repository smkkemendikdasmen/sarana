import { Body, Controller, Delete, ForbiddenException, Get, Header, NotFoundException, Param, Patch, Post, Put, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import * as XLSX from "xlsx";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { AuthService } from "../auth/auth.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { WorkspaceDataService } from "./workspace-data.service.js";

class UpsertAssignmentsBody {
  @IsArray()
  records!: Array<{
    key: string;
    moduleKey: "wawancara" | "bimbingan-teknis" | "verifikasi-online" | "pra-bimtek";
    moduleLabel: string;
    sourceTab: "bantuan" | "abt";
    sourceLabel: string;
    schoolNo: number;
    schoolNpsn: string;
    schoolName: string;
    facilitatorAdministrationId: string;
    facilitatorAdministrationName: string;
    facilitatorEquipmentId: string;
    facilitatorEquipmentName: string;
    interviewScheduledDate?: string | null;
    interviewScheduledTime?: string | null;
    interviewMeetingLink?: string | null;
    praBimtekScheduledDate?: string | null;
    praBimtekScheduledTime?: string | null;
    praBimtekMeetingLink?: string | null;
    bimtekScheduledDate?: string | null;
    bimtekLocation?: string | null;
    bimtekStatus?: string | null;
    updatedAt: string;
  }>;
}

class InterviewAnswerItemBody {
  @IsEnum([1, 2, 3, 4, 5])
  score!: 1 | 2 | 3 | 4 | 5;

  @IsString()
  @IsOptional()
  comment?: string;
}

class UpsertInterviewBody {
  @IsString()
  @IsNotEmpty()
  assignmentKey!: string;

  @IsString()
  @IsNotEmpty()
  schoolNpsn!: string;

  @IsString()
  @IsNotEmpty()
  schoolName!: string;

  @IsString()
  @IsNotEmpty()
  facilitatorEquipmentId!: string;

  @IsString()
  @IsNotEmpty()
  facilitatorEquipmentName!: string;

  @IsObject()
  answers!: Record<string, InterviewAnswerItemBody>;

  @IsNumber()
  totalScore!: number;

  @IsString()
  @IsNotEmpty()
  recommendation!: string;

  @IsString()
  @IsOptional()
  note?: string | null;

  @IsString()
  @IsNotEmpty()
  updatedAt!: string;
}

class UpsertBimtekReviewBody {
  @IsString()
  @IsNotEmpty()
  schoolNpsn!: string;

  @IsString()
  @IsNotEmpty()
  schoolName!: string;

  @IsString()
  @IsNotEmpty()
  facilitatorEquipmentId!: string;

  @IsString()
  @IsNotEmpty()
  facilitatorEquipmentName!: string;

  @IsObject()
  statuses!: Record<"survey" | "rpkp" | "rab", "pending" | "revisi" | "approved">;

  @IsObject()
  notes!: Record<"survey" | "rpkp" | "rab", string>;

  @IsString()
  @IsOptional()
  fasilAlatComment?: string | null;

  @IsString()
  @IsOptional()
  fasilAdminComment?: string | null;

  @IsString()
  @IsNotEmpty()
  updatedAt!: string;
}

class SaveSchoolProposalBody {
  @IsObject()
  @IsOptional()
  proposalTables?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  rpkpSelections?: Record<string, unknown>;

  @IsInt()
  @Min(0)
  @IsOptional()
  rpkpGrandTotalRp?: number;
}

class PatchSchoolProposalDeltaBody {
  @IsObject()
  @IsOptional()
  changedProposalKeys?: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  changedRpkpKeys?: Record<string, unknown>;

  @IsArray()
  @IsOptional()
  deletedProposalKeys?: string[];

  @IsArray()
  @IsOptional()
  deletedRpkpKeys?: string[];

  @IsNumber()
  @IsOptional()
  expectedVersion?: number;
}

class SaveProposalPreparationsItem {
  @IsString()
  @IsNotEmpty()
  uuid!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  quantity?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  unitPrice?: number;
}
class SaveProposalPreparationsGroup {
  @IsString()
  @IsNotEmpty()
  uuid!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @ValidateNested()
  @Type(() => SaveProposalPreparationsItem)
  @IsArray()
  @IsOptional()
  items?: SaveProposalPreparationsItem[];
}
class SaveProposalPreparationsBody {
  @ValidateNested({ each: true })
  @Type(() => SaveProposalPreparationsGroup)
  @IsArray()
  groups!: SaveProposalPreparationsGroup[];

  @IsString()
  @IsOptional()
  schoolNpsn?: string;
}

class SaveTrainingCostItem {
  @IsString()
  @IsNotEmpty()
  uuid!: string;

  @IsString()
  @IsOptional()
  productName?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  unitPrice?: number;

  @IsBoolean()
  @IsOptional()
  requiresTraining?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  trainingCost?: number;
}
class SaveTrainingCostsBody {
  @ValidateNested({ each: true })
  @Type(() => SaveTrainingCostItem)
  @IsArray()
  costs!: SaveTrainingCostItem[];

  @IsString()
  @IsOptional()
  schoolNpsn?: string;
}

// ===== Clean MVCR PAGU BUDGET (3 Pagu Sekolah SSOT PK NPSN+tahun_ajaran) =====
const PAGU_ALLOWED_STATUS = ["DRAFT", "DITETAPKAN", "LOCKED", "DIPERPBAHARUI"] as const;
type PaguStatus = (typeof PAGU_ALLOWED_STATUS)[number];

class UpsertSchoolPaguBody {
  @IsString()
  @IsNotEmpty()
  schoolNpsn!: string;

  @IsString()
  @IsOptional()
  tahunAjaran?: string;

  @IsInt()
  @Min(0)
  paguPersiapan!: number;

  @IsInt()
  @Min(0)
  paguAlat!: number;

  @IsInt()
  @Min(0)
  paguPelatihan!: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  paguTotal?: number;

  @IsString()
  @IsIn(PAGU_ALLOWED_STATUS as unknown as string[])
  @IsOptional()
  status?: PaguStatus;
}

// ===== Clean MVCR KONSENTRASI REKOMENDASI (Top 5 row_order 1-5, Master 128 Options) =====
class PatchKonsentrasiRekomendasiRowBody {
  @IsString()
  @IsNotEmpty()
  schoolNpsn!: string;

  @IsString()
  @IsOptional()
  konsentrasi1Code?: string;

  @IsString()
  @IsOptional()
  konsentrasi2Code?: string;

  @IsString()
  @IsOptional()
  konsentrasi3Code?: string;

  @IsString()
  @IsOptional()
  konsentrasi4Code?: string;

  @IsString()
  @IsOptional()
  konsentrasi5Code?: string;
}

// ===== Clean MVCR REVIEW COMMENTS (SSOT Komentar per Domain per Fasilitator) =====
const REVIEW_DOMAIN_SCOPES = [
  "1_INFORMASI",
  "2_DOKUMEN",
  "3_KONSENTRASI",
  "4_ALAT",
  "5_AJUAN_PERSIAPAN",
  "5_AJUAN_SURVEY",
  "5_AJUAN_RPKP",
  "5_AJUAN_PELATIHAN",
  "PAGU",
  "LAINNYA",
] as const;
type ReviewDomainScope = (typeof REVIEW_DOMAIN_SCOPES)[number];
const REVIEW_COMMENTER_ROLES = [
  "FASILITATOR_ALAT",
  "FASILITATOR_ADMINISTRASI",
  "ADMIN",
  "SUPERADMIN",
  "KOORDINATOR_ALAT",
] as const;
type ReviewCommenterRole = (typeof REVIEW_COMMENTER_ROLES)[number];
const REVIEW_SEVERITIES = ["INFO", "WARNING", "WAJIB_PERBAIKI", "APPROVE"] as const;
type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];

const FASILITATOR_ALAT_SCOPES: ReadonlySet<ReviewDomainScope> = new Set([
  "4_ALAT",
  "5_AJUAN_SURVEY",
  "5_AJUAN_RPKP",
  "5_AJUAN_PELATIHAN",
  "LAINNYA",
]);
const FASILITATOR_ADMIN_SCOPES: ReadonlySet<ReviewDomainScope> = new Set([
  "1_INFORMASI",
  "2_DOKUMEN",
  "3_KONSENTRASI",
  "5_AJUAN_PERSIAPAN",
  "LAINNYA",
]);

class AddSchoolReviewCommentBody {
  @IsString()
  @IsNotEmpty()
  schoolNpsn!: string;

  @IsString()
  @IsIn(REVIEW_DOMAIN_SCOPES as unknown as string[])
  domainScope!: ReviewDomainScope;

  @IsString()
  @IsOptional()
  recordRef?: string | null;

  @IsString()
  @IsIn(REVIEW_COMMENTER_ROLES as unknown as string[])
  commenterRole!: ReviewCommenterRole;

  @IsString()
  @IsNotEmpty()
  commenterName!: string;

  @IsString()
  @IsNotEmpty()
  commentText!: string;

  @IsString()
  @IsIn(REVIEW_SEVERITIES as unknown as string[])
  @IsOptional()
  severity?: ReviewSeverity;
}

class ResolveSchoolReviewCommentBody {
  @IsString()
  @IsNotEmpty()
  commentId!: string;

  @IsBoolean()
  @IsOptional()
  isResolved?: boolean;
}

class SaveSchoolEquipmentBody {
  @IsObject()
  @IsOptional()
  equipmentTables?: Record<string, unknown>;
}

class PatchSchoolEquipmentDeltaBody {
  @IsObject()
  @IsOptional()
  changedKeys?: Record<string, unknown>;

  @IsArray()
  @IsOptional()
  deletedKeys?: string[];

  @IsNumber()
  @IsOptional()
  expectedVersion?: number;
}

class UpdateDatasetRowBody {
  @IsEnum(["REGULER", "ABT"])
  datasetKey!: "REGULER" | "ABT";

  @IsString()
  @IsNotEmpty()
  schoolNpsn!: string;

  @IsNumber()
  @IsOptional()
  schoolNo?: number;

  @IsString()
  @IsOptional()
  schoolName?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  note?: string | null;

  @IsBoolean()
  @IsOptional()
  isSelected?: boolean | null;

  @IsObject()
  @IsOptional()
  rawPayloadPatch?: Record<string, unknown>;
}

class DeleteDatasetRowBody {
  @IsEnum(["REGULER", "ABT"])
  datasetKey!: "REGULER" | "ABT";

  @IsString()
  @IsNotEmpty()
  schoolNpsn!: string;
}

class InsertDatasetRowBody {
  @IsEnum(["REGULER", "ABT"])
  datasetKey!: "REGULER" | "ABT";

  @IsString()
  @IsNotEmpty()
  schoolNpsn!: string;

  @IsNumber()
  @IsOptional()
  schoolNo?: number;

  @IsString()
  @IsNotEmpty()
  schoolName!: string;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  note?: string | null;

  @IsBoolean()
  @IsOptional()
  isSelected?: boolean | null;

  @IsObject()
  @IsOptional()
  rawPayload?: Record<string, unknown>;
}

class UpsertVerifikasiOnlineReviewBody {
  @IsString()
  @IsNotEmpty()
  schoolNpsn!: string;

  @IsString()
  @IsNotEmpty()
  schoolName!: string;

  @IsEnum(["ADMINISTRASI", "PERALATAN"])
  reviewerRole!: "ADMINISTRASI" | "PERALATAN";

  @IsString()
  @IsNotEmpty()
  reviewerId!: string;

  @IsString()
  @IsNotEmpty()
  reviewerName!: string;

  @IsString()
  @IsOptional()
  reviewNote?: string | null;

  @IsBoolean()
  @IsOptional()
  approved?: boolean | null;

  @IsString()
  @IsNotEmpty()
  updatedAt!: string;
}

class UpdateInterviewScheduleBody {
  @IsEnum(["wawancara", "bimbingan-teknis", "verifikasi-online"])
  moduleKey!: "wawancara" | "bimbingan-teknis" | "verifikasi-online";

  @IsEnum(["bantuan", "abt"])
  sourceTab!: "bantuan" | "abt";

  @IsString()
  @IsNotEmpty()
  schoolNpsn!: string;

  @IsOptional()
  @IsString()
  interviewScheduledDate?: string | null;

  @IsOptional()
  @IsString()
  interviewScheduledTime?: string | null;

  @IsOptional()
  @IsString()
  interviewMeetingLink?: string | null;

  @IsString()
  @IsNotEmpty()
  updatedAt!: string;
}

class UpsertMasterTemplateBody {
  @IsOptional()
  @IsString()
  id?: string;

  @IsEnum(["IDENTITAS", "ADMINISTRASI", "SURVEY_HARGA", "RPKP", "RAB", "RPD", "PKS"])
  kind!: "IDENTITAS" | "ADMINISTRASI" | "SURVEY_HARGA" | "RPKP" | "RAB" | "RPD" | "PKS";

  @IsOptional()
  @IsString()
  version_label?: string;

  @IsOptional()
  @IsString()
  tahun_ajaran?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean | number;

  @IsString()
  title!: string;

  @IsString()
  body_html!: string;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

class SetTemplateActiveBody {
  @IsEnum(["IDENTITAS", "ADMINISTRASI", "SURVEY_HARGA", "RPKP", "RAB", "RPD", "PKS"])
  kind!: "IDENTITAS" | "ADMINISTRASI" | "SURVEY_HARGA" | "RPKP" | "RAB" | "RPD" | "PKS";
}

class UpsertSchoolInstanceBody {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @IsNotEmpty()
  school_npsn!: string;

  @IsOptional()
  @IsString()
  school_name?: string;

  @IsEnum(["pra-bimtek", "bimbingan-teknis"])
  module_context!: "pra-bimtek" | "bimbingan-teknis";

  @IsEnum(["IDENTITAS", "ADMINISTRASI", "SURVEY_HARGA", "RPKP", "RAB", "RPD", "PKS"])
  kind!: "IDENTITAS" | "ADMINISTRASI" | "SURVEY_HARGA" | "RPKP" | "RAB" | "RPD" | "PKS";

  @IsOptional()
  @IsString()
  template_id?: string | null;

  @IsString()
  body_html!: string;

  @IsOptional()
  @IsString()
  review_notes?: string | null;

  @IsOptional()
  @IsEnum(["DRAFT", "REVIEWED", "APPROVED", "REJECTED"])
  review_status?: "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED";
}

@UseGuards(JwtAuthGuard)
@Controller("workspace-data")
export class WorkspaceDataController {
  constructor() {}

  @Get("admin/selection")
  getAdminSelection(
    @Query("datasetKey") datasetKey?: "REGULER" | "ABT" | "ALL",
    @Query("scope") scope?: "full" | "light",
    @Query("schoolNpsn") schoolNpsn?: string,
  ) {
    const safeDatasetKey =
      datasetKey === "REGULER" || datasetKey === "ABT" ? datasetKey : "ALL";
    const safeScope = scope === "light" ? "light" : "full";
    return WorkspaceDataService.getGlobalSingletonInstance().getAdminSelectionData({
      datasetKey: safeDatasetKey,
      scope: safeScope,
      schoolNpsn: schoolNpsn?.trim() || undefined,
    });
  }

  @Post("admin/dataset-row")
  insertDatasetRow(@Body() body: InsertDatasetRowBody) {
    return WorkspaceDataService.getGlobalSingletonInstance().insertDatasetRow({
      datasetKey: body.datasetKey,
      schoolNpsn: body.schoolNpsn,
      schoolNo: body.schoolNo,
      schoolName: body.schoolName,
      province: body.province,
      city: body.city,
      district: body.district,
      note: body.note,
      isSelected: body.isSelected,
      rawPayload: body.rawPayload,
    });
  }

  @Patch("admin/dataset-row")
  updateDatasetRow(@Body() body: UpdateDatasetRowBody) {
    return WorkspaceDataService.getGlobalSingletonInstance().updateDatasetRow({
      datasetKey: body.datasetKey,
      schoolNpsn: body.schoolNpsn,
      schoolNo: body.schoolNo,
      schoolName: body.schoolName,
      province: body.province,
      city: body.city,
      district: body.district,
      note: body.note,
      isSelected: body.isSelected,
      rawPayloadPatch: body.rawPayloadPatch,
    });
  }

  @Delete("admin/dataset-row")
  deleteDatasetRow(@Query() qs: DeleteDatasetRowBody) {
    return WorkspaceDataService.getGlobalSingletonInstance().deleteDatasetRow({
      datasetKey: qs.datasetKey,
      schoolNpsn: qs.schoolNpsn,
    });
  }

  @Get("admin/source-schools")
  getAssignmentSourceRows(@Query("sourceTab") sourceTab: string) {
    const safeSourceTab = sourceTab === "abt" ? "abt" : "bantuan";
    return WorkspaceDataService.getGlobalSingletonInstance().getAssignmentSourceRows(safeSourceTab);
  }

  @Get("assignments")
  getAssignments(
    @Query("moduleKey")
    moduleKey?:
      | "wawancara"
      | "bimbingan-teknis"
      | "verifikasi-online"
      | "pra-bimtek",
    @Query("facilitatorEquipmentId") facilitatorEquipmentId?: string,
    @Query("facilitatorEquipmentName") facilitatorEquipmentName?: string,
    @Query("facilitatorAdministrationId") facilitatorAdministrationId?: string,
    @Query("facilitatorAdministrationName") facilitatorAdministrationName?: string,
    @Query("schoolNpsn") schoolNpsn?: string,
  ) {
    const safeModuleKey:
      | "wawancara"
      | "bimbingan-teknis"
      | "verifikasi-online"
      | "pra-bimtek"
      | undefined =
      moduleKey === "wawancara" ||
      moduleKey === "bimbingan-teknis" ||
      moduleKey === "verifikasi-online" ||
      moduleKey === "pra-bimtek"
        ? moduleKey
        : undefined;
    return WorkspaceDataService.getGlobalSingletonInstance().getAssignments(
      safeModuleKey,
      facilitatorEquipmentId,
      facilitatorEquipmentName,
      facilitatorAdministrationId,
      facilitatorAdministrationName,
      schoolNpsn?.trim() || undefined,
    );
  }

  @Post("assignments/bulk")
  upsertAssignments(@Body() body: UpsertAssignmentsBody) {
    return WorkspaceDataService.getGlobalSingletonInstance().upsertAssignments(Array.isArray(body.records) ? body.records : []);
  }

  @Patch("assignments/interview-schedule")
  updateInterviewSchedule(@Body() body: UpdateInterviewScheduleBody) {
    return WorkspaceDataService.getGlobalSingletonInstance().updateAssignmentInterviewSchedule(
      body.moduleKey,
      body.sourceTab,
      body.schoolNpsn,
      {
        interviewScheduledDate: body.interviewScheduledDate ?? null,
        interviewScheduledTime: body.interviewScheduledTime ?? null,
        interviewMeetingLink: body.interviewMeetingLink ?? null,
        updatedAt: body.updatedAt,
      },
    );
  }

  @Get("interviews")
  getInterviewAssessments() {
    return WorkspaceDataService.getGlobalSingletonInstance().getInterviewAssessments();
  }

  @Put("interviews")
  upsertInterview(@Body() body: UpsertInterviewBody) {
    return WorkspaceDataService.getGlobalSingletonInstance().upsertInterviewAssessment({
      assignmentKey: body.assignmentKey,
      schoolNpsn: body.schoolNpsn,
      schoolName: body.schoolName,
      facilitatorEquipmentId: body.facilitatorEquipmentId,
      facilitatorEquipmentName: body.facilitatorEquipmentName,
      answers: body.answers,
      totalScore: Number(body.totalScore ?? 0),
      recommendation: body.recommendation ?? "",
      note: body.note ?? "",
      updatedAt: body.updatedAt,
    });
  }

  @Get("bimtek-reviews")
  getBimtekReviews() {
    return WorkspaceDataService.getGlobalSingletonInstance().getBimtekReviews();
  }

  @Put("bimtek-reviews")
  upsertBimtekReview(@Body() body: UpsertBimtekReviewBody) {
    return WorkspaceDataService.getGlobalSingletonInstance().upsertBimtekReview(body);
  }

  @Get("verifikasi-online/reviews")
  getVerifikasiOnlineReviews(@Query("schoolNpsn") schoolNpsn?: string) {
    return WorkspaceDataService.getGlobalSingletonInstance().getVerifikasiOnlineReviews(
      schoolNpsn?.trim() || undefined,
    );
  }

  @Put("verifikasi-online/reviews")
  upsertVerifikasiOnlineReview(@Body() body: UpsertVerifikasiOnlineReviewBody) {
    return WorkspaceDataService.getGlobalSingletonInstance().upsertVerifikasiOnlineReview({
      schoolNpsn: body.schoolNpsn,
      schoolName: body.schoolName,
      reviewerRole: body.reviewerRole,
      reviewerId: body.reviewerId,
      reviewerName: body.reviewerName,
      reviewNote: body.reviewNote,
      approved: body.approved,
      updatedAt: body.updatedAt,
    });
  }

  @Get("school-proposals/me")
  getSchoolProposalForUser(@Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> }) {
    return WorkspaceDataService.getGlobalSingletonInstance().getSchoolProposalForUser(request.user);
  }

  @Put("school-proposals/me")
  saveSchoolProposalForUser(
    @Req() request: {
      user: Awaited<ReturnType<AuthService["verifyToken"]>>;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
    @Body() body: SaveSchoolProposalBody,
  ) {
    const ipAddress =
      (request.headers?.["cf-connecting-ip"] as string | undefined) ||
      (request.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      request.ip ||
      null;
    const userAgent = (request.headers?.["user-agent"] as string | undefined) ?? null;
    const requestId = (request.headers?.["x-request-id"] as string | undefined) ?? null;
    return WorkspaceDataService.getGlobalSingletonInstance().saveSchoolProposalForUser(
      request.user,
      {
        proposalTables: body.proposalTables ?? {},
        rpkpSelections: body.rpkpSelections ?? {},
        rpkpGrandTotalRp: typeof body.rpkpGrandTotalRp === "number" && Number.isFinite(body.rpkpGrandTotalRp) ? Math.max(0, Math.floor(body.rpkpGrandTotalRp)) : null,
      },
      { ipAddress, userAgent, requestId },
    );
  }

  /**
   * PATCH /workspace-data/school-proposals/me/delta
   * T3.1: Partial payload diff — kirim HANYA key proposalTables/rpkpSelections yang berubah.
   * Payload 10-100x lebih kecil dari PUT full 30MB.
   */
  @Patch("school-proposals/me/delta")
  patchSchoolProposalDeltaForUser(
    @Req() request: {
      user: Awaited<ReturnType<AuthService["verifyToken"]>>;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
    @Body() body: PatchSchoolProposalDeltaBody,
  ) {
    const ipAddress =
      (request.headers?.["cf-connecting-ip"] as string | undefined) ||
      (request.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      request.ip ||
      null;
    const userAgent = (request.headers?.["user-agent"] as string | undefined) ?? null;
    const requestId = (request.headers?.["x-request-id"] as string | undefined) ?? null;
    return WorkspaceDataService.getGlobalSingletonInstance().patchSchoolProposalDeltaForUser(
      request.user,
      {
        changedProposalKeys: body.changedProposalKeys ?? {},
        changedRpkpKeys: body.changedRpkpKeys ?? {},
        deletedProposalKeys: body.deletedProposalKeys ?? [],
        deletedRpkpKeys: body.deletedRpkpKeys ?? [],
        expectedVersion: body.expectedVersion,
      },
      { ipAddress, userAgent, requestId },
    );
  }

  // ===== Clean MVC Relational: Biaya Persiapan (Proposal Preparation Groups + Items) =====
  @Get("school-proposals/preparations")
  getProposalPreparations(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Query("schoolNpsn") schoolNpsn?: string,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const userNpsn = typeof (user as any).npsn === "string" ? (user as any).npsn as string : "";
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN" || role.startsWith("FASILITATOR");
    const targetNpsn = isAdmin ? String(schoolNpsn ?? userNpsn ?? "").trim() : userNpsn;
    return WorkspaceDataService.getGlobalSingletonInstance().getPreparations({
      schoolNpsn: targetNpsn,
      role,
    });
  }

  @Put("school-proposals/preparations")
  saveProposalPreparations(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Body() body: SaveProposalPreparationsBody,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const userNpsn = typeof (user as any).npsn === "string" ? (user as any).npsn as string : "";
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN" || role.startsWith("FASILITATOR");
    const providedNpsn = String(body.schoolNpsn ?? "").trim();
    const targetNpsn = isAdmin && providedNpsn ? providedNpsn : userNpsn;
    const transformedGroups = Array.isArray(body.groups)
      ? body.groups.map((g) => ({
          uuid: g.uuid,
          name: String(g.name ?? ""),
          items: Array.isArray(g.items)
            ? g.items.map((it) => ({
                uuid: it.uuid,
                description: String(it.description ?? ""),
                quantity: Number(it.quantity ?? 0),
                unitPrice: Number(it.unitPrice ?? 0),
              }))
            : [],
        }))
      : [];
    return WorkspaceDataService.getGlobalSingletonInstance().replacePreparations({
      schoolNpsn: targetNpsn,
      role,
      groups: transformedGroups,
    });
  }

  // ===== Clean MVC Relational: Biaya Pendukung Pelatihan 1,5% (Training Costs Flat List) =====
  @Get("school-proposals/training-costs")
  getProposalTrainingCosts(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Query("schoolNpsn") schoolNpsn?: string,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const userNpsn = typeof (user as any).npsn === "string" ? (user as any).npsn as string : "";
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN" || role.startsWith("FASILITATOR");
    const targetNpsn = isAdmin ? String(schoolNpsn ?? userNpsn ?? "").trim() : userNpsn;
    return WorkspaceDataService.getGlobalSingletonInstance().getTrainingCosts({
      schoolNpsn: targetNpsn,
      role,
    });
  }

  @Put("school-proposals/training-costs")
  saveProposalTrainingCosts(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Body() body: SaveTrainingCostsBody,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const userNpsn = typeof (user as any).npsn === "string" ? (user as any).npsn as string : "";
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN" || role.startsWith("FASILITATOR");
    const providedNpsn = String(body.schoolNpsn ?? "").trim();
    const targetNpsn = isAdmin && providedNpsn ? providedNpsn : userNpsn;
    const transformedCosts = Array.isArray(body.costs)
      ? body.costs.map((c) => ({
          uuid: c.uuid,
          productName: String(c.productName ?? ""),
          unitPrice: Number(c.unitPrice ?? 0),
          requiresTraining: (c.requiresTraining as any) === true || (c.requiresTraining as any) === 1 || (c.requiresTraining as any) === "true" ? true : false,
          trainingCost: Number(c.trainingCost ?? 0),
        }))
      : [];
    return WorkspaceDataService.getGlobalSingletonInstance().replaceTrainingCosts({
      schoolNpsn: targetNpsn,
      role,
      costs: transformedCosts,
    });
  }

  @Get("school-proposals/by-school-ids")
  getSchoolProposalsBySchoolIds(@Query("ids") ids: string) {
    const npsns = ids
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    return WorkspaceDataService.getGlobalSingletonInstance().getSchoolProposalBundlesByNpsns(npsns);
  }

  @Get("school-equipment/me")
  getSchoolEquipmentForUser(@Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> }) {
    return WorkspaceDataService.getGlobalSingletonInstance().getSchoolEquipmentForUser(request.user);
  }

  @Put("school-equipment/me")
  saveSchoolEquipmentForUser(
    @Req() request: {
      user: Awaited<ReturnType<AuthService["verifyToken"]>>;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
    @Body() body: SaveSchoolEquipmentBody,
  ) {
    const ipAddress =
      (request.headers?.["cf-connecting-ip"] as string | undefined) ||
      (request.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      request.ip ||
      null;
    const userAgent = (request.headers?.["user-agent"] as string | undefined) ?? null;
    const requestId = (request.headers?.["x-request-id"] as string | undefined) ?? null;
    return WorkspaceDataService.getGlobalSingletonInstance().saveSchoolEquipmentForUser(
      request.user,
      { equipmentTables: body.equipmentTables ?? {} },
      { ipAddress, userAgent, requestId },
    );
  }

  /**
   * PATCH /workspace-data/school-equipment/me/delta
   * T3.1: Partial patch — kirim HANYA top-level key equipmentTables yang berubah
   *       + daftar key yang dihapus. Payload jauh lebih kecil dari PUT full.
   */
  @Patch("school-equipment/me/delta")
  patchSchoolEquipmentDeltaForUser(
    @Req() request: {
      user: Awaited<ReturnType<AuthService["verifyToken"]>>;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
    },
    @Body() body: PatchSchoolEquipmentDeltaBody,
  ) {
    const ipAddress =
      (request.headers?.["cf-connecting-ip"] as string | undefined) ||
      (request.headers?.["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      request.ip ||
      null;
    const userAgent = (request.headers?.["user-agent"] as string | undefined) ?? null;
    const requestId = (request.headers?.["x-request-id"] as string | undefined) ?? null;
    return WorkspaceDataService.getGlobalSingletonInstance().patchSchoolEquipmentDeltaForUser(
      request.user,
      {
        changedKeys: body.changedKeys ?? {},
        deletedKeys: body.deletedKeys ?? [],
        expectedVersion: body.expectedVersion,
      },
      { ipAddress, userAgent, requestId },
    );
  }

  @Get("school-proposals/by-npsn/:npsn")
  getSchoolProposalByNpsn(@Param("npsn") npsn: string) {
    return WorkspaceDataService.getGlobalSingletonInstance().getSchoolProposalByNpsn(npsn);
  }

  @Get("school-equipment/by-npsn/:npsn")
  getSchoolEquipmentByNpsn(@Param("npsn") npsn: string) {
    return WorkspaceDataService.getGlobalSingletonInstance().getSchoolEquipmentByNpsn(npsn);
  }

  @UseGuards(JwtAuthGuard)
  @Get("school-pagu/me")
  async getMySchoolPagu(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Query("tahunAjaran") tahunAjaran?: string,
  ) {
    return WorkspaceDataService.getGlobalSingletonInstance().getSchoolPaguForUser(
      request.user,
      tahunAjaran,
    );
  }

  // ===== Clean MVCR: PAGU BUDGET SEKOLAH (3 Pagu SSOT per NPSN) =====
  @Get("school-pagu/:npsn")
  async getSchoolPagu(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Param("npsn") npsnRaw: string,
    @Query("tahunAjaran") tahunAjaran?: string,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const userNpsn = typeof (user as any).npsn === "string" ? (user as any).npsn as string : "";
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN" || role.startsWith("FASILITATOR") || role === "KOORDINATOR_ALAT";
    const targetNpsn = isAdmin ? String(npsnRaw ?? userNpsn ?? "").trim() : userNpsn;
    const ta = String(tahunAjaran ?? "").trim() || "2026/2027";
    return WorkspaceDataService.getGlobalSingletonInstance().getSchoolPagu({
      schoolNpsn: targetNpsn,
      tahunAjaran: ta,
    });
  }

  @Put("school-pagu")
  async upsertSchoolPagu(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Body() body: UpsertSchoolPaguBody,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const isAllowed = role === "ADMIN" || role === "SUPERADMIN";
    if (!isAllowed) {
      throw new ForbiddenException("Hanya ADMIN/SUPERADMIN yang dapat menetapkan pagu sekolah.");
    }
    const userId = typeof (user as any).id === "string" ? ((user as any).id as string).slice(0, 64) : "admin";
    const userName = typeof (user as any).fullName === "string" ? String((user as any).fullName).slice(0, 255) : "Admin Pusat";
    const ta = String(body.tahunAjaran ?? "").trim() || "2026/2027";
    return WorkspaceDataService.getGlobalSingletonInstance().replaceSchoolPagu({
      schoolNpsn: String(body.schoolNpsn ?? "").trim(),
      tahunAjaran: ta,
      paguPersiapan: Math.max(0, Math.floor(Number(body.paguPersiapan) || 0)),
      paguAlat: Math.max(0, Math.floor(Number(body.paguAlat) || 0)),
      paguPelatihan: Math.max(0, Math.floor(Number(body.paguPelatihan) || 0)),
      paguTotal: Math.max(0, Math.floor(Number(body.paguTotal) || 0)),
      status: (PAGU_ALLOWED_STATUS as readonly string[]).includes(String(body.status ?? "")) ? (body.status as PaguStatus) : "DRAFT",
      setByAdminId: userId,
      setByAdminName: userName,
    });
  }

  // ===== ADMIN: PAGU ANGGARAN LIST BULK + SINGLE EDIT + EXCEL UPLOAD (131 ABT) =====
  @UseGuards(JwtAuthGuard)
  @Get("admin/pagu-anggaran/list")
  async getAdminPaguAnggaranList(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Query("tahunAjaran") tahunAjaran?: string,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const isAllowed = role === "ADMIN" || role === "SUPERADMIN";
    if (!isAllowed) {
      throw new ForbiddenException("Hanya ADMIN/SUPERADMIN yang dapat mengakses daftar pagu anggaran.");
    }
    const ta = String(tahunAjaran ?? "").trim() || "2026/2027";
    return WorkspaceDataService.getGlobalSingletonInstance().getAdminPaguAnggaranList({ tahunAjaran: ta });
  }

  @UseGuards(JwtAuthGuard)
  @Patch("admin/pagu-anggaran/row")
  async patchAdminPaguAnggaranRow(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Body() body: UpsertSchoolPaguBody,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const isAllowed = role === "ADMIN" || role === "SUPERADMIN";
    if (!isAllowed) {
      throw new ForbiddenException("Hanya ADMIN/SUPERADMIN yang dapat mengubah pagu anggaran.");
    }
    const svc = WorkspaceDataService.getGlobalSingletonInstance();
    const npsn = String(body.schoolNpsn ?? "").trim();
    const isAbt = await svc.isNpsnAbt(npsn);
    if (!isAbt) {
      throw new ForbiddenException(`NPSN ${npsn} tidak terdaftar di daftar sekolah ABT.`);
    }
    const userId = typeof (user as any).id === "string" ? ((user as any).id as string).slice(0, 64) : "admin";
    const userName = typeof (user as any).fullName === "string" ? String((user as any).fullName).slice(0, 255) : "Admin Pusat";
    const ta = String(body.tahunAjaran ?? "").trim() || "2026/2027";
    return svc.replaceSchoolPagu({
      schoolNpsn: npsn,
      tahunAjaran: ta,
      paguPersiapan: Math.max(0, Math.floor(Number(body.paguPersiapan) || 0)),
      paguAlat: Math.max(0, Math.floor(Number(body.paguAlat) || 0)),
      paguPelatihan: Math.max(0, Math.floor(Number(body.paguPelatihan) || 0)),
      paguTotal: Math.max(0, Math.floor(Number(body.paguTotal) || 0)),
      status: (PAGU_ALLOWED_STATUS as readonly string[]).includes(String(body.status ?? "")) ? (body.status as PaguStatus) : "DRAFT",
      setByAdminId: userId,
      setByAdminName: userName,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("admin/pagu-anggaran/upload-excel")
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok =
        file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.originalname.toLowerCase().endsWith(".xlsx");
      cb(null, ok);
    },
  }))
  async postAdminPaguAnggaranUploadExcel(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @UploadedFile() file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
    @Query("tahunAjaran") tahunAjaran?: string,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const isAllowed = role === "ADMIN" || role === "SUPERADMIN";
    if (!isAllowed) {
      throw new ForbiddenException("Hanya ADMIN/SUPERADMIN yang dapat upload excel pagu anggaran.");
    }
    if (!file || !file.buffer) {
      throw new NotFoundException("File excel tidak ditemukan atau kosong.");
    }
    const svc = WorkspaceDataService.getGlobalSingletonInstance();
    const userId = typeof (user as any).id === "string" ? ((user as any).id as string).slice(0, 64) : "admin";
    const userName = typeof (user as any).fullName === "string" ? String((user as any).fullName).slice(0, 255) : "Admin Pusat";
    const ta = String(tahunAjaran ?? "").trim() || "2026/2027";

    const wb = XLSX.read(file.buffer, { type: "buffer" });
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) {
      throw new NotFoundException("Sheet excel kosong / tidak ditemukan.");
    }
    const ws = wb.Sheets[firstSheet];
    const jsonRows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

    const summary = { inserted: 0, updated: 0, skipped: 0, errors: [] as Array<{ row: number; npsn?: string; message: string }> };

    for (let i = 0; i < jsonRows.length; i++) {
      const row = jsonRows[i];
      const rowNum = i + 2;
      try {
        const npsnRaw = row["NPSN"] ?? row["npsn"] ?? row["Npsn"] ?? "";
        const npsn = String(npsnRaw ?? "").trim().padStart(8, "0").slice(0, 8);
        if (!/^\d{8}$/.test(npsn)) {
          summary.errors.push({ row: rowNum, npsn: npsn || undefined, message: `NPSN tidak valid (harus 8 digit angka)` });
          summary.skipped++;
          continue;
        }
        const isAbt = await svc.isNpsnAbt(npsn);
        if (!isAbt) {
          summary.errors.push({ row: rowNum, npsn, message: `NPSN tidak terdaftar di daftar sekolah ABT` });
          summary.skipped++;
          continue;
        }

        const toNum = (v: unknown): number => {
          if (v === null || v === undefined || v === "") return 0;
          if (typeof v === "number") return Math.max(0, Math.floor(v));
          const s = String(v).replace(/[^\d]/g, "");
          return Math.max(0, Math.floor(Number(s) || 0));
        };
        const paguPersiapan = toNum(row["Pagu Persiapan"] ?? row["PaguPersiapan"] ?? row["pagu_persiapan"] ?? row["persiapan"]);
        const paguAlat = toNum(row["Pagu Alat"] ?? row["PaguAlat"] ?? row["pagu_alat"] ?? row["alat"]);
        const paguPelatihan = toNum(row["Pagu Pelatihan"] ?? row["PaguPelatihan"] ?? row["pagu_pelatihan"] ?? row["pelatihan"]);
        const paguTotal = toNum(row["Paagu Final"] ?? row["Pagu Final"] ?? row["pagu_total"] ?? row["paguTotal"] ?? row["total"] ?? 0);

        const statusRaw = String(row["Status"] ?? row["status"] ?? "").trim().toUpperCase();
        const status = (PAGU_ALLOWED_STATUS as readonly string[]).includes(statusRaw) ? (statusRaw as PaguStatus) : "DRAFT";

        // Check existing row to distinguish inserted vs updated
        const existingRaw = await (svc as any).databaseService.query(
          `SELECT 1 AS flag FROM public.school_pagu_budgets WHERE npsn=$1 AND tahun_ajaran=$2 LIMIT 1`,
          [npsn, ta],
        );
        const existingRows = (existingRaw && Array.isArray((existingRaw as any).rows) ? (existingRaw as any).rows : existingRaw) as any[];
        const isInsert = existingRows.length === 0;

        await svc.replaceSchoolPagu({
          schoolNpsn: npsn,
          tahunAjaran: ta,
          paguPersiapan,
          paguAlat,
          paguPelatihan,
          paguTotal,
          status,
          setByAdminId: userId,
          setByAdminName: userName,
        });

        if (isInsert) summary.inserted++;
        else summary.updated++;
      } catch (err: any) {
        summary.errors.push({ row: rowNum, message: err?.message ?? String(err) });
        summary.skipped++;
      }
    }

    return { ok: true, tahunAjaran: ta, summary, totalRows: jsonRows.length };
  }

  // ===== ADMIN: KONSENTRASI REKOMENDASI ABT 132 (Top 5 row_order 1-5, Master 128 Options, Upload Excel) =====
  @UseGuards(JwtAuthGuard)
  @Get("admin/konsentrasi-rekomendasi/master-options")
  async getAdminKonsentrasiMasterOptions(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const isAllowed = role === "ADMIN" || role === "SUPERADMIN" || role === "SEKOLAH" || role.startsWith("FASILITATOR") || role === "KOORDINATOR_ALAT" || role === "PPK";
    if (!isAllowed) {
      throw new ForbiddenException("Anda tidak memiliki izin mengakses master konsentrasi keahlian.");
    }
    return WorkspaceDataService.getGlobalSingletonInstance().getMaster128KonsentrasiOptions();
  }

  @UseGuards(JwtAuthGuard)
  @Get("admin/konsentrasi-rekomendasi/list")
  async getAdminKonsentrasiRekomendasiList(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const isAllowed = role === "ADMIN" || role === "SUPERADMIN";
    if (!isAllowed) {
      throw new ForbiddenException("Hanya ADMIN/SUPERADMIN yang dapat mengakses daftar konsentrasi rekomendasi.");
    }
    return WorkspaceDataService.getGlobalSingletonInstance().getAdminKonsentrasiRekomendasiList();
  }

  @UseGuards(JwtAuthGuard)
  @Patch("admin/konsentrasi-rekomendasi/row")
  async patchAdminKonsentrasiRekomendasiRow(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Body() body: PatchKonsentrasiRekomendasiRowBody,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const isAllowed = role === "ADMIN" || role === "SUPERADMIN";
    if (!isAllowed) {
      throw new ForbiddenException("Hanya ADMIN/SUPERADMIN yang dapat mengubah konsentrasi rekomendasi.");
    }
    const svc = WorkspaceDataService.getGlobalSingletonInstance();
    const npsn = String(body.schoolNpsn ?? "").trim().padStart(8, "0").slice(0, 8);
    const isAbt = await svc.isNpsnAbt(npsn);
    if (!isAbt) {
      throw new ForbiddenException(`NPSN ${npsn} tidak terdaftar di daftar sekolah ABT.`);
    }
    const userId = typeof (user as any).id === "string" ? ((user as any).id as string).slice(0, 64) : "admin";
    const userName = typeof (user as any).fullName === "string" ? String((user as any).fullName).slice(0, 255) : "Admin Pusat";
    const codes5 = [
      String(body.konsentrasi1Code ?? "").trim(),
      String(body.konsentrasi2Code ?? "").trim(),
      String(body.konsentrasi3Code ?? "").trim(),
      String(body.konsentrasi4Code ?? "").trim(),
      String(body.konsentrasi5Code ?? "").trim(),
    ];
    return svc.replace5KonsentrasiRekomendasiPerSekolah({
      schoolNpsn: npsn,
      codes5,
      setById: userId,
      setByName: userName,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("admin/konsentrasi-rekomendasi/upload-excel")
  @UseInterceptors(FileInterceptor("file", {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok =
        file.mimetype === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.originalname.toLowerCase().endsWith(".xlsx");
      cb(null, ok);
    },
  }))
  async postAdminKonsentrasiRekomendasiUploadExcel(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @UploadedFile() file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const isAllowed = role === "ADMIN" || role === "SUPERADMIN";
    if (!isAllowed) {
      throw new ForbiddenException("Hanya ADMIN/SUPERADMIN yang dapat upload excel konsentrasi rekomendasi.");
    }
    if (!file || !file.buffer) {
      throw new NotFoundException("File excel tidak ditemukan atau kosong.");
    }
    const svc = WorkspaceDataService.getGlobalSingletonInstance();
    const userId = typeof (user as any).id === "string" ? ((user as any).id as string).slice(0, 64) : "admin";
    const userName = typeof (user as any).fullName === "string" ? String((user as any).fullName).slice(0, 255) : "Admin Pusat";

    const masterRaw = await svc.getMaster128KonsentrasiOptions();
    const masterMap = new Map<string, string>();
    const masterNameMap = new Map<string, string>();
    for (const opt of masterRaw.rows) {
      masterMap.set(opt.code, opt.name);
      masterNameMap.set(opt.name.toLowerCase(), opt.code);
    }

    const wb = XLSX.read(file.buffer, { type: "buffer" });
    const firstSheet = wb.SheetNames[0];
    if (!firstSheet) {
      throw new NotFoundException("Sheet excel kosong / tidak ditemukan.");
    }
    const ws = wb.Sheets[firstSheet];
    const jsonRows: Array<Record<string, unknown>> = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });

    const summary = { inserted: 0, updated: 0, skipped: 0, errors: [] as Array<{ row: number; npsn?: string; message: string }> };

    const parseKodeKonsentrasi = (raw: unknown): string => {
      if (raw === null || raw === undefined) return "";
      const s = String(raw).trim();
      if (!s) return "";
      if (masterMap.has(s)) return s;
      const m = s.match(/^([\d.]+)\s*[—\-–]\s*/);
      if (m && masterMap.has(m[1])) return m[1];
      const lower = s.toLowerCase();
      if (masterNameMap.has(lower)) return masterNameMap.get(lower)!;
      return s;
    };

    for (let i = 0; i < jsonRows.length; i++) {
      const row = jsonRows[i];
      const rowNum = i + 2;
      try {
        const npsnRaw = row["NPSN"] ?? row["npsn"] ?? row["Npsn"] ?? "";
        const npsn = String(npsnRaw ?? "").trim().padStart(8, "0").slice(0, 8);
        if (!/^\d{8}$/.test(npsn)) {
          summary.errors.push({ row: rowNum, npsn: npsn || undefined, message: `NPSN tidak valid (harus 8 digit angka)` });
          summary.skipped++;
          continue;
        }
        const isAbt = await svc.isNpsnAbt(npsn);
        if (!isAbt) {
          summary.errors.push({ row: rowNum, npsn, message: `NPSN tidak terdaftar di daftar sekolah ABT` });
          summary.skipped++;
          continue;
        }
        const codes5: string[] = [];
        for (let k = 1; k <= 5; k++) {
          const key1 = `Konsentrasi ${k}`;
          const key2 = `K${k}`;
          const key3 = `konsentrasi_${k}`;
          const raw = row[key1] ?? row[key2] ?? row[key3] ?? "";
          const code = parseKodeKonsentrasi(raw);
          if (code && !masterMap.has(code)) {
            throw new Error(`Konsentrasi ${k}: kode '${code}' tidak ditemukan di master 128 konsentrasi.`);
          }
          codes5.push(code);
        }
        const replaceResult = await svc.replace5KonsentrasiRekomendasiPerSekolah({
          schoolNpsn: npsn,
          codes5,
          setById: userId,
          setByName: userName,
        });
        if (replaceResult.savedRows.length >= 1) summary.updated++;
        else summary.inserted++;
      } catch (err: any) {
        summary.errors.push({ row: rowNum, message: err?.message ?? String(err) });
        summary.skipped++;
      }
    }

    return { ok: true, summary, totalRows: jsonRows.length };
  }

  // ===== Clean MVCR: REVIEW COMMENTS FASILITATOR ALAT / ADMIN PER DOMAIN =====
  @Get("school-review-comments/:npsn")
  async getSchoolReviewComments(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Param("npsn") npsnRaw: string,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const userNpsn = typeof (user as any).npsn === "string" ? (user as any).npsn as string : "";
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN" || role.startsWith("FASILITATOR") || role === "KOORDINATOR_ALAT";
    const targetNpsn = isAdmin ? String(npsnRaw ?? userNpsn ?? "").trim() : userNpsn;
    return WorkspaceDataService.getGlobalSingletonInstance().listReviewCommentsForSchool({
      schoolNpsn: targetNpsn,
    });
  }

  @Post("school-review-comments")
  async addSchoolReviewComment(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Body() body: AddSchoolReviewCommentBody,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const commenterRole = String(body.commenterRole ?? "").toUpperCase() as ReviewCommenterRole;
    const domain = body.domainScope as ReviewDomainScope;

    // — Cepat: SEKOLAH TIDAK BOLEH POST review comment (cegah sebelum spoof check agar type narrowing tidak ganggu)
    if (role === "SEKOLAH") {
      throw new ForbiddenException("Akun SEKOLAH tidak dapat memberikan komentar review (hanya bisa menandai resolve).");
    }
    // — Enforce: payload role harus sama dengan JWT role (cegah client spoof role commenter)
    if (commenterRole !== role) {
      throw new ForbiddenException("commenterRole tidak sesuai dengan akun Anda (" + role + ").");
    }
    // — Scope rule per role (UML Flow Data SOP)
    if (role === "FASILITATOR_ALAT" && !FASILITATOR_ALAT_SCOPES.has(domain)) {
      throw new ForbiddenException(
        "Fasilitator Alat hanya bisa berkomentar di domain: " + Array.from(FASILITATOR_ALAT_SCOPES).join(", ") + ".",
      );
    }
    if (role === "FASILITATOR_ADMINISTRASI" && !FASILITATOR_ADMIN_SCOPES.has(domain)) {
      throw new ForbiddenException(
        "Fasilitator Administrasi hanya bisa berkomentar di domain: " + Array.from(FASILITATOR_ADMIN_SCOPES).join(", ") + ".",
      );
    }

    const userId = typeof (user as any).id === "string" ? ((user as any).id as string).slice(0, 64) : ("anon-" + Date.now());
    return WorkspaceDataService.getGlobalSingletonInstance().addReviewComment({
      schoolNpsn: String(body.schoolNpsn ?? "").trim(),
      domainScope: domain,
      recordRef: typeof body.recordRef === "string" && body.recordRef.trim() ? body.recordRef.trim().slice(0, 128) : null,
      commenterRole: commenterRole as ReviewCommenterRole,
      commenterUserId: userId,
      commenterName: String(body.commenterName ?? "").slice(0, 255),
      commentText: String(body.commentText ?? "").trim(),
      severity: (REVIEW_SEVERITIES as readonly string[]).includes(String(body.severity ?? "")) ? (body.severity as ReviewSeverity) : "INFO",
    });
  }

  @Patch("school-review-comments/resolve")
  async resolveSchoolReviewComment(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Body() body: ResolveSchoolReviewCommentBody,
  ) {
    const user = request.user;
    const role = String(user.role ?? "").toUpperCase();
    const userId = typeof (user as any).id === "string" ? ((user as any).id as string).slice(0, 64) : "anon";
    const userNpsn = typeof (user as any).npsn === "string" ? (user as any).npsn as string : "";
    const isAdmin = role === "ADMIN" || role === "SUPERADMIN" || role.startsWith("FASILITATOR") || role === "KOORDINATOR_ALAT";
    return WorkspaceDataService.getGlobalSingletonInstance().resolveReviewComment({
      commentId: String(body.commentId ?? "").trim(),
      isResolved: typeof body.isResolved === "boolean" ? body.isResolved : true,
      actorRole: role,
      actorUserId: userId,
      actorNpsn: userNpsn,
      isAdminActor: isAdmin,
    });
  }

  @Get("master-templates")
  async listMasterTemplates(@Query("kind") kind?: string) {
    const valid = ["IDENTITAS","ADMINISTRASI","SURVEY_HARGA","RPKP","RAB","RPD","PKS"];
    const safeKind = valid.includes(kind ?? "") ? (kind as any) : undefined;
    const rows = await WorkspaceDataService.getGlobalSingletonInstance().listAllTemplates(safeKind);
    return { ok: true, rows };
  }

  @Get("master-templates/active")
  async getActiveMasterTemplate(@Query("kind") kind: string) {
    const valid = ["IDENTITAS","ADMINISTRASI","SURVEY_HARGA","RPKP","RAB","RPD","PKS"];
    if (!valid.includes(kind ?? "")) {
      throw new ForbiddenException("Parameter kind wajib diisi salah satu: IDENTITAS, ADMINISTRASI, SURVEY_HARGA, RPKP, RAB, RPD, atau PKS.");
    }
    const row = await WorkspaceDataService.getGlobalSingletonInstance().getActiveTemplate(kind as any);
    return { ok: true, row };
  }

  @Post("master-templates")
  async upsertMasterTemplate(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Body() body: UpsertMasterTemplateBody,
  ) {
    const userRole = String(request.user?.role ?? "").toUpperCase();
    if (userRole !== "ADMIN") {
      throw new ForbiddenException("Hanya ADMIN yang boleh mengelola master template RPD/PKS.");
    }
    const row = await WorkspaceDataService.getGlobalSingletonInstance().upsertTemplate({
      id: body.id,
      kind: body.kind,
      version_label: body.version_label,
      tahun_ajaran: body.tahun_ajaran,
      is_active: body.is_active,
      title: body.title,
      body_html: body.body_html,
      notes: body.notes,
      created_by_user_id: request.user?.id ?? null,
    });
    return { ok: true, row };
  }

  @Post("master-templates/:id/set-active")
  async setMasterTemplateActive(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Param("id") id: string,
    @Body() body: SetTemplateActiveBody,
  ) {
    const userRole = String(request.user?.role ?? "").toUpperCase();
    if (userRole !== "ADMIN") {
      throw new ForbiddenException("Hanya ADMIN yang boleh mengaktifkan template RPD/PKS.");
    }
    const result = await WorkspaceDataService.getGlobalSingletonInstance().setTemplateActive(id, body.kind);
    return { ok: true, ...result };
  }

  @Delete("master-templates/:id")
  async deleteMasterTemplate(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Param("id") id: string,
  ) {
    const userRole = String(request.user?.role ?? "").toUpperCase();
    if (userRole !== "ADMIN") {
      throw new ForbiddenException("Hanya ADMIN yang boleh menghapus template RPD/PKS.");
    }
    const result = await WorkspaceDataService.getGlobalSingletonInstance().deleteTemplate(id);
    return { ok: true, ...result };
  }

  @Get("school-instance")
  async getSchoolInstance(
    @Query("schoolNpsn") schoolNpsn: string,
    @Query("moduleContext") moduleContext: string,
    @Query("kind") kind: string,
  ) {
    const safeModule = moduleContext === "bimbingan-teknis" ? "bimbingan-teknis" : "pra-bimtek";
    const valid = ["IDENTITAS","ADMINISTRASI","SURVEY_HARGA","RPKP","RAB","RPD","PKS"];
    const safeKind = valid.includes(kind ?? "") ? (kind as any) : "IDENTITAS";
    const row = await WorkspaceDataService.getGlobalSingletonInstance().getSchoolInstance(
      String(schoolNpsn ?? "").trim(),
      safeModule,
      safeKind,
    );
    return { ok: true, row };
  }

  @Post("school-instance/upsert")
  async upsertSchoolInstance(
    @Req() request: { user: Awaited<ReturnType<AuthService["verifyToken"]>> },
    @Body() body: UpsertSchoolInstanceBody,
  ) {
    const userRole = String(request.user?.role ?? "").toUpperCase();
    const userId = request.user?.id ?? null;
    const isApprovedRole = ["ADMIN", "FASILITATOR_ALAT", "FA"].includes(userRole);
    if (!isApprovedRole) {
      throw new ForbiddenException("Hanya FA, FASILITATOR_ALAT, atau ADMIN yang boleh mengedit RPD/PKS sekolah.");
    }
    const injectApprover =
      userRole === "ADMIN" || userRole === "FASILITATOR_ALAT" ? userId : null;
    const row = await WorkspaceDataService.getGlobalSingletonInstance().upsertSchoolInstance({
      id: body.id,
      school_npsn: body.school_npsn,
      school_name: body.school_name,
      module_context: body.module_context,
      kind: body.kind,
      template_id: body.template_id,
      body_html: body.body_html,
      review_notes: body.review_notes,
      review_status: body.review_status,
      reviewed_by_user_id: injectApprover,
      approved_by_user_id: injectApprover,
      created_by_user_id: userId,
    });
    return { ok: true, row };
  }

  @Get("admin/report/rpkp")
  async getAdminRpkpReport(@Query("schoolNpsn") schoolNpsn?: string) {
    return WorkspaceDataService.getGlobalSingletonInstance().getRpkpReport({
      schoolNpsn: schoolNpsn?.trim() || undefined,
    });
  }
}
