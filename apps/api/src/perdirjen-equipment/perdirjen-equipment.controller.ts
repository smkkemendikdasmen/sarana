import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Put } from "@nestjs/common";

import { PerdirjenEquipmentService } from "./perdirjen-equipment.service.js";

const categoryCodeMap = {
  minimal: "MINIMAL",
  pengembangan: "PENGEMBANGAN",
  pendukung: "PENDUKUNG",
} as const;

type CategorySlug = keyof typeof categoryCodeMap;

interface ReplaceCategoryItemsBody {
  items?: Array<{
    name?: string;
    functionText?: string;
    specificationText?: string;
    ratio?: string;
  }>;
}

@Controller("master-data/perdirjen-equipment")
export class PerdirjenEquipmentController {
  constructor() {}

  @Get()
  getSummary() {
    return PerdirjenEquipmentService.getGlobalSingletonInstance().getSummary();
  }

  @Get("pdf-page-map")
  getPdfPageMap() {
    return PerdirjenEquipmentService.getGlobalSingletonInstance().getPdfPageMap();
  }

  @Get("bidang/:code")
  async getBidangDetail(@Param("code") code: string) {
    const bidang = await PerdirjenEquipmentService.getGlobalSingletonInstance().getBidangDetail(code);
    if (!bidang) {
      throw new NotFoundException("Data bidang keahlian tidak ditemukan.");
    }

    return bidang;
  }

  @Put("concentrations/:code/categories/:category")
  async replaceCategoryItems(
    @Param("code") code: string,
    @Param("category") category: string,
    @Body() body: ReplaceCategoryItemsBody,
  ) {
    const categoryCode = categoryCodeMap[category as CategorySlug];
    if (!categoryCode) {
      throw new BadRequestException("Kategori peralatan tidak valid.");
    }

    const items = Array.isArray(body?.items)
      ? body.items.map((item) => ({
          name: item.name ?? "",
          functionText: item.functionText ?? "",
          specificationText: item.specificationText ?? "",
          ratio: item.ratio ?? "",
        }))
      : [];

    try {
      const savedItems = await PerdirjenEquipmentService.getGlobalSingletonInstance().replaceCategoryItems(code, categoryCode, items);
      return { items: savedItems };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan data peralatan.";
      throw new BadRequestException(message);
    }
  }
}
