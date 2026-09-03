import { Body, Controller, Delete, Get, Param, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";

import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { SchoolProfileService, UpdateSchoolProfileDto } from "./school-profile.service.js";

interface AuthenticatedRequest {
  user: {
    id: string;
  };
}

@UseGuards(JwtAuthGuard)
@Controller("school-profile")
export class SchoolProfileController {
  constructor() {}

  @Get("me")
  getMyProfile(@Req() request: AuthenticatedRequest) {
    return SchoolProfileService.getGlobalSingletonInstance().getMyProfile(request.user.id);
  }

  @Get("by-npsn/:npsn")
  getProfileByNpsn(@Param("npsn") npsn: string) {
    return SchoolProfileService.getGlobalSingletonInstance().getProfileByNpsn(npsn);
  }

  @Get("list-concentrations-summary")
  getListConcentrationsSummary() {
    return SchoolProfileService.getGlobalSingletonInstance().getListConcentrationsSummary();
  }

  @Get("me/administrative-documents")
  getMyAdministrativeDocuments(@Req() request: AuthenticatedRequest) {
    return SchoolProfileService.getGlobalSingletonInstance().getMyAdministrativeDocuments(request.user.id);
  }

  @Get("by-npsn/:npsn/administrative-documents")
  getAdministrativeDocumentsByNpsn(@Param("npsn") npsn: string) {
    return SchoolProfileService.getGlobalSingletonInstance().getAdministrativeDocumentsByNpsn(npsn);
  }

  @Put("me")
  updateMyProfile(@Req() request: AuthenticatedRequest, @Body() body: UpdateSchoolProfileDto) {
    return SchoolProfileService.getGlobalSingletonInstance().updateMyProfile(request.user.id, body);
  }

  @Post("me/administrative-documents/:documentCode")
  @UseInterceptors(
    FileInterceptor("file", {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  uploadMyAdministrativeDocument(
    @Req() request: AuthenticatedRequest,
    @Param("documentCode") documentCode: string,
    @UploadedFile() file: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    return SchoolProfileService.getGlobalSingletonInstance().uploadMyAdministrativeDocument(request.user.id, documentCode, file);
  }

  @Delete("me/administrative-documents/:fileId")
  deleteMyAdministrativeDocumentFile(
    @Req() request: AuthenticatedRequest,
    @Param("fileId") fileId: string,
  ) {
    return SchoolProfileService.getGlobalSingletonInstance().deleteMyAdministrativeDocumentFile(request.user.id, fileId);
  }
}
