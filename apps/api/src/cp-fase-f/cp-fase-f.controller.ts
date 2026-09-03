import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Put } from "@nestjs/common";

import { CpFaseFService } from "./cp-fase-f.service.js";

interface ReplaceCpItemsBody {
  items?: Array<{
    elemen?: string;
    deskripsi?: string;
  }>;
}

@Controller("master-data/cp-fase-f")
export class CpFaseFController {
  constructor() {}

  @Get()
  getSummary() {
    return CpFaseFService.getGlobalSingletonInstance().getSummary();
  }

  @Get("bidang/:code")
  async getBidangDetail(@Param("code") code: string) {
    const bidang = await CpFaseFService.getGlobalSingletonInstance().getBidangDetail(code);
    if (!bidang) {
      throw new NotFoundException("Data CP Fase F untuk bidang keahlian tidak ditemukan.");
    }

    return bidang;
  }

  @Put("concentrations/:code")
  async replaceConcentrationItems(@Param("code") code: string, @Body() body: ReplaceCpItemsBody) {
    const items = Array.isArray(body?.items)
      ? body.items.map((item) => ({
          elemen: item.elemen ?? "",
          deskripsi: item.deskripsi ?? "",
        }))
      : [];

    try {
      const savedItems = await CpFaseFService.getGlobalSingletonInstance().replaceConcentrationItems(code, items);
      return { items: savedItems };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan data capaian pembelajaran.";
      throw new BadRequestException(message);
    }
  }
}
