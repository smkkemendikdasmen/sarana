import { Controller, Get, Query, UseGuards } from "@nestjs/common";

import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { MasterDataService } from "./master-data.service.js";

@UseGuards(JwtAuthGuard)
@Controller("master-data")
export class MasterDataController {
  constructor() {}

  @Get("wilayah/provinsi")
  listProvinsi() {
    return MasterDataService.getGlobalSingletonInstance().listProvinsi();
  }

  @Get("wilayah/kabupaten")
  listKabupaten(@Query("parent_kode") parentKode?: string) {
    return MasterDataService.getGlobalSingletonInstance().listKabupaten(parentKode);
  }

  @Get("wilayah/kecamatan")
  listKecamatan(@Query("parent_kode") parentKode?: string) {
    return MasterDataService.getGlobalSingletonInstance().listKecamatan(parentKode);
  }

  @Get("wilayah/kelurahan")
  listKelurahan(@Query("parent_kode") parentKode?: string) {
    return MasterDataService.getGlobalSingletonInstance().listKelurahan(parentKode);
  }

  @Get("wilayah/lookup")
  lookupNama(@Query("kode") kode?: string) {
    return MasterDataService.getGlobalSingletonInstance().lookupNamaByKode(kode);
  }
}
